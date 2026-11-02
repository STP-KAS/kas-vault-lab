// Private devnet peg.sil driver.
// Talks only to ws://127.0.0.1:17610 and mines only through grpc://127.0.0.1:16610.
// Does not call a faucet, a resolver, or a public node.
// A confirmed redeem is a covenant UTXO on this devnet. The quote is a lab key.

import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { signPrice } from "./oracle.mjs";
import { encodeEntry, withRedeem } from "./sigscript.mjs";

const URL = "ws://127.0.0.1:17610";
const GRPC = "grpc://127.0.0.1:16610";
const NETWORK = "devnet";
const WASM = "C:\\Users\\Remco\\Documents\\kaspa\\tn10-core-stress\\sdk\\kaspa-wasm32-sdk\\nodejs\\kaspa\\kaspa.js";
const SILVERC = "C:\\Users\\Remco\\tools\\silverc\\silverc.exe";
const MINE = "C:\\Users\\Remco\\Documents\\kaspa\\stpnet\\target\\release\\stp-mine.exe";
const KEYS = "C:\\kaspa-stpnet\\wallets\\keys.txt";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "contracts", "peg.sil");
const LOCAL = join(ROOT, ".local");
const RESULTS = join(ROOT, "results");
const ORACLE_FILE = join(LOCAL, "devnet-oracle.json");
const STATE_FILE = join(LOCAL, "devnet-peg-state.json");
const JOURNAL = join(RESULTS, "devnet-peg.jsonl");

const COLLATERAL = 300_000_000n;
const CARRIER = 20_000_000n;
const FEE_FLOOR = 2_000_000n;
const MATURITY = 1000n;
const RATIO = 20000;
const LIQ = 15000;
const BONUS = 500;
const MINT_CENTS = 100;
const TOO_MUCH = 200;
const MINT_PRICE = 100_000_000;
const PAY = 100_000_000n;
const SURPLUS = 200_000_000n;
const WRONG_PAY = 50_000_000n;
const WRONG_LEFT = 250_000_000n;
const ZERO = "00".repeat(32);
const LOCK_TIME_THRESHOLD = 500_000_000_000;

const PHASES = [
  "start",
  "openedA",
  "sealedA",
  "rejectedStale",
  "rejectedOver",
  "mintedA",
  "openedB",
  "sealedB",
  "mintedB",
  "rejectedWrongPay",
  "rejectedCross",
  "redeemedA",
  "redeemedB",
  "refreshedA",
  "mintedA2",
  "redeemedA2",
];

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

function need(name, value) {
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function stamps(date = new Date()) {
  return { utc: date.toISOString() };
}

function journal(row) {
  mkdirSync(RESULTS, { recursive: true });
  appendFileSync(JOURNAL, `${JSON.stringify({ ...stamps(), ...row })}\n`);
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function phaseAtLeast(state, phase) {
  return PHASES.indexOf(state.phase) >= PHASES.indexOf(phase);
}

function fairSompi(cents, price) {
  return (BigInt(cents) * BigInt(price) + 99n) / 100n;
}

function atRatio(cents, price, ratio) {
  return (fairSompi(cents, price) * BigInt(ratio) + 9999n) / 10000n;
}

function assertMath() {
  if (fairSompi(MINT_CENTS, MINT_PRICE) !== PAY) throw new Error("fair pay");
  if (COLLATERAL - PAY !== SURPLUS) throw new Error("surplus");
  if (atRatio(MINT_CENTS, MINT_PRICE, RATIO) !== 200_000_000n) throw new Error("mint need");
  if (atRatio(TOO_MUCH, MINT_PRICE, RATIO) <= COLLATERAL) throw new Error("over mint should exceed collateral");
  if (WRONG_PAY + WRONG_LEFT !== COLLATERAL) throw new Error("wrong split");
}

function budgetForUsed(used) {
  const units = BigInt(used);
  const free = 9999n;
  const per = 10000n;
  if (units <= free) return 0;
  return Number((units - free + per - 1n) / per);
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

function windowFor(nowMs, stale) {
  const lockTime = nowMs - 180_000;
  if (lockTime < LOCK_TIME_THRESHOLD) throw new Error("lock time would be read as a DAA score");
  if (!stale) {
    const notBefore = lockTime - 60_000;
    const expiry = notBefore + 3_600_000;
    return { lockTime, notBefore, expiry };
  }
  const expiry = lockTime - 30_000;
  return { lockTime, notBefore: expiry - 3_600_000, expiry };
}

function ctorJson(contractState) {
  const bytes = (hex) => [...Buffer.from(hexOf(hex), "hex")];
  return [
    { kind: "int", value: contractState.amount },
    { kind: "bytes", value: bytes(contractState.owner) },
    { kind: "byte", value: contractState.ownerScheme },
    { kind: "byte", value: contractState.borrowScheme },
    { kind: "bytes", value: bytes(contractState.borrowGuard) },
    { kind: "bytes", value: bytes(contractState.extension) },
    { kind: "int", value: contractState.kind },
    { kind: "int", value: contractState.debt },
    { kind: "bytes", value: bytes(contractState.oracle) },
    { kind: "int", value: contractState.ratioBps },
    { kind: "int", value: contractState.liqBps },
    { kind: "int", value: contractState.bonusBps },
    { kind: "int", value: contractState.sealed },
    { kind: "int", value: contractState.quote },
  ];
}

const compiled = new Map();

function compile(contractState) {
  const key = JSON.stringify(contractState);
  const hit = compiled.get(key);
  if (hit) return hit;
  const dir = join(tmpdir(), "kas-vault-lab-devnet");
  mkdirSync(dir, { recursive: true });
  const stamp = randomBytes(4).toString("hex");
  const argsPath = join(dir, `args-${stamp}.json`);
  const outPath = join(dir, `peg-${stamp}.json`);
  writeFileSync(argsPath, JSON.stringify(ctorJson(contractState)));
  const result = spawnSync(SILVERC, [SOURCE, "--constructor-args", argsPath, "-o", outPath], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (result.status !== 0) {
    throw new Error(hide(result.stderr || result.stdout || "silverc failed"));
  }
  const artifact = JSON.parse(readFileSync(outPath, "utf8"));
  const names = Object.keys(artifact.contracts || {});
  if (names.length !== 1) throw new Error(`expected one contract, found ${names.join(",") || "none"}`);
  const bytes = artifact.contracts[names[0]].compiled?.bytecode;
  if (!Array.isArray(bytes) || !bytes.length) throw new Error("silverc emitted no bytecode");
  const row = { artifact, redeem: Buffer.from(bytes) };
  compiled.set(key, row);
  return row;
}

async function loadKaspa() {
  if (!existsSync(WASM)) throw new Error("kaspa wasm is missing");
  const require = createRequire(join(ROOT, "package.json"));
  globalThis.WebSocket = require("websocket").w3cwebsocket;
  return import(pathToFileURL(WASM).href);
}

function pubOf(kaspa, key) {
  return hexOf(key.toPublicKey().toXOnlyPublicKey().toString());
}

function loadWallets(kaspa) {
  const text = readFileSync(KEYS, "utf8");
  const found = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 3) throw new Error("keys file line is not name, secret, address");
    const [name, secret, address] = parts;
    if (!address.startsWith("kaspadev:")) throw new Error(`${name} address is not devnet`);
    secrets.push(secret.toLowerCase());
    const key = new kaspa.PrivateKey(secret);
    const derived = key.toAddress(NETWORK).toString();
    if (derived !== address) throw new Error(`${name} key does not match its address`);
    found[name] = { key, pub: pubOf(kaspa, key), address, spk: kaspa.payToAddressScript(address) };
  }
  for (const name of ["one", "two", "three"]) {
    if (!found[name]) throw new Error(`missing wallet ${name}`);
  }
  return found;
}

function loadOracle(kaspa) {
  mkdirSync(LOCAL, { recursive: true });
  let saved = loadJson(ORACLE_FILE, null);
  if (!saved) {
    let priv = null;
    let pub = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      priv = randomBytes(32);
      try {
        const key = new kaspa.PrivateKey(priv.toString("hex"));
        pub = pubOf(kaspa, key);
        const noble = signPrice(1, 1, 2, priv).pub.toString("hex");
        if (noble !== pub) throw new Error("oracle pubkey mismatch");
        break;
      } catch (error) {
        priv = null;
        if (attempt === 7) throw error;
      }
    }
    saved = { pub, priv: priv.toString("hex") };
    saveJson(ORACLE_FILE, saved);
  }
  secrets.push(String(saved.priv).toLowerCase());
  const key = new kaspa.PrivateKey(saved.priv);
  const pub = pubOf(kaspa, key);
  const noble = signPrice(1, 1, 2, Buffer.from(saved.priv, "hex")).pub.toString("hex");
  if (noble !== pub) throw new Error("oracle pubkey mismatch");
  if (saved.pub && hexOf(saved.pub) !== pub) throw new Error("stored oracle pub does not match the key");
  return { key, pub, priv: Buffer.from(saved.priv, "hex") };
}

function shape(ownerPub, extension, oraclePub, over = {}) {
  return {
    amount: 0,
    owner: ownerPub,
    ownerScheme: 0,
    borrowScheme: 0,
    borrowGuard: ZERO,
    extension,
    kind: 1,
    debt: 0,
    oracle: oraclePub,
    ratioBps: RATIO,
    liqBps: LIQ,
    bonusBps: BONUS,
    sealed: 0,
    quote: 0,
    ...over,
  };
}

function blankSig() {
  const bytes = Buffer.alloc(65);
  bytes[64] = 1;
  return bytes;
}

function covOf(row) {
  const id = row.entry && row.entry.covenantId;
  return id ? hexOf(id.toString()) : "";
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

function idOf(row) {
  return `${hexOf(row.outpoint.transactionId)}:${row.outpoint.index}`;
}

async function connectRpc(kaspa) {
  const rpc = new kaspa.RpcClient({
    url: URL,
    encoding: kaspa.Encoding.Borsh,
    networkId: NETWORK,
  });
  await rpc.connect();
  const info = await rpc.getServerInfo();
  const networkId = String(info.networkId);
  if (networkId !== NETWORK || /testnet|mainnet/i.test(networkId)) {
    throw new Error(`refusing network ${networkId}`);
  }
  if (info.hasUtxoIndex !== true) throw new Error("devnet node has no utxo index");
  return { rpc, info };
}

async function dagOf(rpc) {
  const dag = await rpc.getBlockDagInfo();
  return {
    virtualDaa: BigInt(dag.virtualDaaScore),
    blockCount: BigInt(dag.blockCount),
    headerCount: BigInt(dag.headerCount),
    sink: hexOf(dag.sink),
    tips: (dag.tipHashes || []).length,
  };
}

async function utxosOf(rpc, address) {
  const bag = await rpc.getUtxosByAddresses([address]);
  return bag.entries || [];
}

function spendable(row, ownerSpk, virtualDaa) {
  if (covOf(row)) return false;
  if (scriptHex(row.scriptPublicKey) !== scriptHex(ownerSpk)) return false;
  if (!coinbaseOf(row)) return true;
  return daaOf(row) + MATURITY <= virtualDaa;
}

async function pickCoin(rpc, wallet, virtualDaa, needAmount, avoid) {
  const rows = await utxosOf(rpc, wallet.address);
  const fit = rows
    .filter((row) => spendable(row, wallet.spk, virtualDaa) && !avoid.has(idOf(row)) && BigInt(row.amount) >= needAmount)
    .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? -1 : 1));
  if (!fit.length) throw new Error(`no mature coin covers ${needAmount} sompi`);
  return fit[0];
}

function inputOf(row, budget) {
  return {
    previousOutpoint: { transactionId: row.outpoint.transactionId, index: row.outpoint.index },
    signatureScript: "",
    sequence: (2n ** 64n) - 1n,
    sigOpCount: 0,
    computeBudget: budget,
    utxo: row,
  };
}

function binding(kaspa, index, covenantId) {
  return new kaspa.CovenantBinding(index, new kaspa.Hash(covenantId));
}

function outputOf(kaspa, value, script, covenant) {
  return new kaspa.TransactionOutput(BigInt(value), script, covenant || null);
}

function applyBudget(tx, spec, budget) {
  const sigBudget = 10;
  for (const input of tx.inputs) input.computeBudget = sigBudget;
  for (let i = 0; i < spec.covenantRows.length; i += 1) tx.inputs[i].computeBudget = budget;
  if (spec.genesis) tx.inputs[0].computeBudget = Math.max(budget, sigBudget);
}

function entryScript(kaspa, built, entry, args) {
  const action = encodeEntry(kaspa, built.artifact, entry, args);
  return withRedeem(kaspa, action, built.redeem);
}

async function submitOnce(kaspa, rpc, spec) {
  let fee = FEE_FLOOR;
  let budget = 16;
  let lastError = "";
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const fixed = spec.fixed(kaspa);
    const inputSum = spec.covenantRows.reduce((sum, row) => sum + BigInt(row.amount), 0n) + BigInt(spec.feeRow.amount);
    const fixedSum = fixed.reduce((sum, item) => sum + BigInt(item.value), 0n);
    const change = inputSum - fixedSum - fee;
    if (change < 1000n) throw new Error(`${spec.label} change would be ${change}`);
    const outputs = [...fixed, { value: change, script: spec.changeScript, covenant: null }].map((item) =>
      outputOf(kaspa, item.value, item.script, item.covenant),
    );
    const inputs = [...spec.covenantRows.map((row) => inputOf(row, budget)), inputOf(spec.feeRow, 0)];
    const tx = new kaspa.Transaction({
      version: 1,
      inputs,
      outputs,
      lockTime: BigInt(spec.lockTime || 0),
      subnetworkId: "00".repeat(20),
      gas: 0n,
      payload: "",
    });
    tx.version = 1;
    if (spec.genesis) tx.populateGenesisCovenants([new kaspa.GenesisCovenantGroup(0, spec.genesisOutputs)]);
    applyBudget(tx, spec, budget);
    for (const sig of spec.sigs) {
      const args = sig.args.map((arg) => (arg === "OWNER" ? blankSig() : arg));
      tx.inputs[sig.index].signatureScript = entryScript(kaspa, sig.built, sig.entry, args);
      tx.inputs[sig.index].computeBudget = budget;
    }
    let required = 0n;
    try {
      const quote = kaspa.calculateTransactionFee(NETWORK, tx);
      if (quote != null) required = BigInt(quote);
    } catch {
      required = FEE_FLOOR;
    }
    if (fee < required) {
      say(`${spec.label} fee ${fee} below quote ${required}`);
      fee = required + 1000n;
      continue;
    }
    for (const sig of spec.sigs) {
      const signed = Buffer.from(rawSig(kaspa.createInputSignature(tx, sig.index, sig.key)), "hex");
      const args = sig.args.map((arg) => (arg === "OWNER" ? signed : arg));
      tx.inputs[sig.index].signatureScript = entryScript(kaspa, sig.built, sig.entry, args);
      tx.inputs[sig.index].computeBudget = budget;
    }
    const feeIndex = spec.covenantRows.length;
    tx.inputs[feeIndex].signatureScript = p2pkScript(kaspa.createInputSignature(tx, feeIndex, spec.feeKey));
    applyBudget(tx, spec, budget);
    tx.finalize();
    try {
      const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
      const id = hexOf(result.transactionId || tx.id);
      const bound = tx.outputs[0] && tx.outputs[0].covenant;
      return {
        id,
        fee: fee.toString(),
        budget,
        attempt,
        change: change.toString(),
        covenantId: bound ? hexOf(bound.covenantId.toString()) : "",
      };
    } catch (error) {
      lastError = hide(error && error.message ? error.message : error);
      const used = lastError.match(/used[=: ]+(\d+)/i);
      if (used) {
        const next = budgetForUsed(used[1]);
        if (next > budget) {
          budget = next;
          say(`${spec.label} retry compute budget ${budget}`);
          continue;
        }
      }
      if (/fee|mass/i.test(lastError) && attempt < 4) {
        fee *= 2n;
        say(`${spec.label} retry fee ${fee}`);
        continue;
      }
      const failure = new Error(lastError);
      failure.rejected = true;
      throw failure;
    }
  }
  const failure = new Error(lastError || `${spec.label} was not accepted`);
  failure.rejected = true;
  throw failure;
}

function p2sh(kaspa, built) {
  return kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
}

async function findRow(rpc, kaspa, contractState, amount) {
  const built = compile(contractState);
  const address = p2sh(kaspa, built);
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) === amount);
  if (!hit) return null;
  return { built, address, row: hit, covenantId: covOf(hit) };
}

async function waitRow(rpc, kaspa, contractState, amount) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findRow(rpc, kaspa, contractState, amount);
    if (found && found.covenantId) return found;
    await sleep(500);
  }
  const built = compile(contractState);
  throw new Error(`output ${amount} is not visible at ${p2sh(kaspa, built)}`);
}

async function waitPay(rpc, address, txid, amounts) {
  const id = hexOf(txid);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await utxosOf(rpc, address);
    const mine = rows.filter((row) => hexOf(row.outpoint.transactionId) === id);
    const have = mine.map((row) => BigInt(row.amount));
    const pending = [...have];
    const covered = amounts.every((value) => {
      const at = pending.indexOf(value);
      if (at < 0) return false;
      pending.splice(at, 1);
      return true;
    });
    if (covered) {
      return mine.map((row) => ({ index: row.outpoint.index, amount: BigInt(row.amount).toString() }));
    }
    await sleep(500);
  }
  throw new Error(`payment outputs for ${id} did not appear`);
}

function priceArgs(oracle, cents, noteOwner, stale) {
  const window = windowFor(Date.now(), stale);
  const signed = signPrice(MINT_PRICE, window.notBefore, window.expiry, oracle.priv);
  return {
    window,
    args: [cents, Buffer.from(noteOwner, "hex"), MINT_PRICE, window.notBefore, window.expiry, signed.sig, "OWNER"],
  };
}

function mineOne(address) {
  say(`mine 1 -> ${address}`);
  const result = spawnSync(MINE, [address, "1", GRPC], { encoding: "utf8", timeout: 180000, windowsHide: true });
  const output = hide(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  if (output) say(output);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`miner exited ${result.status}`);
}

async function main() {
  const noise = process.argv.slice(2).join(" ");
  if (/testnet|mainnet|kaspa\.org|faucet|16710|16210/i.test(noise)) {
    throw new Error("refusing a public or other-devnet argument");
  }
  assertMath();
  if (!existsSync(SILVERC)) throw new Error("silverc is missing");
  if (!existsSync(MINE)) throw new Error("stp-mine is missing");
  const kaspa = await loadKaspa();
  const wallets = loadWallets(kaspa);
  const oracle = loadOracle(kaspa);
  say(`wallets one=${wallets.one.address}`);
  say(`wallets two=${wallets.two.address}`);
  say(`miner three=${wallets.three.address}`);
  say(`oracle pub=${oracle.pub}`);

  const state = loadJson(STATE_FILE, {
    phase: "start",
    network: NETWORK,
    url: URL,
    extensionA: randomBytes(32).toString("hex"),
    extensionB: randomBytes(32).toString("hex"),
    oraclePub: oracle.pub,
    steps: [],
  });
  if (state.oraclePub !== oracle.pub) throw new Error("state oracle does not match the oracle file");
  if (state.url !== URL) throw new Error("state url is not the local devnet");

  const { rpc, info } = await connectRpc(kaspa);
  try {
    const dag = await dagOf(rpc);
    say(`server=${info.serverVersion} network=${info.networkId} synced=${info.isSynced} virtual_daa=${dag.virtualDaa} sink=${dag.sink}`);
    journal({ label: "connect", server: info.serverVersion, network: String(info.networkId), synced: info.isSynced, ...dag, virtualDaa: dag.virtualDaa.toString(), blockCount: dag.blockCount.toString(), headerCount: dag.headerCount.toString() });

    const probe = await pickCoin(rpc, wallets.one, dag.virtualDaa, COLLATERAL + FEE_FLOOR, new Set());
    const probeTwo = await pickCoin(rpc, wallets.two, dag.virtualDaa, COLLATERAL + FEE_FLOOR, new Set());
    say(`mature one=${probe.amount} daa=${daaOf(probe)} coinbase=${coinbaseOf(probe)}`);
    say(`mature two=${probeTwo.amount} daa=${daaOf(probeTwo)} coinbase=${coinbaseOf(probeTwo)}`);

    function side(name) {
      const extension = name === "A" ? state.extensionA : state.extensionB;
      const locker = name === "A" ? wallets.one : wallets.two;
      const holder = name === "A" ? wallets.two : wallets.one;
      return {
        name,
        locker,
        holder,
        open: shape(locker.pub, extension, oracle.pub),
        sealed: shape(locker.pub, extension, oracle.pub, { sealed: 1 }),
        minted: shape(locker.pub, extension, oracle.pub, { sealed: 1, debt: MINT_CENTS, quote: MINT_PRICE }),
        note: shape(holder.pub, extension, oracle.pub, {
          amount: MINT_CENTS,
          owner: holder.pub,
          kind: 2,
          debt: 0,
          sealed: 1,
          quote: MINT_PRICE,
        }),
        redeemed: shape(locker.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: MINT_PRICE }),
        overVault: shape(locker.pub, extension, oracle.pub, { sealed: 1, debt: TOO_MUCH, quote: MINT_PRICE }),
        overNote: shape(holder.pub, extension, oracle.pub, {
          amount: TOO_MUCH,
          owner: holder.pub,
          kind: 2,
          debt: 0,
          sealed: 1,
          quote: MINT_PRICE,
        }),
      };
    }

    function record(row) {
      state.steps.push(row);
      saveJson(STATE_FILE, state);
      journal(row);
      const tail = row.txid ? ` ${row.txid}` : "";
      say(`${row.label} ${row.observed}${tail}`);
    }

    async function send(label, wallet, spec) {
      const virtualDaa = (await dagOf(rpc)).virtualDaa;
      const feeRow = await pickCoin(rpc, wallet, virtualDaa, spec.feeNeed, new Set());
      say(`${label} fee coin ${idOf(feeRow)} amount=${feeRow.amount} daa=${daaOf(feeRow)} coinbase=${coinbaseOf(feeRow)}`);
      return submitOnce(kaspa, rpc, { ...spec, label, feeRow, feeKey: wallet.key, changeScript: wallet.spk });
    }

    async function accept(label, phase, wallet, spec, confirm) {
      if (!phaseAtLeast(state, phase)) {
        const sent = await send(label, wallet, spec);
        record({ label, expected: "accept", observed: "accepted", txid: sent.id, fee: sent.fee, budget: sent.budget, change: sent.change, covenantId: sent.covenantId });
        state.phase = phase;
        state[phase] = { txid: sent.id, fee: sent.fee, budget: sent.budget, covenantId: sent.covenantId };
        saveJson(STATE_FILE, state);
        mineOne(wallets.three.address);
      } else {
        say(`${label} already ${phase}`);
      }
      return confirm();
    }

    async function reject(label, phase, wallet, spec) {
      if (phaseAtLeast(state, phase)) {
        say(`${label} already ${phase}`);
        return;
      }
      try {
        const sent = await send(label, wallet, spec);
        record({ label, expected: "reject", observed: "accepted", txid: sent.id, fee: sent.fee, budget: sent.budget });
        state.phase = phase;
        state[phase] = { txid: sent.id, observed: "accepted" };
        saveJson(STATE_FILE, state);
        throw new Error(`${label} was accepted ${sent.id}`);
      } catch (error) {
        if (!error.rejected) throw error;
        if (/insufficient fee|fee rate|feerate|\bmass\b|orphan|not synced|compute budget|signature script length|not final|ECONN|timed out|socket hang/i.test(error.message)) {
          throw error;
        }
        record({ label, expected: "reject", observed: "rejected", error: String(error.message).slice(0, 800) });
        state.phase = phase;
        state[phase] = { observed: "rejected", error: String(error.message).slice(0, 800) };
        saveJson(STATE_FILE, state);
      }
    }

    if (process.argv.includes("--quote")) {
      const nextPrice = 200_000_000;
      const cents = 50;
      const pay = fairSompi(cents, nextPrice);
      const left = SURPLUS - pay;
      if (pay !== 100_000_000n || left !== 100_000_000n) throw new Error("second quote pay");
      if (atRatio(cents, nextPrice, RATIO) !== SURPLUS) throw new Error("second quote ratio");
      if (phaseAtLeast(state, "redeemedA2")) {
        const redeemed = shape(wallets.one.pub, state.extensionA, oracle.pub, { sealed: 1, debt: 0, quote: nextPrice });
        const vault = await waitRow(rpc, kaspa, redeemed, left);
        const pays = await waitPay(rpc, wallets.two.address, state.redeemedA2.txid, [pay, CARRIER]);
        say(`RESULT quote ${JSON.stringify({
          refresh: state.refreshedA.txid,
          mint: state.mintedA2.txid,
          redeem: state.redeemedA2.txid,
          nextPrice,
          cents,
          surplus: vault.row.amount.toString(),
          pay: pay.toString(),
          carrier: CARRIER.toString(),
          pays,
          covenant: vault.covenantId,
        })}`);
        return;
      }
      const current = shape(wallets.one.pub, state.extensionA, oracle.pub, { sealed: 1, quote: MINT_PRICE });
      const refreshed = shape(wallets.one.pub, state.extensionA, oracle.pub, { sealed: 1, quote: nextPrice });
      const have = await waitRow(rpc, kaspa, current, SURPLUS);
      say(`quote-from covenant=${have.covenantId} value=${have.row.amount} quote=${MINT_PRICE}`);
      const window = windowFor(Date.now(), false);
      const signed = signPrice(nextPrice, window.notBefore, window.expiry, oracle.priv);
      const nextBuilt = compile(refreshed);
      const moved = await accept("refresh-a", "refreshedA", wallets.one, {
        feeNeed: FEE_FLOOR,
        lockTime: window.lockTime,
        covenantRows: [have.row],
        sigs: [{ index: 0, built: have.built, entry: "refreshSolo", key: wallets.one.key, args: [nextPrice, window.notBefore, window.expiry, signed.sig] }],
        fixed: (sdk) => [{
          value: SURPLUS,
          script: sdk.payToScriptHashScript(nextBuilt.redeem),
          covenant: binding(sdk, 0, have.covenantId),
        }],
      }, () => waitRow(rpc, kaspa, refreshed, SURPLUS));
      say(`refresh-a quote=${nextPrice} value=${moved.row.amount} covenant=${moved.covenantId}`);

      const minted = shape(wallets.one.pub, state.extensionA, oracle.pub, { sealed: 1, debt: cents, quote: nextPrice });
      const note = shape(wallets.two.pub, state.extensionA, oracle.pub, {
        amount: cents,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: nextPrice,
      });
      const mintedBuilt = compile(minted);
      const noteBuilt = compile(note);
      const againWindow = windowFor(Date.now(), false);
      const againSigned = signPrice(nextPrice, againWindow.notBefore, againWindow.expiry, oracle.priv);
      const againArgs = [cents, Buffer.from(wallets.two.pub, "hex"), nextPrice, againWindow.notBefore, againWindow.expiry, againSigned.sig, "OWNER"];
      const mintedRow = await accept("mint-a-2", "mintedA2", wallets.one, {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: againWindow.lockTime,
        covenantRows: [moved.row],
        sigs: [{ index: 0, built: moved.built, entry: "mint", key: wallets.one.key, args: againArgs }],
        fixed: (sdk) => [
          { value: SURPLUS, script: sdk.payToScriptHashScript(mintedBuilt.redeem), covenant: binding(sdk, 0, moved.covenantId) },
          { value: CARRIER, script: sdk.payToScriptHashScript(noteBuilt.redeem), covenant: binding(sdk, 0, moved.covenantId) },
        ],
      }, async () => ({
        vault: await waitRow(rpc, kaspa, minted, SURPLUS),
        note: await waitRow(rpc, kaspa, note, CARRIER),
      }));

      const redeemed = shape(wallets.one.pub, state.extensionA, oracle.pub, { sealed: 1, debt: 0, quote: nextPrice });
      const redeemedBuilt = compile(redeemed);
      const second = await accept("redeem-a-2", "redeemedA2", wallets.two, {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [mintedRow.vault.row, mintedRow.note.row],
        sigs: [
          { index: 0, built: mintedRow.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
          { index: 1, built: mintedRow.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
        ],
        fixed: (sdk) => [
          { value: left, script: sdk.payToScriptHashScript(redeemedBuilt.redeem), covenant: binding(sdk, 0, mintedRow.vault.covenantId) },
          { value: pay, script: sdk.payToAddressScript(wallets.two.address) },
          { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
        ],
      }, async () => {
        const vault = await waitRow(rpc, kaspa, redeemed, left);
        const txid = state.redeemedA2.txid;
        const pays = await waitPay(rpc, wallets.two.address, txid, [pay, CARRIER]);
        return { vault, pays, txid };
      });
      say(`RESULT quote ${JSON.stringify({
        refresh: state.refreshedA.txid,
        mint: state.mintedA2.txid,
        redeem: second.txid,
        nextPrice,
        cents,
        surplus: left.toString(),
        pay: pay.toString(),
        carrier: CARRIER.toString(),
        covenant: second.vault.covenantId,
      })}`);
      return;
    }

    const a = side("A");
    const openBuilt = compile(a.open);
    say(`open script ${openBuilt.redeem.length} bytes`);

    let opened = null;
    if (!phaseAtLeast(state, "sealedA")) {
      opened = await accept("open-a", "openedA", wallets.one, {
        feeNeed: COLLATERAL + FEE_FLOOR,
        lockTime: 0,
        genesis: true,
        genesisOutputs: [0],
        covenantRows: [],
        sigs: [],
        fixed: () => [{ value: COLLATERAL, script: kaspa.payToScriptHashScript(openBuilt.redeem) }],
      }, () => waitRow(rpc, kaspa, a.open, COLLATERAL));
      say(`open-a address=${opened.address} covenant=${opened.covenantId} value=${opened.row.amount}`);
    } else {
      say("open-a already spent");
    }

    let sealed = null;
    if (!phaseAtLeast(state, "mintedA")) {
      if (!phaseAtLeast(state, "sealedA")) {
        const sealedBuilt = compile(a.sealed);
        sealed = await accept("seal-a", "sealedA", wallets.one, {
          feeNeed: FEE_FLOOR,
          lockTime: 0,
          covenantRows: [opened.row],
          sigs: [{ index: 0, built: opened.built, entry: "seal", key: wallets.one.key, args: ["OWNER"] }],
          fixed: (sdk) => [{
            value: COLLATERAL,
            script: sdk.payToScriptHashScript(sealedBuilt.redeem),
            covenant: binding(sdk, 0, opened.covenantId),
          }],
        }, () => waitRow(rpc, kaspa, a.sealed, COLLATERAL));
      } else {
        sealed = await waitRow(rpc, kaspa, a.sealed, COLLATERAL);
      }
      say(`seal-a covenant=${sealed.covenantId} value=${sealed.row.amount}`);
    } else {
      say("seal-a already spent");
    }

    const stale = priceArgs(oracle, MINT_CENTS, wallets.two.pub, true);
    const mintedBuilt = compile(a.minted);
    const noteBuilt = compile(a.note);
    const mintFixed = (sdk) => [
      { value: COLLATERAL, script: sdk.payToScriptHashScript(mintedBuilt.redeem), covenant: binding(sdk, 0, sealed.covenantId) },
      { value: CARRIER, script: sdk.payToScriptHashScript(noteBuilt.redeem), covenant: binding(sdk, 0, sealed.covenantId) },
    ];
    await reject("reject-stale-mint-a", "rejectedStale", wallets.one, {
      feeNeed: CARRIER + FEE_FLOOR,
      lockTime: stale.window.lockTime,
      covenantRows: [sealed.row],
      sigs: [{ index: 0, built: sealed.built, entry: "mint", key: wallets.one.key, args: stale.args }],
      fixed: mintFixed,
    });

    const over = priceArgs(oracle, TOO_MUCH, wallets.two.pub, false);
    const overVault = compile(a.overVault);
    const overNote = compile(a.overNote);
    await reject("reject-over-mint-a", "rejectedOver", wallets.one, {
      feeNeed: CARRIER + FEE_FLOOR,
      lockTime: over.window.lockTime,
      covenantRows: [sealed.row],
      sigs: [{ index: 0, built: sealed.built, entry: "mint", key: wallets.one.key, args: over.args }],
      fixed: (sdk) => [
        { value: COLLATERAL, script: sdk.payToScriptHashScript(overVault.redeem), covenant: binding(sdk, 0, sealed.covenantId) },
        { value: CARRIER, script: sdk.payToScriptHashScript(overNote.redeem), covenant: binding(sdk, 0, sealed.covenantId) },
      ],
    });

    const good = priceArgs(oracle, MINT_CENTS, wallets.two.pub, false);
    const minted = await accept("mint-a", "mintedA", wallets.one, {
      feeNeed: CARRIER + FEE_FLOOR,
      lockTime: good.window.lockTime,
      covenantRows: [sealed.row],
      sigs: [{ index: 0, built: sealed.built, entry: "mint", key: wallets.one.key, args: good.args }],
      fixed: mintFixed,
    }, async () => {
      const vault = await waitRow(rpc, kaspa, a.minted, COLLATERAL);
      const note = await waitRow(rpc, kaspa, a.note, CARRIER);
      return { vault, note };
    });
    say(`mint-a vault=${minted.vault.covenantId} note=${minted.note.address} value=${minted.note.row.amount}`);

    const b = side("B");
    const openBBuilt = compile(b.open);
    const openedB = await accept("open-b", "openedB", wallets.two, {
      feeNeed: COLLATERAL + FEE_FLOOR,
      lockTime: 0,
      genesis: true,
      genesisOutputs: [0],
      covenantRows: [],
      sigs: [],
      fixed: () => [{ value: COLLATERAL, script: kaspa.payToScriptHashScript(openBBuilt.redeem) }],
    }, () => waitRow(rpc, kaspa, b.open, COLLATERAL));
    say(`open-b address=${openedB.address} covenant=${openedB.covenantId}`);

    const sealedBBuilt = compile(b.sealed);
    const sealedB = await accept("seal-b", "sealedB", wallets.two, {
      feeNeed: FEE_FLOOR,
      lockTime: 0,
      covenantRows: [openedB.row],
      sigs: [{ index: 0, built: openedB.built, entry: "seal", key: wallets.two.key, args: ["OWNER"] }],
      fixed: (sdk) => [{
        value: COLLATERAL,
        script: sdk.payToScriptHashScript(sealedBBuilt.redeem),
        covenant: binding(sdk, 0, openedB.covenantId),
      }],
    }, () => waitRow(rpc, kaspa, b.sealed, COLLATERAL));

    const goodB = priceArgs(oracle, MINT_CENTS, wallets.one.pub, false);
    const mintedBBuilt = compile(b.minted);
    const noteBBuilt = compile(b.note);
    const mintedB = await accept("mint-b", "mintedB", wallets.two, {
      feeNeed: CARRIER + FEE_FLOOR,
      lockTime: goodB.window.lockTime,
      covenantRows: [sealedB.row],
      sigs: [{ index: 0, built: sealedB.built, entry: "mint", key: wallets.two.key, args: goodB.args }],
      fixed: (sdk) => [
        { value: COLLATERAL, script: sdk.payToScriptHashScript(mintedBBuilt.redeem), covenant: binding(sdk, 0, sealedB.covenantId) },
        { value: CARRIER, script: sdk.payToScriptHashScript(noteBBuilt.redeem), covenant: binding(sdk, 0, sealedB.covenantId) },
      ],
    }, async () => {
      const vault = await waitRow(rpc, kaspa, b.minted, COLLATERAL);
      const note = await waitRow(rpc, kaspa, b.note, CARRIER);
      return { vault, note };
    });
    say(`mint-b vault=${mintedB.vault.covenantId} note=${mintedB.note.covenantId}`);
    if (minted.vault.covenantId === mintedB.vault.covenantId) throw new Error("the two vaults share a covenant id");

    const redeemedBuilt = compile(a.redeemed);
    await reject("reject-wrong-pay-a", "rejectedWrongPay", wallets.two, {
      feeNeed: FEE_FLOOR,
      lockTime: 0,
      covenantRows: [minted.vault.row, minted.note.row],
      sigs: [
        { index: 0, built: minted.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
        { index: 1, built: minted.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
      ],
      fixed: (sdk) => [
        { value: WRONG_LEFT, script: sdk.payToScriptHashScript(redeemedBuilt.redeem), covenant: binding(sdk, 0, minted.vault.covenantId) },
        { value: WRONG_PAY, script: sdk.payToAddressScript(wallets.two.address) },
        { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
      ],
    });

    await reject("reject-cross-redeem", "rejectedCross", wallets.one, {
      feeNeed: FEE_FLOOR,
      lockTime: 0,
      covenantRows: [minted.vault.row, mintedB.note.row],
      sigs: [
        { index: 0, built: minted.vault.built, entry: "vaultRedeem", key: wallets.one.key, args: [] },
        { index: 1, built: mintedB.note.built, entry: "noteRedeem", key: wallets.one.key, args: ["OWNER"] },
      ],
      fixed: (sdk) => [
        { value: SURPLUS, script: sdk.payToScriptHashScript(redeemedBuilt.redeem), covenant: binding(sdk, 0, minted.vault.covenantId) },
        { value: PAY, script: sdk.payToAddressScript(wallets.one.address) },
        { value: CARRIER, script: sdk.payToAddressScript(wallets.one.address) },
      ],
    });

    async function redeem(label, phase, pair, holder, locker, redeemedState) {
      const built = compile(redeemedState);
      const found = await accept(label, phase, holder, {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [pair.vault.row, pair.note.row],
        sigs: [
          { index: 0, built: pair.vault.built, entry: "vaultRedeem", key: holder.key, args: [] },
          { index: 1, built: pair.note.built, entry: "noteRedeem", key: holder.key, args: ["OWNER"] },
        ],
        fixed: (sdk) => [
          { value: SURPLUS, script: sdk.payToScriptHashScript(built.redeem), covenant: binding(sdk, 0, pair.vault.covenantId) },
          { value: PAY, script: sdk.payToAddressScript(holder.address) },
          { value: CARRIER, script: sdk.payToAddressScript(holder.address) },
        ],
      }, async () => {
        const vault = await waitRow(rpc, kaspa, redeemedState, SURPLUS);
        const txid = state[phase].txid;
        const pays = await waitPay(rpc, holder.address, txid, [PAY, CARRIER]);
        return { vault, pays, txid };
      });
      if (BigInt(found.vault.row.amount) !== SURPLUS) throw new Error(`${label} surplus is ${found.vault.row.amount}`);
      const amounts = found.pays.map((row) => BigInt(row.amount));
      if (!amounts.includes(PAY) || !amounts.includes(CARRIER)) throw new Error(`${label} payments ${found.pays.map((row) => row.amount).join(",")}`);
      say(`${label} surplus=${found.vault.row.amount} pays=${found.pays.map((row) => row.amount).join(",")} txid=${found.txid}`);
      say(`${label} locker ${locker.address} still owns the surplus covenant ${found.vault.covenantId}`);
      return found;
    }

    const redeemedA = await redeem("redeem-a", "redeemedA", minted, wallets.two, wallets.one, a.redeemed);
    const redeemedB = await redeem("redeem-b", "redeemedB", mintedB, wallets.one, wallets.two, b.redeemed);
    const end = await dagOf(rpc);
    const summary = {
      network: NETWORK,
      url: URL,
      virtualDaa: end.virtualDaa.toString(),
      sink: end.sink,
      redeemA: redeemedA.txid,
      redeemB: redeemedB.txid,
      surplus: SURPLUS.toString(),
      pay: PAY.toString(),
      carrier: CARRIER.toString(),
      covenantA: redeemedA.vault.covenantId,
      covenantB: redeemedB.vault.covenantId,
    };
    saveJson(join(RESULTS, "devnet-peg-summary.json"), summary);
    journal({ label: "summary", ...summary });
    say(`RESULT ${JSON.stringify(summary)}`);
  } finally {
    await rpc.disconnect();
  }
}

main().catch((error) => {
  say(error && error.stack ? error.stack : error);
  process.exit(1);
});
