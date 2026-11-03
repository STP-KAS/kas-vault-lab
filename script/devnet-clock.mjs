// Private half-devnet clock. Talks only to ws://127.0.0.1:17610.
// Mines only through grpc://127.0.0.1:16610. Does not touch the peg covenants.
// contracts/clock.sil waits a constructor count of DAA. This run uses 8.
// --probe funds the five-entry contract and stops on the first accepted entry.
// --again spends that successor once. A bare run does not retry a rejected one-entry prove.

import { createRequire } from "node:module";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { encodeEntry, withRedeem } from "./sigscript.mjs";

const URL = "ws://127.0.0.1:17610";
const GRPC = "grpc://127.0.0.1:16610";
const NETWORK = "devnet";
const WASM = "C:\\Users\\Remco\\Documents\\kaspa\\tn10-core-stress\\sdk\\kaspa-wasm32-sdk\\nodejs\\kaspa\\kaspa.js";
const SILVERC = "C:\\Users\\Remco\\tools\\silverc\\silverc.exe";
const MINE = "C:\\Users\\Remco\\Documents\\kaspa\\stpnet\\target\\release\\stp-mine.exe";
const KEYS = "C:\\kaspa-stpnet\\wallets\\keys.txt";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "contracts", "clock.sil");
const LOCAL = join(ROOT, ".local");
const STATE_FILE = join(LOCAL, "devnet-clock-state.json");
const JOURNAL = join(ROOT, "results", "devnet-clock.jsonl");

const WAIT = 8;
const VALUE = 50_000_000n;
const FEE_FLOOR = 2_000_000n;
const MATURITY = 1000n;
const MAX_SEQUENCE = (2n ** 64n) - 1n;

const secrets = [];

function hide(text) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret && secret.length >= 16) out = out.split(secret).join("[redacted]");
  }
  return out;
}

function say(text) {
  process.stdout.write(`${hide(text)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hexOf(value) {
  return String(value).replace(/^0x/, "").trim().toLowerCase();
}

function journal(row) {
  mkdirSync(dirname(JOURNAL), { recursive: true });
  appendFileSync(JOURNAL, `${JSON.stringify({ utc: new Date().toISOString(), ...row })}\n`);
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function rawSig(value) {
  let hex = hexOf(value);
  if (hex.length === 132 && hex.startsWith("41")) hex = hex.slice(2);
  if (hex.length !== 130) throw new Error(`signature is ${hex.length / 2} bytes`);
  return hex;
}

function p2pkScript(value) {
  const hex = hexOf(value);
  if (hex.length === 132 && hex.startsWith("41")) return hex;
  return `41${rawSig(hex)}`;
}

function blankSig() {
  const bytes = Buffer.alloc(65);
  bytes[64] = 1;
  return bytes;
}

function budgetForUsed(used) {
  const units = BigInt(used);
  if (units <= 9999n) return 0;
  return Number((units - 9999n + 9999n) / 10000n);
}

function pubOf(kaspa, key) {
  return hexOf(key.toPublicKey().toXOnlyPublicKey().toString());
}

function loadWallets(kaspa) {
  const found = {};
  for (const line of readFileSync(KEYS, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 3) throw new Error("keys file line is not name, secret, address");
    const [name, secret, address] = parts;
    if (!address.startsWith("kaspadev:")) throw new Error(`${name} address is not devnet`);
    secrets.push(secret.toLowerCase());
    const key = new kaspa.PrivateKey(secret);
    if (key.toAddress(NETWORK).toString() !== address) throw new Error(`${name} key does not match its address`);
    found[name] = { key, pub: pubOf(kaspa, key), address, spk: kaspa.payToAddressScript(address) };
  }
  if (!found.one || !found.three) throw new Error("missing wallet");
  return found;
}

function compile(kaspaOwner) {
  const dir = join(tmpdir(), "kas-vault-lab-clock");
  mkdirSync(dir, { recursive: true });
  const argsPath = join(dir, "clock-args.json");
  const outPath = join(dir, "clock.json");
  const owner = [...Buffer.from(kaspaOwner, "hex")];
  writeFileSync(argsPath, JSON.stringify([
    { kind: "bytes", value: owner },
    { kind: "int", value: WAIT },
  ]));
  const result = spawnSync(SILVERC, [SOURCE, "--constructor-args", argsPath, "-o", outPath], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (result.status !== 0) throw new Error(hide(result.stderr || result.stdout || "silverc failed"));
  const artifact = JSON.parse(readFileSync(outPath, "utf8"));
  const names = Object.keys(artifact.contracts || {});
  if (names.length !== 1) throw new Error("expected one contract");
  const bytes = artifact.contracts[names[0]].compiled?.bytecode;
  if (!Array.isArray(bytes) || !bytes.length) throw new Error("silverc emitted no bytecode");
  return { artifact, redeem: Buffer.from(bytes) };
}

function entryScript(kaspa, built, args) {
  const action = encodeEntry(kaspa, built.artifact, "prove", args);
  return withRedeem(kaspa, action, built.redeem);
}

async function loadKaspa() {
  const require = createRequire(join(ROOT, "package.json"));
  globalThis.WebSocket = require("websocket").w3cwebsocket;
  return import(pathToFileURL(WASM).href);
}

async function dagOf(rpc) {
  const dag = await rpc.getBlockDagInfo();
  const medianRaw = dag.pastMedianTime ?? dag.pastMedianTimestamp ?? null;
  return {
    virtualDaa: BigInt(dag.virtualDaaScore),
    sink: hexOf(dag.sink),
    median: medianRaw == null ? "" : BigInt(medianRaw).toString(),
  };
}

function scriptHex(spk) {
  if (!spk) return "";
  if (typeof spk.script === "string") return hexOf(spk.script);
  return hexOf(spk);
}

function daaOf(row) {
  if (row.blockDaaScore != null) return BigInt(row.blockDaaScore);
  if (row.entry && row.entry.blockDaaScore != null) return BigInt(row.entry.blockDaaScore);
  throw new Error("utxo has no daa score");
}

function coinbaseOf(row) {
  if (typeof row.isCoinbase === "boolean") return row.isCoinbase;
  return Boolean(row.entry && row.entry.isCoinbase);
}

function covOf(row) {
  const id = row.entry && row.entry.covenantId;
  return id ? hexOf(id.toString()) : "";
}

async function utxosOf(rpc, address) {
  const bag = await rpc.getUtxosByAddresses([address]);
  return bag.entries || [];
}

function mineOne(address) {
  const result = spawnSync(MINE, [address, "1", GRPC], {
    encoding: "utf8",
    timeout: 180000,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`miner exited ${result.status}`);
}

function outputOf(kaspa, value, script, covenant) {
  return new kaspa.TransactionOutput(BigInt(value), script, covenant || null);
}

async function submit(kaspa, rpc, spec) {
  let fee = FEE_FLOOR;
  let budget = 16;
  let lastError = "";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const inputSum = spec.rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const fixedSum = spec.outputs.reduce((sum, item) => sum + BigInt(item.value), 0n);
    const change = inputSum - fixedSum - fee;
    if (change < 1000n) throw new Error(`${spec.label} change would be ${change}`);
    const outputs = [...spec.outputs, { value: change, script: spec.changeScript, covenant: null }].map((item) =>
      outputOf(kaspa, item.value, item.script, item.covenant),
    );
    const inputs = spec.rows.map((row, index) => ({
      previousOutpoint: { transactionId: row.outpoint.transactionId, index: row.outpoint.index },
      signatureScript: "",
      sequence: spec.sequences[index],
      sigOpCount: 0,
      computeBudget: index === 0 && spec.prove ? budget : 10,
      utxo: row,
    }));
    const tx = new kaspa.Transaction({
      version: 1,
      inputs,
      outputs,
      lockTime: BigInt(spec.lockTime),
      subnetworkId: "00".repeat(20),
      gas: 0n,
      payload: "",
    });
    tx.version = 1;
    if (spec.genesis) tx.populateGenesisCovenants([new kaspa.GenesisCovenantGroup(0, [0])]);
    const entryName = spec.entryName || (spec.prove ? "prove" : "");
    const entryArgs = spec.entryArgs || (spec.prove ? [blankSig()] : null);
    if (entryName) {
      tx.inputs[0].signatureScript = entryOf(kaspa, spec.built, entryName, entryArgs);
      tx.inputs[0].computeBudget = budget;
    }
    let required = 0n;
    try {
      const quote = kaspa.calculateTransactionFee(NETWORK, tx);
      if (quote != null) required = BigInt(quote);
    } catch {
      required = FEE_FLOOR;
    }
    const bump = spec.feeBump || 1000n;
    if (fee < required + bump) {
      fee = required + bump;
      continue;
    }
    if (entryName && entryArgs && entryArgs.length) {
      const signed = Buffer.from(rawSig(kaspa.createInputSignature(tx, 0, spec.ownerKey)), "hex");
      const args = entryArgs.map((arg, index) => (index === 0 ? signed : arg));
      tx.inputs[0].signatureScript = entryOf(kaspa, spec.built, entryName, args);
      tx.inputs[0].computeBudget = budget;
    }
    const feeIndex = entryName ? 1 : 0;
    tx.inputs[feeIndex].signatureScript = p2pkScript(kaspa.createInputSignature(tx, feeIndex, spec.feeKey));
    tx.inputs[feeIndex].computeBudget = 10;
    tx.finalize();
    try {
      const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
      const id = hexOf(result.transactionId || tx.id);
      const bound = tx.outputs[0] && tx.outputs[0].covenant;
      return {
        accepted: true,
        id,
        fee: fee.toString(),
        budget,
        covenantId: bound ? hexOf(bound.covenantId.toString()) : "",
      };
    } catch (error) {
      lastError = hide(error && error.message ? error.message : error);
      const used = lastError.match(/used[=: ]+(\d+)/i);
      if (used) {
        const next = budgetForUsed(used[1]);
        if (next > budget) {
          budget = next;
          continue;
        }
      }
      const namedFee = lastError.match(/required amount of (\d+)/i);
      if (namedFee) {
        const next = BigInt(namedFee[1]) + 1000n;
        if (next > fee) {
          fee = next;
          continue;
        }
      }
      if (/fee|mass/i.test(lastError) && attempt < 4) {
        fee *= 2n;
        continue;
      }
      return { accepted: false, error: lastError, id: "" };
    }
  }
  return { accepted: false, error: lastError || "not accepted", id: "" };
}

async function findClock(rpc, kaspa, built, amount = VALUE) {
  const address = kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) === amount);
  if (!hit) return null;
  return { address, row: hit, born: daaOf(hit).toString(), covenantId: covOf(hit) };
}

async function waitClock(rpc, kaspa, built, amount = VALUE) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findClock(rpc, kaspa, built, amount);
    if (found && found.covenantId) return found;
    await sleep(500);
  }
  throw new Error("clock output did not appear");
}

async function pickCoin(rpc, wallet, virtualDaa) {
  const rows = await utxosOf(rpc, wallet.address);
  const need = VALUE + FEE_FLOOR + 1_000_000n;
  const fit = rows
    .filter((row) => {
      if (covOf(row)) return false;
      if (scriptHex(row.scriptPublicKey) !== scriptHex(wallet.spk)) return false;
      if (coinbaseOf(row) && daaOf(row) + MATURITY > virtualDaa) return false;
      return BigInt(row.amount) >= need;
    })
    .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? -1 : 1));
  if (!fit.length) throw new Error("no mature coin covers the clock");
  return fit[0];
}

const PROBE_SOURCE = join(ROOT, "contracts", "clock-probe.sil");
const PROBE_STATE = join(LOCAL, "devnet-clock-probe-state.json");
const PROBE_VALUE = 20_000_000n;
const PROBE_ORDER = ["full", "nosig", "nodaa", "open", "touch"];

function compileSource(source, kaspaOwner) {
  const dir = join(tmpdir(), "kas-vault-lab-clock");
  mkdirSync(dir, { recursive: true });
  const argsPath = join(dir, "probe-args.json");
  const outPath = join(dir, "probe.json");
  const owner = [...Buffer.from(kaspaOwner, "hex")];
  writeFileSync(argsPath, JSON.stringify([
    { kind: "bytes", value: owner },
    { kind: "int", value: WAIT },
  ]));
  const result = spawnSync(SILVERC, [source, "--constructor-args", argsPath, "-o", outPath], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (result.status !== 0) throw new Error(hide(result.stderr || result.stdout || "silverc failed"));
  const artifact = JSON.parse(readFileSync(outPath, "utf8"));
  const names = Object.keys(artifact.contracts || {});
  if (names.length !== 1) throw new Error("expected one contract");
  const bytes = artifact.contracts[names[0]].compiled?.bytecode;
  if (!Array.isArray(bytes) || !bytes.length) throw new Error("silverc emitted no bytecode");
  return { artifact, redeem: Buffer.from(bytes) };
}

function entryOf(kaspa, built, name, args) {
  const action = encodeEntry(kaspa, built.artifact, name, args);
  return withRedeem(kaspa, action, built.redeem);
}

async function runProbe(kaspa, rpc, wallets) {
  const built = compileSource(PROBE_SOURCE, wallets.one.pub);
  const state = loadJson(PROBE_STATE, { phase: "start", wait: WAIT, value: PROBE_VALUE.toString() });
  if (state.phase === "landed") {
    say(`probe already landed entry=${state.entry} txid=${state.txid}`);
    return;
  }
  const dag = await dagOf(rpc);
  say(`probe virtualDaa=${dag.virtualDaa}`);
  if (state.phase === "start") {
    const coin = await pickCoin(rpc, wallets.one, dag.virtualDaa);
    const script = kaspa.payToScriptHashScript(built.redeem);
    const funded = await submit(kaspa, rpc, {
      label: "probe-fund",
      rows: [coin],
      sequences: [MAX_SEQUENCE],
      lockTime: 0,
      genesis: true,
      outputs: [{ value: PROBE_VALUE, script }],
      changeScript: wallets.one.spk,
      feeKey: wallets.one.key,
      prove: false,
    });
    if (!funded.accepted) throw new Error(`probe fund rejected: ${funded.error}`);
    mineOne(wallets.three.address);
    const row = await waitClock(rpc, kaspa, built, PROBE_VALUE);
    state.phase = "funded";
    state.fund = funded.id;
    state.born = row.born;
    state.need = (BigInt(row.born) + BigInt(WAIT) - 1n).toString();
    state.covenantId = row.covenantId;
    saveJson(PROBE_STATE, state);
    journal({ label: "probe-fund", txid: funded.id, born: state.born, need: state.need, covenantId: state.covenantId });
    say(`probe born=${state.born} need=${state.need} covenant=${state.covenantId}`);
  }
  let now = await dagOf(rpc);
  let mines = 0;
  while (now.virtualDaa <= BigInt(state.need)) {
    if (mines >= 24) throw new Error("probe DAA did not pass the lock");
    mineOne(wallets.three.address);
    mines += 1;
    now = await dagOf(rpc);
    say(`probe mined ${mines} virtual=${now.virtualDaa}`);
  }
  const sitting = await findClock(rpc, kaspa, built, PROBE_VALUE);
  if (!sitting) throw new Error("probe output is not spendable");
  const script = kaspa.payToScriptHashScript(built.redeem);
  const outputs = [{
    value: PROBE_VALUE,
    script,
    covenant: new kaspa.CovenantBinding(0, new kaspa.Hash(state.covenantId)),
  }];
  const tries = [];
  for (const name of PROBE_ORDER) {
    const clocked = name === "full" || name === "nosig";
    const signed = name === "full" || name === "nodaa";
    const feeCoin = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa);
    const blank = signed ? [blankSig()] : [];
    const sent = await submit(kaspa, rpc, {
      label: `probe-${name}`,
      rows: [sitting.row, feeCoin],
      sequences: clocked ? [0n, MAX_SEQUENCE] : [MAX_SEQUENCE, MAX_SEQUENCE],
      lockTime: clocked ? BigInt(state.need) : 0n,
      genesis: false,
      outputs,
      changeScript: wallets.one.spk,
      feeKey: wallets.one.key,
      ownerKey: wallets.one.key,
      built,
      prove: false,
      entryName: name,
      entryArgs: blank,
    });
    tries.push({ name, accepted: sent.accepted, error: sent.error || "", txid: sent.id });
    journal({ label: `probe-${name}`, accepted: sent.accepted, error: sent.error || "", txid: sent.id });
    say(`probe ${name} accepted=${sent.accepted} ${sent.error || sent.id}`);
    if (!sent.accepted) continue;
    mineOne(wallets.three.address);
    const after = await waitClock(rpc, kaspa, built, PROBE_VALUE);
    state.phase = "landed";
    state.entry = name;
    state.txid = sent.id;
    state.blockDaa = after.born;
    state.tries = tries;
    saveJson(PROBE_STATE, state);
    journal({ label: "probe-landed", entry: name, txid: sent.id, blockDaa: after.born, tries });
    say(`probe landed entry=${name} txid=${sent.id} blockDaa=${after.born}`);
    return;
  }
  state.tries = tries;
  saveJson(PROBE_STATE, state);
  throw new Error("every probe entry was rejected");
}

async function runAgain(kaspa, rpc, wallets) {
  const built = compileSource(PROBE_SOURCE, wallets.one.pub);
  const state = loadJson(PROBE_STATE, { phase: "start", wait: WAIT, value: PROBE_VALUE.toString() });
  if (state.phase === "again") {
    say(`probe already retested txid=${state.again.txid} born=${state.again.born} need=${state.again.need} blockDaa=${state.again.blockDaa}`);
    return;
  }
  if (state.phase !== "landed") throw new Error(`probe phase is ${state.phase}`);
  const sitting = await findClock(rpc, kaspa, built, PROBE_VALUE);
  if (!sitting) throw new Error("probe successor is not spendable");
  if (sitting.covenantId !== state.covenantId) throw new Error(`probe covenant is ${sitting.covenantId}`);
  const born = BigInt(sitting.born);
  const need = born + BigInt(WAIT) - 1n;
  const prior = state.txid;
  say(`again born=${born} storedBlock=${state.blockDaa} need=${need} prior=${prior}`);
  let now = await dagOf(rpc);
  let mines = 0;
  while (now.virtualDaa <= need) {
    if (mines >= 24) throw new Error("probe DAA did not pass the second lock");
    mineOne(wallets.three.address);
    mines += 1;
    now = await dagOf(rpc);
    say(`again mined ${mines} virtual=${now.virtualDaa}`);
  }
  const script = kaspa.payToScriptHashScript(built.redeem);
  const outputs = [{
    value: PROBE_VALUE,
    script,
    covenant: new kaspa.CovenantBinding(0, new kaspa.Hash(state.covenantId)),
  }];
  const feeCoin = await pickCoin(rpc, wallets.one, now.virtualDaa);
  const sent = await submit(kaspa, rpc, {
    label: "probe-again",
    rows: [sitting.row, feeCoin],
    sequences: [0n, MAX_SEQUENCE],
    lockTime: need,
    genesis: false,
    outputs,
    changeScript: wallets.one.spk,
    feeKey: wallets.one.key,
    ownerKey: wallets.one.key,
    built,
    prove: false,
    entryName: "full",
    entryArgs: [blankSig()],
  });
  journal({
    label: "probe-again",
    accepted: sent.accepted,
    error: sent.error || "",
    txid: sent.id,
    born: born.toString(),
    need: need.toString(),
    prior,
    virtualDaa: now.virtualDaa.toString(),
    mines,
  });
  if (!sent.accepted) throw new Error(`probe again rejected: ${sent.error}`);
  if (sent.id === prior) throw new Error("probe again reused the first txid");
  mineOne(wallets.three.address);
  const after = await waitClock(rpc, kaspa, built, PROBE_VALUE);
  const end = await dagOf(rpc);
  state.phase = "again";
  state.again = {
    txid: sent.id,
    born: born.toString(),
    need: need.toString(),
    blockDaa: after.born,
    prior,
    virtualDaa: end.virtualDaa.toString(),
    mines,
    fee: sent.fee,
  };
  saveJson(PROBE_STATE, state);
  journal({
    label: "probe-again-landed",
    txid: sent.id,
    born: born.toString(),
    need: need.toString(),
    blockDaa: after.born,
    prior,
    virtualDaa: end.virtualDaa.toString(),
  });
  say(`probe again txid=${sent.id} born=${born} need=${need} blockDaa=${after.born} virtual=${end.virtualDaa}`);
}

async function main() {
  const noise = process.argv.slice(2).join(" ");
  if (/testnet|mainnet|kaspa\.org|faucet|16710|16210/i.test(noise)) {
    throw new Error("refusing a public or other-devnet argument");
  }
  if (!existsSync(SILVERC) || !existsSync(MINE) || !existsSync(WASM)) throw new Error("clock tools are missing");
  const kaspa = await loadKaspa();
  const wallets = loadWallets(kaspa);
  if (process.argv.includes("--probe") || process.argv.includes("--again")) {
    const rpc = new kaspa.RpcClient({ url: URL, encoding: kaspa.Encoding.Borsh, networkId: NETWORK });
    await rpc.connect();
    const info = await rpc.getServerInfo();
    if (String(info.networkId) !== NETWORK) throw new Error(`refusing network ${info.networkId}`);
    try {
      if (process.argv.includes("--again")) await runAgain(kaspa, rpc, wallets);
      else await runProbe(kaspa, rpc, wallets);
    } finally {
      await rpc.disconnect();
    }
    return;
  }
  const built = compile(wallets.one.pub);
  const rpc = new kaspa.RpcClient({ url: URL, encoding: kaspa.Encoding.Borsh, networkId: NETWORK });
  await rpc.connect();
  const info = await rpc.getServerInfo();
  if (String(info.networkId) !== NETWORK) throw new Error(`refusing network ${info.networkId}`);
  try {
  const state = loadJson(STATE_FILE, { phase: "start", wait: WAIT, value: VALUE.toString() });
  const dag = await dagOf(rpc);
  say(`virtualDaa=${dag.virtualDaa} median=${dag.median} sink=${dag.sink}`);
  journal({ label: "clock-dag", virtualDaa: dag.virtualDaa.toString(), median: dag.median, sink: dag.sink, phase: state.phase });

  if (state.phase === "proved") {
    say(`already proved txid=${state.proved.txid} born=${state.born} need=${state.need} blockDaa=${state.proved.blockDaa}`);
    return;
  }

  if (state.phase === "funded" && state.maxRejected && state.earlyRejected && !process.argv.includes("--prove")) {
    say(`one-entry clock remains unspent covenant=${state.covenantId} born=${state.born} need=${state.need}`);
    return;
  }

  if (state.phase === "start") {
    const coin = await pickCoin(rpc, wallets.one, dag.virtualDaa);
    const script = kaspa.payToScriptHashScript(built.redeem);
    const funded = await submit(kaspa, rpc, {
      label: "clock-fund",
      rows: [coin],
      sequences: [MAX_SEQUENCE],
      lockTime: 0,
      genesis: true,
      outputs: [{ value: VALUE, script }],
      changeScript: wallets.one.spk,
      feeKey: wallets.one.key,
      prove: false,
    });
    if (!funded.accepted) throw new Error(`fund rejected: ${funded.error}`);
    say(`fund txid=${funded.id}`);
    mineOne(wallets.three.address);
    const row = await waitClock(rpc, kaspa, built);
    state.phase = "funded";
    state.fund = funded.id;
    state.born = row.born;
    state.need = (BigInt(row.born) + BigInt(WAIT) - 1n).toString();
    state.covenantId = row.covenantId;
    state.address = row.address;
    saveJson(STATE_FILE, state);
    journal({ label: "clock-fund", txid: funded.id, born: state.born, need: state.need, covenantId: state.covenantId });
    say(`born=${state.born} need=${state.need} covenant=${state.covenantId}`);
  }

  const sitting = await findClock(rpc, kaspa, built);
  if (!sitting) throw new Error("funded clock is not spendable");
  const feeCoin = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa);
  const script = kaspa.payToScriptHashScript(built.redeem);
  const proveOutputs = [{
    value: VALUE,
    script,
    covenant: new kaspa.CovenantBinding(0, new kaspa.Hash(state.covenantId)),
  }];

  if (!state.maxRejected) {
    const skipped = await submit(kaspa, rpc, {
      label: "clock-max",
      rows: [sitting.row, feeCoin],
      sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
      lockTime: BigInt(state.need),
      genesis: false,
      outputs: proveOutputs,
      changeScript: wallets.one.spk,
      feeKey: wallets.one.key,
      ownerKey: wallets.one.key,
      built,
      prove: true,
    });
    state.maxRejected = skipped;
    saveJson(STATE_FILE, state);
    journal({ label: "clock-max", accepted: skipped.accepted, error: skipped.error || "", txid: skipped.id });
    say(`max sequence accepted=${skipped.accepted} ${skipped.error || skipped.id}`);
    if (skipped.accepted) throw new Error("max sequence was accepted");
  }

  const before = await dagOf(rpc);
  if (before.virtualDaa > BigInt(state.need) && !state.earlyRejected) {
    throw new Error(`virtual DAA ${before.virtualDaa} is already past need ${state.need}`);
  }
  if (!state.earlyRejected) {
    const early = await submit(kaspa, rpc, {
      label: "clock-early",
      rows: [sitting.row, feeCoin],
      sequences: [0n, MAX_SEQUENCE],
      lockTime: BigInt(state.need),
      genesis: false,
      outputs: proveOutputs,
      changeScript: wallets.one.spk,
      feeKey: wallets.one.key,
      ownerKey: wallets.one.key,
      built,
      prove: true,
    });
    state.earlyRejected = early;
    saveJson(STATE_FILE, state);
    journal({
      label: "clock-early",
      accepted: early.accepted,
      error: early.error || "",
      txid: early.id,
      virtualDaa: before.virtualDaa.toString(),
      need: state.need,
    });
    say(`early accepted=${early.accepted} virtual=${before.virtualDaa} ${early.error || early.id}`);
    if (early.accepted) throw new Error("early DAA wait was accepted");
  }

  let now = await dagOf(rpc);
  let mines = 0;
  while (now.virtualDaa <= BigInt(state.need)) {
    if (mines >= 24) throw new Error("DAA did not pass the lock");
    mineOne(wallets.three.address);
    mines += 1;
    now = await dagOf(rpc);
    say(`mined ${mines} virtual=${now.virtualDaa}`);
  }
  const again = await findClock(rpc, kaspa, built);
  if (!again) throw new Error("clock was spent before the wait");
  say(`prove born=${again.born} stored=${state.born} need=${state.need} virtual=${now.virtualDaa}`);
  const feeAgain = await pickCoin(rpc, wallets.one, now.virtualDaa);
  const proved = await submit(kaspa, rpc, {
    label: "clock-prove",
    rows: [again.row, feeAgain],
    sequences: [0n, MAX_SEQUENCE],
    lockTime: BigInt(state.need),
    genesis: false,
    outputs: proveOutputs,
    changeScript: wallets.one.spk,
    feeKey: wallets.one.key,
    ownerKey: wallets.one.key,
    built,
    prove: true,
  });
  if (!proved.accepted) throw new Error(`prove rejected: ${proved.error}`);
  mineOne(wallets.three.address);
  const after = await waitClock(rpc, kaspa, built);
  const end = await dagOf(rpc);
  state.phase = "proved";
  state.proved = { txid: proved.id, fee: proved.fee, blockDaa: after.born, virtualDaa: end.virtualDaa.toString() };
  state.mines = mines;
  saveJson(STATE_FILE, state);
  journal({
    label: "clock-prove",
    txid: proved.id,
    born: state.born,
    need: state.need,
    blockDaa: after.born,
    virtualDaa: end.virtualDaa.toString(),
    mines,
    median: end.median,
  });
  say(`proved txid=${proved.id} born=${state.born} need=${state.need} spentFrom=${state.born} nowBorn=${after.born} mines=${mines}`);
  } finally {
    await rpc.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${hide(error && error.stack ? error.stack : error)}\n`);
  process.exitCode = 1;
});
