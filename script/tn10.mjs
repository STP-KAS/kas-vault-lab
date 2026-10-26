// TN10 vault lab driver. Testnet-10 only.
// Prints addresses, txids, and node errors. Never prints a private key.
// KASPA_WASM and SILVERC come from the environment.

import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { signPrice } from "./oracle.mjs";
import { encodeEntry, withRedeem } from "./sigscript.mjs";

const NETWORK = "testnet-10";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "contracts", "vault.sil");
const LOCAL = join(ROOT, ".local");
const RESULTS = join(ROOT, "results");
const KEYS = join(LOCAL, "keys.json");
const STATE = join(RESULTS, "state.json");
const JOURNAL = join(RESULTS, "journal.jsonl");
const HEALTH_URL = "https://api-tn10.kaspa.org/info/health";
const FAUCET_OFFICIAL = "https://faucet-tn10.kaspanet.io/";
const FAUCET_DEMO = "https://kaspa-demo-faucet.parker2017.workers.dev/api/faucet";
const COLLATERAL = 300_000_000n;
const CARRIER = 20_000_000n;
const DUST = 20_000_000n;
const FEE_FLOOR = 2_000_000n;
const RATIO = 20000;
const LIQ = 15000;
const BONUS = 500;
const MINT_CENTS = 100;
const TOO_MUCH = 200;
const MINT_PRICE = 100_000_000;
const CRASH_PRICE = 250_000_000;
const TAKE_OK = 50_000_000n;
const TAKE_BAD = 150_000_000n;
const ZERO = "00".repeat(32);

const PHASES = [
  "start",
  "openedA",
  "sealedA",
  "mintRejectsDone",
  "mintedA",
  "withdrawRejectsDone",
  "withdrewA",
  "repaidA",
  "openedB",
  "sealedB",
  "mintedB",
  "liquidatedB",
];

function need(name, value) {
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hexOf(value) {
  return String(value).replace(/^0x/, "").trim().toLowerCase();
}

function stamps(date = new Date()) {
  const berlin = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(date);
  return { utc: date.toISOString(), berlin };
}

function say(text) {
  process.stdout.write(`${text}\n`);
}

function journal(row) {
  mkdirSync(RESULTS, { recursive: true });
  appendFileSync(JOURNAL, JSON.stringify({ ...stamps(), ...row }) + "\n");
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
  if (fairSompi(100, MINT_PRICE) !== 100_000_000n) throw new Error("fair 100");
  if (atRatio(100, MINT_PRICE, RATIO) !== 200_000_000n) throw new Error("mint need");
  if (atRatio(TOO_MUCH, MINT_PRICE, RATIO) !== 400_000_000n) throw new Error("over mint need");
  if (atRatio(100, CRASH_PRICE, LIQ) !== 375_000_000n) throw new Error("liq need");
  if (atRatio(100, CRASH_PRICE, 10000 + BONUS) !== 262_500_000n) throw new Error("seize cap");
  const left = COLLATERAL - 50_000_000n;
  if (left < atRatio(100, MINT_PRICE, RATIO)) throw new Error("withdraw 50 should stay solvent");
  const badLeft = COLLATERAL - TAKE_BAD;
  if (badLeft >= atRatio(100, MINT_PRICE, RATIO)) throw new Error("withdraw 150 should break the ratio");
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

const LOCK_TIME_THRESHOLD = 500_000_000_000;

function windowFor(nowMs, stale) {
  const lockTime = nowMs - 180_000;
  if (lockTime < LOCK_TIME_THRESHOLD) throw new Error("lock time would be read as a DAA score");
  if (!stale) {
    const notBefore = lockTime - 60_000;
    const expiry = notBefore + 3_600_000;
    if (expiry - notBefore > 3_600_000) throw new Error("price window is too wide");
    return { lockTime, notBefore, expiry };
  }
  const expiry = lockTime - 30_000;
  return { lockTime, notBefore: expiry - 3_600_000, expiry };
}

function ctorJson(state) {
  const bytes = (hex) => [...Buffer.from(hexOf(hex), "hex")];
  return [
    { kind: "int", value: state.amount },
    { kind: "bytes", value: bytes(state.owner) },
    { kind: "byte", value: state.ownerScheme },
    { kind: "byte", value: state.borrowScheme },
    { kind: "bytes", value: bytes(state.borrowGuard) },
    { kind: "bytes", value: bytes(state.extension) },
    { kind: "int", value: state.kind },
    { kind: "int", value: state.debt },
    { kind: "bytes", value: bytes(state.oracle) },
    { kind: "int", value: state.ratioBps },
    { kind: "int", value: state.liqBps },
    { kind: "int", value: state.bonusBps },
    { kind: "int", value: state.sealed },
  ];
}

function baseState(keys, extension) {
  return {
    amount: 0,
    owner: keys.ownerPub,
    ownerScheme: 0,
    borrowScheme: 0,
    borrowGuard: ZERO,
    extension,
    kind: 1,
    debt: 0,
    oracle: keys.oraclePub,
    ratioBps: RATIO,
    liqBps: LIQ,
    bonusBps: BONUS,
    sealed: 0,
  };
}

const compiled = new Map();

function compile(state) {
  const key = JSON.stringify(state);
  const hit = compiled.get(key);
  if (hit) return hit;
  const dir = join(tmpdir(), "kas-vault-lab");
  mkdirSync(dir, { recursive: true });
  const argsPath = join(dir, `args-${randomBytes(4).toString("hex")}.json`);
  const outPath = join(dir, `vault-${randomBytes(4).toString("hex")}.json`);
  writeFileSync(argsPath, JSON.stringify(ctorJson(state)));
  const result = spawnSync(need("SILVERC", process.env.SILVERC), [SOURCE, "--constructor-args", argsPath, "-o", outPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "silverc failed");
  const artifact = JSON.parse(readFileSync(outPath, "utf8"));
  const bytes = artifact.contracts?.Vault?.compiled?.bytecode;
  if (!Array.isArray(bytes) || !bytes.length) throw new Error("silverc emitted no bytecode");
  const redeem = Buffer.from(bytes);
  const row = { artifact, redeem };
  compiled.set(key, row);
  return row;
}

async function loadKaspa() {
  const wasm = need("KASPA_WASM", process.env.KASPA_WASM);
  const require = createRequire(wasm);
  globalThis.WebSocket = require("websocket").w3cwebsocket;
  return import(pathToFileURL(wasm).href);
}

function pubOf(kaspa, key) {
  return hexOf(key.toPublicKey().toXOnlyPublicKey().toString());
}

function addressOf(kaspa, key) {
  const address = key.toAddress(NETWORK).toString();
  if (!address.startsWith("kaspatest:")) throw new Error("derived address is not testnet-10");
  return address;
}

function ensureKeys(kaspa) {
  mkdirSync(LOCAL, { recursive: true });
  let saved = loadJson(KEYS, null);
  if (!saved) {
    saved = {
      network: NETWORK,
      owner: randomBytes(32).toString("hex"),
      oracle: randomBytes(32).toString("hex"),
      liquidator: randomBytes(32).toString("hex"),
      extensionA: randomBytes(32).toString("hex"),
      extensionB: randomBytes(32).toString("hex"),
    };
    saveJson(KEYS, saved);
  }
  if (saved.network !== NETWORK) throw new Error("key file is not testnet-10");
  const owner = new kaspa.PrivateKey(saved.owner);
  const oracle = new kaspa.PrivateKey(saved.oracle);
  const liquidator = new kaspa.PrivateKey(saved.liquidator);
  const keys = {
    owner,
    oracle,
    liquidator,
    ownerPub: pubOf(kaspa, owner),
    oraclePub: pubOf(kaspa, oracle),
    liquidatorPub: pubOf(kaspa, liquidator),
    ownerAddress: addressOf(kaspa, owner),
    liquidatorAddress: addressOf(kaspa, liquidator),
    extensionA: hexOf(saved.extensionA),
    extensionB: hexOf(saved.extensionB),
  };
  const noble = signPrice(1, 1, 2, Buffer.from(saved.oracle, "hex")).pub.toString("hex");
  if (noble !== keys.oraclePub) throw new Error("oracle pubkey mismatch");
  return keys;
}

async function sampleHealth() {
  const started = new Date();
  const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  const servers = body.kaspadServers || [];
  return {
    ...stamps(started),
    http: response.status,
    p2pIds: servers.map((server) => server.p2pId),
    serverVersion: servers[0] && servers[0].serverVersion,
    isSynced: servers[0] && servers[0].isSynced,
    isUtxoIndexed: servers[0] && servers[0].isUtxoIndexed,
    serverBlueScore: servers[0] && servers[0].blueScore,
    databaseBlueScore: body.database && body.database.blueScore,
  };
}

async function connectRpc(kaspa) {
  const net = new kaspa.NetworkId(NETWORK);
  const rpc = new kaspa.RpcClient({
    resolver: new kaspa.Resolver(),
    encoding: kaspa.Encoding.Borsh,
    networkId: net,
  });
  await rpc.connect();
  const info = await rpc.getServerInfo();
  if (!String(info.networkId).includes(NETWORK)) throw new Error("resolver is not testnet-10");
  if (info.isSynced !== true) throw new Error("resolver node is not synced");
  return { rpc, info };
}

function covOf(row) {
  const id = row.entry && row.entry.covenantId;
  return id ? hexOf(id.toString()) : "";
}

function scriptHex(spk) {
  if (!spk) return "";
  return hexOf(spk.script);
}

async function utxosOf(rpc, address) {
  const bag = await rpc.getUtxosByAddresses([address]);
  return bag.entries || [];
}

function p2pkRows(rows, ownerScript) {
  return rows.filter((row) => !covOf(row) && !row.isCoinbase && scriptHex(row.scriptPublicKey) === ownerScript);
}

function pickCoin(rows, ownerScript, need, avoid) {
  const fit = p2pkRows(rows, ownerScript)
    .filter((row) => !avoid.has(idOf(row)) && BigInt(row.amount) >= need)
    .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? -1 : 1));
  if (!fit.length) throw new Error(`no spendable coin covers ${need} sompi`);
  return fit[0];
}

function idOf(row) {
  return `${hexOf(row.outpoint.transactionId)}:${row.outpoint.index}`;
}

function sumP2pk(rows, ownerScript) {
  return p2pkRows(rows, ownerScript).reduce((sum, row) => sum + BigInt(row.amount), 0n);
}

async function findVault(rpc, kaspa, state) {
  const built = compile(state);
  const address = kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) > 0n);
  if (!hit) throw new Error(`vault output is not visible at ${address}`);
  return { built, address, row: hit, covenantId: covOf(hit) };
}

function inputOf(row, budget) {
  return {
    previousOutpoint: { transactionId: row.outpoint.transactionId, index: row.outpoint.index },
    signatureScript: "",
    sequence: 0n,
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

function blankSig() {
  const bytes = Buffer.alloc(65);
  bytes[64] = 1;
  return bytes;
}

function entryScript(kaspa, built, entry, args) {
  const action = encodeEntry(kaspa, built.artifact, entry, args);
  return withRedeem(kaspa, action, built.redeem);
}

async function submitOnce(kaspa, rpc, spec) {
  const health = await sampleHealth();
  let fee = FEE_FLOOR;
  let budget = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const fixed = spec.fixed(kaspa);
    const inputSum = spec.covenantRows.reduce((sum, row) => sum + BigInt(row.amount), 0n) + BigInt(spec.feeRow.amount);
    const fixedSum = fixed.reduce((sum, item) => sum + BigInt(item.value), 0n);
    const change = inputSum - fixedSum - fee;
    if (change < 1000n) throw new Error(`${spec.label} change would be ${change}`);
    const outputs = [...fixed, { value: change, script: spec.changeScript, covenant: null }].map((item) =>
      outputOf(kaspa, item.value, item.script, item.covenant),
    );
    const inputs = [
      ...spec.covenantRows.map((row) => inputOf(row, budget)),
      inputOf(spec.feeRow, 0),
    ];
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
    for (const input of tx.inputs) input.computeBudget = 0;
    for (let i = 0; i < spec.covenantRows.length; i += 1) tx.inputs[i].computeBudget = budget;
    for (const sig of spec.sigs) {
      const args = sig.args.map((arg) => (arg === "OWNER" ? blankSig() : arg));
      tx.inputs[sig.index].signatureScript = entryScript(kaspa, sig.built, sig.entry, args);
    }
    let required = 0n;
    try {
      const quote = kaspa.calculateTransactionFee(NETWORK, tx);
      if (quote != null) required = BigInt(quote);
    } catch {
      required = FEE_FLOOR;
    }
    if (fee < required) {
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
    tx.inputs[feeIndex].computeBudget = 0;
    tx.finalize();
    try {
      const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
      const id = hexOf(result.transactionId || tx.id);
      const bound = tx.outputs[0] && tx.outputs[0].covenant;
      return {
        id,
        fee: fee.toString(),
        budget,
        health,
        attempt,
        covenantId: bound ? hexOf(bound.covenantId.toString()) : "",
      };
    } catch (error) {
      lastError = String(error && error.message ? error.message : error);
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
      failure.health = health;
      failure.rejected = true;
      throw failure;
    }
  }
  const failure = new Error(lastError || `${spec.label} was not accepted`);
  failure.rejected = true;
  throw failure;
}

function record(state, row) {
  state.steps.push(row);
  saveJson(STATE, state);
  journal(row);
  const tail = row.txid ? ` ${row.txid}` : "";
  say(`${row.label} ${row.observed}${tail}`);
}

async function expectReject(state, label, action) {
  try {
    const sent = await action();
    record(state, {
      label,
      expected: "reject",
      observed: "accepted",
      txid: sent.id,
      health: sent.health,
    });
    throw new Error(`${label} was accepted`);
  } catch (error) {
    if (!error.rejected) throw error;
    if (/insufficient fee|fee rate|feerate|\bmass\b|orphan|not synced|compute budget|signature script length|not final|ECONN|timed out|socket hang/i.test(error.message)) {
      throw error;
    }
    record(state, {
      label,
      expected: "reject",
      observed: "rejected",
      error: String(error.message).slice(0, 500),
      health: error.health || null,
    });
  }
}

async function expectAccept(state, label, action) {
  const sent = await action();
  record(state, {
    label,
    expected: "accept",
    observed: "accepted",
    txid: sent.id,
    fee: sent.fee,
    budget: sent.budget,
    health: sent.health,
    links: {
      api: `https://api-tn10.kaspa.org/transactions/${sent.id}`,
      explorer: `https://explorer-tn10.kaspa.org/txs/${sent.id}`,
    },
  });
  return sent;
}

async function waitRow(rpc, kaspa, contractState, amount) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const found = await findVault(rpc, kaspa, contractState);
      if (BigInt(found.row.amount) === amount) return found;
    } catch {
      // not visible yet
    }
    await sleep(1500);
  }
  throw new Error("vault output did not appear");
}

async function waitCoin(rpc, address, txid) {
  const id = hexOf(txid);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await utxosOf(rpc, address);
    if (rows.some((row) => hexOf(row.outpoint.transactionId) === id)) return;
    await sleep(1500);
  }
  throw new Error("payment output did not appear");
}

function priceArgs(keys, cents, noteOwner, stale) {
  const window = windowFor(Date.now(), stale);
  const signed = signPrice(MINT_PRICE, window.notBefore, window.expiry, keys.oraclePriv);
  return {
    window,
    datasig: signed.sig,
    args: [cents, Buffer.from(noteOwner, "hex"), MINT_PRICE, window.notBefore, window.expiry, signed.sig, "OWNER"],
  };
}

function crashArgs(keys) {
  const window = windowFor(Date.now(), false);
  const signed = signPrice(CRASH_PRICE, window.notBefore, window.expiry, keys.oraclePriv);
  return {
    window,
    datasig: signed.sig,
    common: [CRASH_PRICE, window.notBefore, window.expiry, signed.sig],
  };
}

async function tryOfficialFaucet(address) {
  try {
    const response = await fetch(FAUCET_OFFICIAL, { signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    return { ok: false, status: response.status, cloudflare: text.includes("Just a moment") };
  } catch (error) {
    return { ok: false, error: String(error.message || error).slice(0, 200) };
  }
}

async function faucetStatus() {
  const response = await fetch(`${new URL(FAUCET_DEMO).origin}/api/status`, {
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  return { http: response.status, body };
}

async function tryDemoFaucet(address) {
  const requestId = randomUUID();
  let last = "faucet did not answer";
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    const status = await faucetStatus();
    const pending = status.body && status.body.pending;
    journal({
      label: "faucet-status",
      http: status.http,
      pending: pending ?? null,
      enabled: status.body && status.body.enabled,
      remainingClaims: status.body && status.body.remainingClaims,
      claims: status.body && status.body.claims,
    });
    if (pending) {
      last = `demo faucet pending stayed ${pending}`;
      say(`faucet pending, wait ${attempt}`);
      if (attempt === 90) break;
      await sleep(20000);
      continue;
    }
    const response = await fetch(FAUCET_DEMO, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://kaspaexplained.com",
      },
      body: JSON.stringify({ address, requestId }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (response.ok && body.transactionId) {
      if (body.network && body.network !== NETWORK) throw new Error("faucet network is not testnet-10");
      return { txid: hexOf(body.transactionId), amount: body.amount || null, requestId };
    }
    last = body.error || `faucet http ${response.status}`;
    if (!/try again|being funded/i.test(last) || attempt === 90) break;
    say(`faucet busy, retry ${attempt}`);
    await sleep(20000);
  }
  throw new Error(last);
}

async function main() {
  const command = process.argv[2] || "run";
  assertMath();
  if (command === "math") {
    say("math ok");
    return;
  }
  const kaspa = await loadKaspa();
  const keys = ensureKeys(kaspa);
  keys.oraclePriv = Buffer.from(loadJson(KEYS, {}).oracle, "hex");
  if (command === "address") {
    say(`owner ${keys.ownerAddress}`);
    say(`liquidator ${keys.liquidatorAddress}`);
    say(`oracle ${keys.oraclePub}`);
    return;
  }
  if (command === "compile") {
    const built = compile({ ...baseState(keys, keys.extensionA), sealed: 0 });
    const address = kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
    say(`compile bytes ${built.redeem.length}`);
    say(`open address ${address}`);
    return;
  }
  const health = await sampleHealth();
  journal({ label: "health", ...health });
  say(`health ${health.utc} p2p ${health.p2pIds.join(",")}`);
  if (command === "health") return;

  const { rpc, info } = await connectRpc(kaspa);
  try {
    say(`rpc ${info.serverVersion} daa ${info.virtualDaaScore}`);
    const ownerScript = scriptHex(kaspa.payToAddressScript(keys.ownerAddress));
    if (command === "balance") {
      const rows = await utxosOf(rpc, keys.ownerAddress);
      say(`balance ${sumP2pk(rows, ownerScript)} sompi across ${p2pkRows(rows, ownerScript).length} coins`);
      return;
    }
    if (command === "faucet" || command === "run") {
      const rows = await utxosOf(rpc, keys.ownerAddress);
      const have = sumP2pk(rows, ownerScript);
      const need = COLLATERAL * 2n + CARRIER * 2n + 50_000_000n;
      if (have < need) {
        const official = await tryOfficialFaucet(keys.ownerAddress);
        journal({ label: "faucet-official", ...official, address: keys.ownerAddress });
        say(`official faucet ok=${official.ok === true} cloudflare=${official.cloudflare === true}`);
        const paid = await tryDemoFaucet(keys.ownerAddress);
        journal({ label: "faucet-demo", txid: paid.txid, amount: paid.amount, address: keys.ownerAddress });
        say(`faucet ${paid.txid}`);
        await waitCoin(rpc, keys.ownerAddress, paid.txid);
      } else if (command === "faucet") {
        say(`balance ${have} sompi already covers the run`);
      }
    }
    if (command === "faucet") return;
    if (command !== "run") throw new Error(`unknown command ${command}`);

    const state = loadJson(STATE, {
      phase: "start",
      ownerAddress: keys.ownerAddress,
      liquidatorAddress: keys.liquidatorAddress,
      oraclePub: keys.oraclePub,
      extensionA: keys.extensionA,
      extensionB: keys.extensionB,
      steps: [],
    });
    if (state.ownerAddress !== keys.ownerAddress) throw new Error("state file belongs to another address");

    const ownerSpk = kaspa.payToAddressScript(keys.ownerAddress);
    const liquidatorSpk = kaspa.payToAddressScript(keys.liquidatorAddress);
    async function coins() {
      return utxosOf(rpc, keys.ownerAddress);
    }

    async function send(label, spec) {
      const feeRow = pickCoin(await coins(), ownerScript, spec.feeNeed, new Set());
      return submitOnce(kaspa, rpc, { ...spec, label, feeRow, feeKey: keys.owner });
    }

    function noteState(ownerPub, extension) {
      return {
        ...baseState(keys, extension),
        amount: MINT_CENTS,
        owner: ownerPub,
        kind: 2,
        debt: 0,
        sealed: 1,
      };
    }

    function vaultAt(extension, debt, sealed, amount = 0, kind = 1, owner = keys.ownerPub) {
      return { ...baseState(keys, extension), amount, owner, kind, debt, sealed };
    }

    async function openVault(label, extension, phase) {
      const openState = vaultAt(extension, 0, 0);
      const built = compile(openState);
      const spk = kaspa.payToScriptHashScript(built.redeem);
      const sent = await expectAccept(state, label, () => send(label, {
        feeNeed: COLLATERAL + FEE_FLOOR,
        lockTime: 0,
        genesis: true,
        genesisOutputs: [0],
        covenantRows: [],
        sigs: [],
        changeScript: ownerSpk,
        fixed: () => [{ value: COLLATERAL, script: spk }],
      }));
      const found = await waitRow(rpc, kaspa, openState, COLLATERAL);
      if (!found.covenantId) throw new Error(`${label} utxo has no covenant id`);
      if (sent.covenantId && found.covenantId !== sent.covenantId) {
        throw new Error(`${label} covenant id mismatch`);
      }
      state.phase = phase;
      state[label] = { covenantId: found.covenantId, value: COLLATERAL.toString() };
      saveJson(STATE, state);
      return found;
    }

    if (!phaseAtLeast(state, "openedA")) await openVault("open-a", keys.extensionA, "openedA");

    let vault = null;
    if (!phaseAtLeast(state, "sealedA")) {
      vault = await waitRow(rpc, kaspa, vaultAt(keys.extensionA, 0, 0), COLLATERAL);
      const next = vaultAt(keys.extensionA, 0, 1);
      const builtNext = compile(next);
      await expectAccept(state, "seal-a", () => send("seal-a", {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "seal", key: keys.owner, args: ["OWNER"] }],
        fixed: (sdk) => [{
          value: COLLATERAL,
          script: sdk.payToScriptHashScript(builtNext.redeem),
          covenant: binding(sdk, 0, vault.covenantId),
        }],
      }));
      state.phase = "sealedA";
      saveJson(STATE, state);
      vault = await waitRow(rpc, kaspa, next, COLLATERAL);
    }

    const sealed = vaultAt(keys.extensionA, 0, 1);
    if (!phaseAtLeast(state, "mintRejectsDone")) {
      vault = await waitRow(rpc, kaspa, sealed, COLLATERAL);
      const minted = vaultAt(keys.extensionA, MINT_CENTS, 1);
      const note = noteState(keys.ownerPub, keys.extensionA);
      const vaultNext = compile(minted);
      const noteNext = compile(note);
      const mintFixed = (sdk) => [
        { value: COLLATERAL, script: sdk.payToScriptHashScript(vaultNext.redeem), covenant: binding(sdk, 0, vault.covenantId) },
        { value: CARRIER, script: sdk.payToScriptHashScript(noteNext.redeem), covenant: binding(sdk, 0, vault.covenantId) },
      ];
      const badPrice = priceArgs(keys, MINT_CENTS, keys.ownerPub, false);
      badPrice.args[5] = Buffer.alloc(64, 2);
      await expectReject(state, "reject-bad-oracle", () => send("reject-bad-oracle", {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: badPrice.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "mint", key: keys.owner, args: badPrice.args }],
        fixed: mintFixed,
      }));
      const stale = priceArgs(keys, MINT_CENTS, keys.ownerPub, true);
      await expectReject(state, "reject-stale-price", () => send("reject-stale-price", {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: stale.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "mint", key: keys.owner, args: stale.args }],
        fixed: mintFixed,
      }));
      const over = priceArgs(keys, TOO_MUCH, keys.ownerPub, false);
      const overVault = compile(vaultAt(keys.extensionA, TOO_MUCH, 1));
      const overNote = compile({ ...note, amount: TOO_MUCH });
      await expectReject(state, "reject-mint-above-ratio", () => send("reject-mint-above-ratio", {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: over.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "mint", key: keys.owner, args: over.args }],
        fixed: (sdk) => [
          { value: COLLATERAL, script: sdk.payToScriptHashScript(overVault.redeem), covenant: binding(sdk, 0, vault.covenantId) },
          { value: CARRIER, script: sdk.payToScriptHashScript(overNote.redeem), covenant: binding(sdk, 0, vault.covenantId) },
        ],
      }));
      state.phase = "mintRejectsDone";
      saveJson(STATE, state);
    }

    if (!phaseAtLeast(state, "mintedA")) {
      vault = await waitRow(rpc, kaspa, sealed, COLLATERAL);
      const good = priceArgs(keys, MINT_CENTS, keys.ownerPub, false);
      const minted = vaultAt(keys.extensionA, MINT_CENTS, 1);
      const note = noteState(keys.ownerPub, keys.extensionA);
      const vaultNext = compile(minted);
      const noteNext = compile(note);
      await expectAccept(state, "mint-a", () => send("mint-a", {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: good.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "mint", key: keys.owner, args: good.args }],
        fixed: (sdk) => [
          { value: COLLATERAL, script: sdk.payToScriptHashScript(vaultNext.redeem), covenant: binding(sdk, 0, vault.covenantId) },
          { value: CARRIER, script: sdk.payToScriptHashScript(noteNext.redeem), covenant: binding(sdk, 0, vault.covenantId) },
        ],
      }));
      state.phase = "mintedA";
      saveJson(STATE, state);
      await waitRow(rpc, kaspa, minted, COLLATERAL);
      await waitRow(rpc, kaspa, note, CARRIER);
    }

    const debtState = vaultAt(keys.extensionA, MINT_CENTS, 1);
    const noteA = noteState(keys.ownerPub, keys.extensionA);

    if (!phaseAtLeast(state, "withdrawRejectsDone")) {
      vault = await waitRow(rpc, kaspa, debtState, COLLATERAL);
      const quote = priceArgs(keys, MINT_CENTS, keys.ownerPub, false);
      const withdrawArgs = [Number(TAKE_BAD), MINT_PRICE, quote.window.notBefore, quote.window.expiry, quote.datasig, "OWNER"];
      const left = COLLATERAL - TAKE_BAD;
      const next = compile(debtState);
      await expectReject(state, "reject-withdraw-breaks-ratio", () => send("reject-withdraw-breaks-ratio", {
        feeNeed: FEE_FLOOR,
        lockTime: quote.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vault.built, entry: "withdraw", key: keys.owner, args: withdrawArgs }],
        fixed: (sdk) => [{
          value: left,
          script: sdk.payToScriptHashScript(next.redeem),
          covenant: binding(sdk, 0, vault.covenantId),
        }],
      }));
      const forgedQuote = priceArgs(keys, MINT_CENTS, keys.ownerPub, false);
      const forgedLeft = COLLATERAL - TAKE_OK;
      await expectReject(state, "reject-forged-successor", () => send("reject-forged-successor", {
        feeNeed: FEE_FLOOR,
        lockTime: forgedQuote.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{
          index: 0,
          built: vault.built,
          entry: "withdraw",
          key: keys.owner,
          args: [Number(TAKE_OK), MINT_PRICE, forgedQuote.window.notBefore, forgedQuote.window.expiry, forgedQuote.datasig, "OWNER"],
        }],
        fixed: (sdk) => [{
          value: forgedLeft,
          script: ownerSpk,
          covenant: binding(sdk, 0, vault.covenantId),
        }],
      }));
      state.phase = "withdrawRejectsDone";
      saveJson(STATE, state);
    }

    if (!phaseAtLeast(state, "withdrewA")) {
      vault = await waitRow(rpc, kaspa, debtState, COLLATERAL);
      const quote = priceArgs(keys, MINT_CENTS, keys.ownerPub, false);
      const left = COLLATERAL - TAKE_OK;
      const next = compile(debtState);
      await expectAccept(state, "withdraw-a", () => send("withdraw-a", {
        feeNeed: FEE_FLOOR,
        lockTime: quote.window.lockTime,
        covenantRows: [vault.row],
        changeScript: ownerSpk,
        sigs: [{
          index: 0,
          built: vault.built,
          entry: "withdraw",
          key: keys.owner,
          args: [Number(TAKE_OK), MINT_PRICE, quote.window.notBefore, quote.window.expiry, quote.datasig, "OWNER"],
        }],
        fixed: (sdk) => [{
          value: left,
          script: sdk.payToScriptHashScript(next.redeem),
          covenant: binding(sdk, 0, vault.covenantId),
        }],
      }));
      state.phase = "withdrewA";
      saveJson(STATE, state);
      await waitRow(rpc, kaspa, debtState, left);
    }

    if (!phaseAtLeast(state, "repaidA")) {
      const left = COLLATERAL - TAKE_OK;
      vault = await waitRow(rpc, kaspa, debtState, left);
      const note = await waitRow(rpc, kaspa, noteA, CARRIER);
      const cleared = vaultAt(keys.extensionA, 0, 1);
      const next = compile(cleared);
      await expectAccept(state, "repay-a", () => send("repay-a", {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [vault.row, note.row],
        changeScript: ownerSpk,
        sigs: [
          { index: 0, built: vault.built, entry: "vaultRepay", key: keys.owner, args: [] },
          { index: 1, built: note.built, entry: "noteBurn", key: keys.owner, args: ["OWNER"] },
        ],
        fixed: (sdk) => [{
          value: left,
          script: sdk.payToScriptHashScript(next.redeem),
          covenant: binding(sdk, 0, vault.covenantId),
        }],
      }));
      state.phase = "repaidA";
      saveJson(STATE, state);
      await waitRow(rpc, kaspa, cleared, left);
    }

    if (!phaseAtLeast(state, "openedB")) await openVault("open-b", keys.extensionB, "openedB");

    let vaultB = null;
    if (!phaseAtLeast(state, "sealedB")) {
      const next = vaultAt(keys.extensionB, 0, 1);
      const builtNext = compile(next);
      vaultB = await waitRow(rpc, kaspa, vaultAt(keys.extensionB, 0, 0), COLLATERAL);
      await expectAccept(state, "seal-b", () => send("seal-b", {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [vaultB.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vaultB.built, entry: "seal", key: keys.owner, args: ["OWNER"] }],
        fixed: (sdk) => [{
          value: COLLATERAL,
          script: sdk.payToScriptHashScript(builtNext.redeem),
          covenant: binding(sdk, 0, vaultB.covenantId),
        }],
      }));
      state.phase = "sealedB";
      saveJson(STATE, state);
    }

    const sealedB = vaultAt(keys.extensionB, 0, 1);
    const debtB = vaultAt(keys.extensionB, MINT_CENTS, 1);
    const noteB = noteState(keys.liquidatorPub, keys.extensionB);
    if (!phaseAtLeast(state, "mintedB")) {
      vaultB = await waitRow(rpc, kaspa, sealedB, COLLATERAL);
      const good = priceArgs(keys, MINT_CENTS, keys.liquidatorPub, false);
      const vaultNext = compile(debtB);
      const noteNext = compile(noteB);
      await expectAccept(state, "mint-b", () => send("mint-b", {
        feeNeed: CARRIER + FEE_FLOOR,
        lockTime: good.window.lockTime,
        covenantRows: [vaultB.row],
        changeScript: ownerSpk,
        sigs: [{ index: 0, built: vaultB.built, entry: "mint", key: keys.owner, args: good.args }],
        fixed: (sdk) => [
          { value: COLLATERAL, script: sdk.payToScriptHashScript(vaultNext.redeem), covenant: binding(sdk, 0, vaultB.covenantId) },
          { value: CARRIER, script: sdk.payToScriptHashScript(noteNext.redeem), covenant: binding(sdk, 0, vaultB.covenantId) },
        ],
      }));
      state.phase = "mintedB";
      saveJson(STATE, state);
      await waitRow(rpc, kaspa, debtB, COLLATERAL);
      await waitRow(rpc, kaspa, noteB, CARRIER);
    }

    if (!phaseAtLeast(state, "liquidatedB")) {
      vaultB = await waitRow(rpc, kaspa, debtB, COLLATERAL);
      const note = await waitRow(rpc, kaspa, noteB, CARRIER);
      const crash = crashArgs(keys);
      const cap = atRatio(MINT_CENTS, CRASH_PRICE, 10000 + BONUS);
      const seized = cap;
      const left = COLLATERAL - cap;
      if (COLLATERAL < cap + DUST) throw new Error("liquidation collateral is below the seize rule");
      const cleared = vaultAt(keys.extensionB, 0, 1);
      const next = compile(cleared);
      await expectAccept(state, "liquidate-b", () => send("liquidate-b", {
        feeNeed: FEE_FLOOR,
        lockTime: crash.window.lockTime,
        covenantRows: [vaultB.row, note.row],
        changeScript: ownerSpk,
        sigs: [
          { index: 0, built: vaultB.built, entry: "vaultLiquidate", key: keys.owner, args: crash.common },
          { index: 1, built: note.built, entry: "noteLiquidate", key: keys.liquidator, args: [...crash.common, "OWNER"] },
        ],
        fixed: (sdk) => [
          {
            value: left,
            script: sdk.payToScriptHashScript(next.redeem),
            covenant: binding(sdk, 0, vaultB.covenantId),
          },
          { value: seized, script: liquidatorSpk },
        ],
      }));
      state.phase = "liquidatedB";
      saveJson(STATE, state);
      await waitRow(rpc, kaspa, cleared, left);
    }

    say("run complete");
  } finally {
    await rpc.disconnect();
  }
}

await main();
