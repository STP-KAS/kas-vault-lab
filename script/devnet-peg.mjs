// Private devnet peg.sil driver.
// Talks only to ws://127.0.0.1:17610 and mines only through grpc://127.0.0.1:16610.
// Does not call a faucet, a resolver, or a public node.
// A confirmed redeem is a covenant UTXO on this devnet. The quote is a lab key.
// --late signs one mint, waits until that window's expiry, then submits the same bytes.
// --live mints a note and refreshes its price without the holder's signature.
// That path compiles contracts/peg-2026-11-02.sil, the script covenant A committed.
// --held compiles contracts/peg.sil on a new vault. An outstanding note keeps its quote.

import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
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
const SOURCE = join(ROOT, "contracts", "peg-2026-11-02.sil");
const FIXED = join(ROOT, "contracts", "peg.sil");
const LOCAL = join(ROOT, ".local");
const RESULTS = join(ROOT, "results");
const ORACLE_FILE = join(LOCAL, "devnet-oracle.json");
const STATE_FILE = join(LOCAL, "devnet-peg-state.json");
const HELD_FILE = join(LOCAL, "devnet-held-state.json");
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
const LATE_CENTS = 25;
const LATE_PRICE = 100_000_000;
const LATE_VALUE = 100_000_000n;
const LATE_PAY = 25_000_000n;
const LATE_LEFT = 75_000_000n;
const LATE_NEED = 50_000_000n;
const LATE_FEE = 8_000_000n;
const LATE_BUDGET = 29;
const LIVE_CENTS = 20;
const LIVE_PRICE = 100_000_000;
const LIVE_VALUE = 75_000_000n;
const LIVE_NEED = 40_000_000n;
const HIGH_PRICE = 400_000_000;
const HIGH_PAY = 80_000_000n;
const DOWN_PRICE = 200_000_000;
const DOWN_PAY = 40_000_000n;
const DOWN_LEFT = 35_000_000n;
const LIVE_FEE = 16_000_000n;
const HELD_CENTS = 20;
const HELD_PRICE = 100_000_000;
const HELD_VALUE = 100_000_000n;
const HELD_PAY = 20_000_000n;
const HELD_LEFT = 80_000_000n;
const HELD_NEED = 40_000_000n;
const HELD_FEE = 40_000_000n;
const RECORDED_COVENANTS = new Set([
  "e40a6989ec65243ee67361d334c7131776f1cea34f3913edf3d76bb74d62f44a",
  "37419615c748e6d670d1790586f7b80c7000ed110b7b7cb01f7270c89c192cf3",
]);
const ZERO = "00".repeat(32);
const LOCK_TIME_THRESHOLD = 500_000_000_000;

const HELD_PHASES = ["start", "heldOpened", "heldSealed", "heldMinted", "heldRejected", "heldRedeemed"];

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
  "lateRejected",
  "lateMinted",
  "lateRedeemed",
  "liveMinted",
  "rejectedWrongKey",
  "refreshedHigh",
  "rejectedShortLive",
  "refreshedDown",
  "redeemedLive",
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
  if (fairSompi(LATE_CENTS, LATE_PRICE) !== LATE_PAY) throw new Error("late pay");
  if (atRatio(LATE_CENTS, LATE_PRICE, RATIO) !== LATE_NEED) throw new Error("late ratio");
  if (LATE_NEED > LATE_VALUE || LATE_LEFT !== LATE_VALUE - LATE_PAY) throw new Error("late collateral");
  if (LATE_PAY < 20_000_000n || LATE_LEFT < 20_000_000n) throw new Error("late dust");
  if (fairSompi(LIVE_CENTS, LIVE_PRICE) !== 20_000_000n) throw new Error("live mint pay");
  if (atRatio(LIVE_CENTS, LIVE_PRICE, RATIO) !== LIVE_NEED) throw new Error("live mint ratio");
  if (LIVE_NEED > LIVE_VALUE) throw new Error("live mint does not fit");
  if (fairSompi(LIVE_CENTS, HIGH_PRICE) !== HIGH_PAY) throw new Error("high pay");
  if (HIGH_PAY <= LIVE_VALUE) throw new Error("high quote should not fit");
  if (fairSompi(LIVE_CENTS, DOWN_PRICE) !== DOWN_PAY) throw new Error("down pay");
  if (LIVE_VALUE - DOWN_PAY !== DOWN_LEFT || DOWN_LEFT < 20_000_000n) throw new Error("down surplus");
  if (fairSompi(HELD_CENTS, HELD_PRICE) !== HELD_PAY) throw new Error("held pay");
  if (atRatio(HELD_CENTS, HELD_PRICE, RATIO) !== HELD_NEED) throw new Error("held ratio");
  if (HELD_NEED > HELD_VALUE || HELD_VALUE - HELD_PAY !== HELD_LEFT) throw new Error("held collateral");
  if (HELD_PAY < 20_000_000n || HELD_LEFT < 20_000_000n) throw new Error("held dust");
  if (fairSompi(HELD_CENTS, HIGH_PRICE) > HELD_VALUE) throw new Error("held attack should still fit");
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

function holdWindow(nowMs) {
  const notBefore = nowMs - 5_000;
  const expiry = nowMs + 40_000;
  const lockTime = nowMs + 10_000;
  if (notBefore < LOCK_TIME_THRESHOLD) throw new Error("lock time would be read as a DAA score");
  const span = expiry - notBefore;
  if (span <= 0 || span > 3_600_000) throw new Error("held window span");
  if (lockTime < notBefore || lockTime > expiry) throw new Error("lock time outside the held window");
  return { lockTime, notBefore, expiry };
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

function compile(contractState, source = SOURCE) {
  const key = `${source}\n${JSON.stringify(contractState)}`;
  const hit = compiled.get(key);
  if (hit) return hit;
  const dir = join(tmpdir(), "kas-vault-lab-devnet");
  mkdirSync(dir, { recursive: true });
  const stamp = randomBytes(4).toString("hex");
  const argsPath = join(dir, `args-${stamp}.json`);
  const outPath = join(dir, `peg-${stamp}.json`);
  writeFileSync(argsPath, JSON.stringify(ctorJson(contractState)));
  const result = spawnSync(SILVERC, [source, "--constructor-args", argsPath, "-o", outPath], {
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
  const medianRaw = dag.pastMedianTime ?? dag.pastMedianTimestamp ?? null;
  return {
    virtualDaa: BigInt(dag.virtualDaaScore),
    blockCount: BigInt(dag.blockCount),
    headerCount: BigInt(dag.headerCount),
    sink: hexOf(dag.sink),
    tips: (dag.tipHashes || []).length,
    median: medianRaw == null ? "" : BigInt(medianRaw).toString(),
    dagKeys: Object.keys(dag).sort().join(","),
  };
}

async function blockStamp(kaspa, rpc, hash) {
  const ids = [hash];
  try {
    ids.push(new kaspa.Hash(hash));
  } catch {
    // A string hash is enough when the client accepts it.
  }
  let last = "";
  for (const id of ids) {
    try {
      const found = await rpc.getBlock({ hash: id, includeTransactions: false });
      const header = (found && found.block && found.block.header) || (found && found.header) || null;
      if (header && header.timestamp != null) return BigInt(header.timestamp).toString();
      last = "no timestamp";
    } catch (error) {
      last = hide(error && error.message ? error.message : error).slice(0, 180);
    }
  }
  return last;
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
      const namedFee = lastError.match(/required amount of (\d+)/i);
      if (namedFee) {
        const next = BigInt(namedFee[1]) + 1000n;
        if (next > fee) {
          fee = next;
          say(`${spec.label} retry node fee ${fee}`);
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
      try {
        failure.txid = hexOf(tx.id);
      } catch {
        failure.txid = "";
      }
      throw failure;
    }
  }
  const failure = new Error(lastError || `${spec.label} was not accepted`);
  failure.rejected = true;
  throw failure;
}

function buildSigned(kaspa, spec, fee, budget) {
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
  if (fee < required) return { ready: false, required, fee, change };
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
  const bound = tx.outputs[0] && tx.outputs[0].covenant;
  return {
    ready: true,
    tx,
    required,
    fee,
    change,
    id: hexOf(tx.id),
    covenantId: bound ? hexOf(bound.covenantId.toString()) : "",
  };
}

function p2sh(kaspa, built) {
  return kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
}

async function findRow(rpc, kaspa, contractState, amount, source = SOURCE) {
  const built = compile(contractState, source);
  const address = p2sh(kaspa, built);
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) === amount);
  if (!hit) return null;
  return { built, address, row: hit, covenantId: covOf(hit) };
}

async function waitRow(rpc, kaspa, contractState, amount, source = SOURCE) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findRow(rpc, kaspa, contractState, amount, source);
    if (found && found.covenantId) return found;
    await sleep(500);
  }
  const built = compile(contractState, source);
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

    if (process.argv.includes("--held")) {
      const held = loadJson(HELD_FILE, {
        phase: "start",
        network: NETWORK,
        url: URL,
        extension: randomBytes(32).toString("hex"),
        oraclePub: oracle.pub,
        source: "contracts/peg.sil",
        steps: [],
      });
      if (held.oraclePub !== oracle.pub) throw new Error("held oracle does not match the oracle file");
      if (held.url !== URL) throw new Error("held url is not the local devnet");
      if (!held.extension || held.extension === state.extensionA || held.extension === state.extensionB) {
        throw new Error("held extension collides with a recorded vault");
      }

      function heldAtLeast(phase) {
        const at = HELD_PHASES.indexOf(held.phase);
        const want = HELD_PHASES.indexOf(phase);
        if (at < 0 || want < 0) throw new Error(`unknown held phase ${held.phase} ${phase}`);
        return at >= want;
      }

      function heldRecord(row) {
        held.steps.push(row);
        saveJson(HELD_FILE, held);
        journal(row);
        const tail = row.txid ? ` ${row.txid}` : "";
        say(`${row.label} ${row.observed}${tail}`);
      }

      async function heldAccept(label, phase, wallet, spec, confirm) {
        if (!heldAtLeast(phase)) {
          const sent = await send(label, wallet, spec);
          held.phase = phase;
          held[phase] = {
            txid: sent.id,
            fee: sent.fee,
            budget: sent.budget,
            change: sent.change,
            covenantId: sent.covenantId,
          };
          heldRecord({
            label,
            expected: "accept",
            observed: "accepted",
            txid: sent.id,
            fee: sent.fee,
            budget: sent.budget,
            change: sent.change,
            covenantId: sent.covenantId,
          });
          mineOne(wallets.three.address);
        } else {
          say(`${label} already ${phase}`);
        }
        return confirm();
      }

      async function heldReject(label, phase, wallet, spec) {
        if (heldAtLeast(phase)) {
          say(`${label} already ${phase}`);
          return;
        }
        try {
          const sent = await send(label, wallet, spec);
          held.phase = phase;
          held[phase] = { txid: sent.id, observed: "accepted" };
          heldRecord({ label, expected: "reject", observed: "accepted", txid: sent.id, fee: sent.fee, budget: sent.budget });
          throw new Error(`${label} was accepted ${sent.id}`);
        } catch (error) {
          if (!error.rejected) throw error;
          if (/insufficient fee|fee rate|feerate|\bmass\b|orphan|not synced|compute budget|signature script length|not final|ECONN|timed out|socket hang/i.test(error.message)) {
            throw error;
          }
          if (!/script ran, but verification failed/i.test(error.message)) throw error;
          const named = String(error.message).match(/Rejected transaction ([0-9a-f]{64})/i);
          const txid = String(error.txid || (named && named[1]) || "").toLowerCase();
          if (named && error.txid && named[1].toLowerCase() !== String(error.txid).toLowerCase()) {
            throw new Error("rejected id does not match the node text");
          }
          if (!txid) throw new Error("rejected refresh has no transaction id");
          held.phase = phase;
          held[phase] = { observed: "rejected", txid, error: String(error.message).slice(0, 800) };
          heldRecord({ label, expected: "reject", observed: "rejected", txid, error: String(error.message).slice(0, 800) });
        }
      }

      const extension = held.extension;
      const openState = shape(wallets.one.pub, extension, oracle.pub);
      const sealedState = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1 });
      const mintedVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: HELD_CENTS, quote: HELD_PRICE });
      const mintedNote = shape(wallets.two.pub, extension, oracle.pub, {
        amount: HELD_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: HELD_PRICE,
      });
      const attackVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: HELD_CENTS, quote: HIGH_PRICE });
      const attackNote = shape(wallets.two.pub, extension, oracle.pub, {
        amount: HELD_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: HIGH_PRICE,
      });
      const doneVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: HELD_PRICE });
      const fixedOpen = compile(openState, FIXED);
      const oldOpen = compile(openState, SOURCE);
      if (fixedOpen.redeem.equals(oldOpen.redeem)) throw new Error("held script matches the 2 Nov script");
      const scriptSha = createHash("sha256").update(fixedOpen.redeem).digest("hex");
      const priorSha = createHash("sha256").update(oldOpen.redeem).digest("hex");
      if (held.scriptSha256 && held.scriptSha256 !== scriptSha) {
        throw new Error("held script does not match the vault that was opened");
      }
      held.scriptSha256 = scriptSha;
      held.priorSha256 = priorSha;
      saveJson(HELD_FILE, held);
      say(`held script ${fixedOpen.redeem.length} sha256=${scriptSha}`);
      say(`prior script ${oldOpen.redeem.length} sha256=${priorSha}`);

      async function heldPair() {
        const vault = await waitRow(rpc, kaspa, mintedVault, HELD_VALUE, FIXED);
        const note = await waitRow(rpc, kaspa, mintedNote, CARRIER, FIXED);
        return { vault, note };
      }

      if (heldAtLeast("heldRedeemed")) {
        const vault = await waitRow(rpc, kaspa, doneVault, HELD_LEFT, FIXED);
        const pays = await waitPay(rpc, wallets.two.address, held.heldRedeemed.txid, [HELD_PAY, CARRIER]);
        if (RECORDED_COVENANTS.has(vault.covenantId)) throw new Error("held redeem landed on a recorded covenant");
        if (vault.covenantId !== held.heldOpened.covenantId) throw new Error("held covenant changed");
        const end = await dagOf(rpc);
        say(`RESULT held ${JSON.stringify({
          observed: "read-back",
          open: held.heldOpened.txid,
          mint: held.heldMinted.txid,
          reject: held.heldRejected.txid,
          redeem: held.heldRedeemed.txid,
          surplus: vault.row.amount.toString(),
          pay: HELD_PAY.toString(),
          pays,
          covenant: vault.covenantId,
          quote: HELD_PRICE,
          virtualDaa: end.virtualDaa.toString(),
          sink: end.sink,
          median: end.median,
        })}`);
        return;
      }

      if (!heldAtLeast("heldSealed")) {
        const opened = await heldAccept("held-open", "heldOpened", wallets.one, {
          feeNeed: HELD_VALUE + HELD_FEE,
          lockTime: 0,
          genesis: true,
          genesisOutputs: [0],
          covenantRows: [],
          sigs: [],
          fixed: () => [{ value: HELD_VALUE, script: kaspa.payToScriptHashScript(fixedOpen.redeem) }],
        }, () => waitRow(rpc, kaspa, openState, HELD_VALUE, FIXED));
        if (RECORDED_COVENANTS.has(opened.covenantId)) throw new Error("held open reused a recorded covenant");
        say(`held-open covenant=${opened.covenantId} value=${opened.row.amount}`);
      }

      let sealed = null;
      if (!heldAtLeast("heldMinted")) {
        if (!heldAtLeast("heldSealed")) {
          const opened = await waitRow(rpc, kaspa, openState, HELD_VALUE, FIXED);
          const sealedBuilt = compile(sealedState, FIXED);
          sealed = await heldAccept("held-seal", "heldSealed", wallets.one, {
            feeNeed: HELD_FEE,
            lockTime: 0,
            covenantRows: [opened.row],
            sigs: [{ index: 0, built: opened.built, entry: "seal", key: wallets.one.key, args: ["OWNER"] }],
            fixed: (sdk) => [{
              value: HELD_VALUE,
              script: sdk.payToScriptHashScript(sealedBuilt.redeem),
              covenant: binding(sdk, 0, opened.covenantId),
            }],
          }, () => waitRow(rpc, kaspa, sealedState, HELD_VALUE, FIXED));
        } else {
          sealed = await waitRow(rpc, kaspa, sealedState, HELD_VALUE, FIXED);
        }
        if (sealed.covenantId !== held.heldOpened.covenantId) throw new Error("held seal covenant drifted");
        say(`held-seal covenant=${sealed.covenantId} value=${sealed.row.amount}`);
      }

      if (!heldAtLeast("heldMinted")) {
        const have = sealed;
        const mintedBuilt = compile(mintedVault, FIXED);
        const noteBuilt = compile(mintedNote, FIXED);
        const window = windowFor(Date.now(), false);
        const signed = signPrice(HELD_PRICE, window.notBefore, window.expiry, oracle.priv);
        const args = [HELD_CENTS, Buffer.from(wallets.two.pub, "hex"), HELD_PRICE, window.notBefore, window.expiry, signed.sig, "OWNER"];
        await heldAccept("held-mint", "heldMinted", wallets.one, {
          feeNeed: CARRIER + HELD_FEE,
          lockTime: window.lockTime,
          covenantRows: [have.row],
          sigs: [{ index: 0, built: have.built, entry: "mint", key: wallets.one.key, args }],
          fixed: (sdk) => [
            { value: HELD_VALUE, script: sdk.payToScriptHashScript(mintedBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
            { value: CARRIER, script: sdk.payToScriptHashScript(noteBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
          ],
        }, () => heldPair());
      }

      const minted = await heldPair();
      if (minted.vault.covenantId !== held.heldOpened.covenantId) throw new Error("held mint covenant drifted");
      if (minted.note.covenantId !== minted.vault.covenantId) throw new Error("held note covenant drifted");
      say(`held-mint covenant=${minted.vault.covenantId} note=${minted.note.address}`);

      if (!heldAtLeast("heldRejected")) {
        const window = windowFor(Date.now(), false);
        const signed = signPrice(HIGH_PRICE, window.notBefore, window.expiry, oracle.priv);
        if (signed.pub.toString("hex") !== oracle.pub) throw new Error("held refresh signed a different oracle");
        const toVault = compile(attackVault, FIXED);
        const toNote = compile(attackNote, FIXED);
        await heldReject("held-reject-refresh", "heldRejected", wallets.one, {
          feeNeed: HELD_FEE,
          lockTime: window.lockTime,
          covenantRows: [minted.vault.row, minted.note.row],
          sigs: [
            { index: 0, built: minted.vault.built, entry: "refreshVault", key: wallets.one.key, args: [HIGH_PRICE, window.notBefore, window.expiry, signed.sig] },
            { index: 1, built: minted.note.built, entry: "refreshNote", key: wallets.one.key, args: [HIGH_PRICE, window.notBefore, window.expiry, signed.sig] },
          ],
          fixed: (sdk) => [
            { value: HELD_VALUE, script: sdk.payToScriptHashScript(toVault.redeem), covenant: binding(sdk, 0, minted.vault.covenantId) },
            { value: CARRIER, script: sdk.payToScriptHashScript(toNote.redeem), covenant: binding(sdk, 1, minted.vault.covenantId) },
          ],
        });
        say(`held-reject-refresh price=${HIGH_PRICE} stored=${HELD_PRICE} holder-signed=false fit=${fairSompi(HELD_CENTS, HIGH_PRICE)}`);
      }

      const still = await heldPair();
      if (still.vault.covenantId !== held.heldOpened.covenantId) throw new Error("held note moved");
      const doneBuilt = compile(doneVault, FIXED);
      const redeemed = await heldAccept("held-redeem", "heldRedeemed", wallets.two, {
        feeNeed: HELD_FEE,
        lockTime: 0,
        covenantRows: [still.vault.row, still.note.row],
        sigs: [
          { index: 0, built: still.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
          { index: 1, built: still.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
        ],
        fixed: (sdk) => [
          { value: HELD_LEFT, script: sdk.payToScriptHashScript(doneBuilt.redeem), covenant: binding(sdk, 0, still.vault.covenantId) },
          { value: HELD_PAY, script: sdk.payToAddressScript(wallets.two.address) },
          { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
        ],
      }, async () => {
        const vault = await waitRow(rpc, kaspa, doneVault, HELD_LEFT, FIXED);
        const txid = held.heldRedeemed.txid;
        const pays = await waitPay(rpc, wallets.two.address, txid, [HELD_PAY, CARRIER]);
        return { vault, pays, txid };
      });
      if (redeemed.vault.covenantId !== held.heldOpened.covenantId) throw new Error("held redeem covenant drifted");
      if (BigInt(redeemed.vault.row.amount) !== HELD_LEFT) throw new Error(`held surplus is ${redeemed.vault.row.amount}`);
      const end = await dagOf(rpc);
      say(`RESULT held ${JSON.stringify({
        observed: "accepted",
        open: held.heldOpened.txid,
        seal: held.heldSealed.txid,
        mint: held.heldMinted.txid,
        reject: held.heldRejected.txid,
        redeem: redeemed.txid,
        cents: HELD_CENTS,
        mintPrice: HELD_PRICE,
        attackPrice: HIGH_PRICE,
        attackFair: fairSompi(HELD_CENTS, HIGH_PRICE).toString(),
        surplus: redeemed.vault.row.amount.toString(),
        pay: HELD_PAY.toString(),
        carrier: CARRIER.toString(),
        covenant: redeemed.vault.covenantId,
        quote: HELD_PRICE,
        scriptSha,
        priorSha,
        virtualDaa: end.virtualDaa.toString(),
        sink: end.sink,
        median: end.median,
        fees: {
          open: held.heldOpened.fee,
          seal: held.heldSealed.fee,
          mint: held.heldMinted.fee,
          redeem: held.heldRedeemed.fee,
        },
        budgets: {
          open: held.heldOpened.budget,
          seal: held.heldSealed.budget,
          mint: held.heldMinted.budget,
          redeem: held.heldRedeemed.budget,
        },
      })}`);
      return;
    }

    if (process.argv.includes("--late")) {
      if (!phaseAtLeast(state, "redeemedA2")) throw new Error("the late mint waits until the recorded redeem");
      const storedQuote = 200_000_000;
      const extension = state.extensionA;
      const sitting = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: storedQuote });
      const mintedState = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: LATE_CENTS, quote: LATE_PRICE });
      const noteState = shape(wallets.two.pub, extension, oracle.pub, {
        amount: LATE_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: LATE_PRICE,
      });
      const redeemedState = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: LATE_PRICE });

      if (state.phase === "lateRejected") {
        say(`RESULT late ${JSON.stringify({ observed: "rejected", ...state.lateRejected })}`);
        return;
      }

      if (phaseAtLeast(state, "liveMinted")) {
        say(`RESULT late ${JSON.stringify({ observed: "spent-by-later-mint", redeem: state.lateRedeemed && state.lateRedeemed.txid })}`);
        return;
      }

      if (phaseAtLeast(state, "lateRedeemed")) {
        const vault = await waitRow(rpc, kaspa, redeemedState, LATE_LEFT);
        const pays = await waitPay(rpc, wallets.two.address, state.lateRedeemed.txid, [LATE_PAY, CARRIER]);
        say(`RESULT late ${JSON.stringify({
          observed: "read-back",
          mint: state.lateMinted.txid,
          redeem: state.lateRedeemed.txid,
          lockTime: state.lateMinted.lockTime,
          notBefore: state.lateMinted.notBefore,
          expiry: state.lateMinted.expiry,
          signedAt: state.lateMinted.signedAt,
          submitAt: state.lateMinted.submitAt,
          blockTime: state.lateMinted.blockTime,
          median: state.lateMinted.median,
          surplus: vault.row.amount.toString(),
          pay: LATE_PAY.toString(),
          pays,
          covenant: vault.covenantId,
        })}`);
        return;
      }

      let mintedRow = null;
      if (!phaseAtLeast(state, "lateMinted")) {
        const have = await waitRow(rpc, kaspa, sitting, LATE_VALUE);
        if (!state.redeemedA2 || have.covenantId !== state.redeemedA2.covenantId) {
          throw new Error(`late vault covenant ${have.covenantId} is not the recorded redeem`);
        }
        say(`late-from covenant=${have.covenantId} value=${have.row.amount} quote=${storedQuote}`);
        const mintedBuilt = compile(mintedState);
        const noteBuilt = compile(noteState);
        const window = holdWindow(Date.now());
        const signedPrice = signPrice(LATE_PRICE, window.notBefore, window.expiry, oracle.priv);
        const args = [LATE_CENTS, Buffer.from(wallets.two.pub, "hex"), LATE_PRICE, window.notBefore, window.expiry, signedPrice.sig, "OWNER"];
        const virtualDaa = (await dagOf(rpc)).virtualDaa;
        const feeRow = await pickCoin(rpc, wallets.one, virtualDaa, CARRIER + LATE_FEE, new Set());
        say(`late-mint fee coin ${idOf(feeRow)} amount=${feeRow.amount} daa=${daaOf(feeRow)} coinbase=${coinbaseOf(feeRow)}`);
        const spec = {
          label: "late-mint",
          feeRow,
          feeKey: wallets.one.key,
          changeScript: wallets.one.spk,
          lockTime: window.lockTime,
          covenantRows: [have.row],
          sigs: [{ index: 0, built: have.built, entry: "mint", key: wallets.one.key, args }],
          fixed: (sdk) => [
            { value: LATE_VALUE, script: sdk.payToScriptHashScript(mintedBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
            { value: CARRIER, script: sdk.payToScriptHashScript(noteBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
          ],
        };
        let fee = LATE_FEE;
        let frozen = null;
        for (let attempt = 1; attempt <= 6; attempt += 1) {
          frozen = buildSigned(kaspa, spec, fee, LATE_BUDGET);
          if (frozen.ready) break;
          say(`late-mint fee ${fee} below quote ${frozen.required}`);
          fee = frozen.required + 1000n;
        }
        if (!frozen || !frozen.ready) throw new Error("late mint fee did not settle before the wait");
        const signedAt = Date.now();
        if (signedAt > window.expiry) throw new Error("signing finished after the held window");
        say(`late-mint signed id=${frozen.id} lockTime=${window.lockTime} notBefore=${window.notBefore} expiry=${window.expiry} fee=${frozen.fee} change=${frozen.change}`);
        journal({
          label: "late-mint-signed",
          txid: frozen.id,
          lockTime: window.lockTime,
          notBefore: window.notBefore,
          expiry: window.expiry,
          signedAt,
          fee: frozen.fee.toString(),
          change: frozen.change.toString(),
          covenantId: frozen.covenantId,
        });
        say(`late-mint holding until wall clock passes ${window.expiry}`);
        while (Date.now() <= window.expiry + 2_000) await sleep(1000);
        const submitAt = Date.now();
        const before = await dagOf(rpc);
        say(`late-mint submit wall=${submitAt} expiry=${window.expiry} median=${before.median} dagKeys=${before.dagKeys} virtual_daa=${before.virtualDaa} sink=${before.sink}`);
        if (submitAt <= window.expiry) throw new Error("submit is still inside the held window");
        try {
          const result = await rpc.submitTransaction({ transaction: frozen.tx, allowOrphan: false });
          const id = hexOf(result.transactionId || frozen.tx.id);
          if (id !== frozen.id) say(`late-mint submit id ${id} differs from signed id ${frozen.id}`);
          record({
            label: "late-mint",
            expected: "measure",
            observed: "accepted",
            txid: id,
            fee: frozen.fee.toString(),
            budget: LATE_BUDGET,
            change: frozen.change.toString(),
            covenantId: frozen.covenantId,
            lockTime: window.lockTime,
            notBefore: window.notBefore,
            expiry: window.expiry,
            signedAt,
            submitAt,
            median: before.median,
          });
          state.phase = "lateMinted";
          state.lateMinted = {
            txid: id,
            fee: frozen.fee.toString(),
            budget: LATE_BUDGET,
            change: frozen.change.toString(),
            covenantId: frozen.covenantId,
            lockTime: window.lockTime,
            notBefore: window.notBefore,
            expiry: window.expiry,
            signedAt,
            submitAt,
            median: before.median,
          };
          saveJson(STATE_FILE, state);
          mineOne(wallets.three.address);
          const after = await dagOf(rpc);
          const stamp = await blockStamp(kaspa, rpc, after.sink);
          state.lateMinted.blockTime = stamp;
          state.lateMinted.sink = after.sink;
          state.lateMinted.virtualDaa = after.virtualDaa.toString();
          saveJson(STATE_FILE, state);
          const blockAfter = /^\d+$/.test(stamp) && BigInt(stamp) > BigInt(window.expiry);
          say(`late-mint mined sink=${after.sink} blockTime=${stamp} blockAfterExpiry=${blockAfter} virtual_daa=${after.virtualDaa}`);
          journal({ label: "late-mint-mined", txid: id, sink: after.sink, blockTime: stamp, blockAfterExpiry: blockAfter, virtualDaa: after.virtualDaa.toString(), median: after.median });
        } catch (error) {
          const message = hide(error && error.message ? error.message : error);
          if (/insufficient fee|fee rate|feerate|\bmass\b|orphan|not synced|compute budget|signature script length|not final|ECONN|timed out|socket hang/i.test(message)) {
            throw error;
          }
          record({
            label: "late-mint",
            expected: "measure",
            observed: "rejected",
            error: message.slice(0, 800),
            lockTime: window.lockTime,
            notBefore: window.notBefore,
            expiry: window.expiry,
            signedAt,
            submitAt,
            median: before.median,
          });
          state.phase = "lateRejected";
          state.lateRejected = {
            error: message.slice(0, 800),
            lockTime: window.lockTime,
            notBefore: window.notBefore,
            expiry: window.expiry,
            signedAt,
            submitAt,
            median: before.median,
          };
          saveJson(STATE_FILE, state);
          say(`RESULT late ${JSON.stringify({ observed: "rejected", ...state.lateRejected })}`);
          return;
        }
      } else {
        say(`late-mint already ${state.lateMinted.txid}`);
      }

      const vaultFound = await findRow(rpc, kaspa, mintedState, LATE_VALUE);
      const noteFound = await findRow(rpc, kaspa, noteState, CARRIER);
      if (!vaultFound || !noteFound) mineOne(wallets.three.address);
      mintedRow = {
        vault: vaultFound && vaultFound.covenantId ? vaultFound : await waitRow(rpc, kaspa, mintedState, LATE_VALUE),
        note: noteFound && noteFound.covenantId ? noteFound : await waitRow(rpc, kaspa, noteState, CARRIER),
      };
      if (mintedRow.vault.covenantId !== state.redeemedA2.covenantId) {
        throw new Error(`late mint covenant drifted to ${mintedRow.vault.covenantId}`);
      }

      const redeemedBuilt = compile(redeemedState);
      const redeemed = await accept("late-redeem", "lateRedeemed", wallets.two, {
        feeNeed: FEE_FLOOR,
        lockTime: 0,
        covenantRows: [mintedRow.vault.row, mintedRow.note.row],
        sigs: [
          { index: 0, built: mintedRow.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
          { index: 1, built: mintedRow.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
        ],
        fixed: (sdk) => [
          { value: LATE_LEFT, script: sdk.payToScriptHashScript(redeemedBuilt.redeem), covenant: binding(sdk, 0, mintedRow.vault.covenantId) },
          { value: LATE_PAY, script: sdk.payToAddressScript(wallets.two.address) },
          { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
        ],
      }, async () => {
        const vault = await waitRow(rpc, kaspa, redeemedState, LATE_LEFT);
        const txid = state.lateRedeemed.txid;
        const pays = await waitPay(rpc, wallets.two.address, txid, [LATE_PAY, CARRIER]);
        return { vault, pays, txid };
      });
      const stamp = state.lateMinted.blockTime || "";
      const blockAfter = /^\d+$/.test(String(stamp)) && BigInt(stamp) > BigInt(state.lateMinted.expiry);
      say(`RESULT late ${JSON.stringify({
        observed: "accepted",
        mint: state.lateMinted.txid,
        redeem: redeemed.txid,
        cents: LATE_CENTS,
        price: LATE_PRICE,
        lockTime: state.lateMinted.lockTime,
        notBefore: state.lateMinted.notBefore,
        expiry: state.lateMinted.expiry,
        signedAt: state.lateMinted.signedAt,
        submitAt: state.lateMinted.submitAt,
        blockTime: stamp,
        blockAfterExpiry: blockAfter,
        median: state.lateMinted.median,
        surplus: redeemed.vault.row.amount.toString(),
        pay: LATE_PAY.toString(),
        carrier: CARRIER.toString(),
        covenant: redeemed.vault.covenantId,
      })}`);
      return;
    }

    if (process.argv.includes("--live")) {
      if (!phaseAtLeast(state, "lateRedeemed") || state.phase === "lateRejected") {
        throw new Error("the live note waits until the late redeem");
      }
      const extension = state.extensionA;
      const sitting = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: LIVE_PRICE });
      const mintedVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: LIVE_CENTS, quote: LIVE_PRICE });
      const mintedNote = shape(wallets.two.pub, extension, oracle.pub, {
        amount: LIVE_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: LIVE_PRICE,
      });
      const highVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: LIVE_CENTS, quote: HIGH_PRICE });
      const highNote = shape(wallets.two.pub, extension, oracle.pub, {
        amount: LIVE_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: HIGH_PRICE,
      });
      const downVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: LIVE_CENTS, quote: DOWN_PRICE });
      const downNote = shape(wallets.two.pub, extension, oracle.pub, {
        amount: LIVE_CENTS,
        owner: wallets.two.pub,
        kind: 2,
        debt: 0,
        sealed: 1,
        quote: DOWN_PRICE,
      });
      const doneVault = shape(wallets.one.pub, extension, oracle.pub, { sealed: 1, debt: 0, quote: DOWN_PRICE });
      const doneBuilt = compile(doneVault);

      function pairOf(vaultState, noteState, amount) {
        return Promise.all([
          waitRow(rpc, kaspa, vaultState, amount),
          waitRow(rpc, kaspa, noteState, CARRIER),
        ]).then(([vault, note]) => ({ vault, note }));
      }

      function refreshOf(from, toVaultState, toNoteState, price, priv) {
        const window = windowFor(Date.now(), false);
        const signed = signPrice(price, window.notBefore, window.expiry, priv);
        const toVault = compile(toVaultState);
        const toNote = compile(toNoteState);
        return {
          pub: signed.pub.toString("hex"),
          spec: {
            feeNeed: LIVE_FEE,
            lockTime: window.lockTime,
            covenantRows: [from.vault.row, from.note.row],
            sigs: [
              { index: 0, built: from.vault.built, entry: "refreshVault", key: wallets.one.key, args: [price, window.notBefore, window.expiry, signed.sig] },
              { index: 1, built: from.note.built, entry: "refreshNote", key: wallets.one.key, args: [price, window.notBefore, window.expiry, signed.sig] },
            ],
            fixed: (sdk) => [
              { value: LIVE_VALUE, script: sdk.payToScriptHashScript(toVault.redeem), covenant: binding(sdk, 0, from.vault.covenantId) },
              { value: CARRIER, script: sdk.payToScriptHashScript(toNote.redeem), covenant: binding(sdk, 1, from.vault.covenantId) },
            ],
          },
        };
      }

      if (phaseAtLeast(state, "redeemedLive")) {
        const vault = await waitRow(rpc, kaspa, doneVault, DOWN_LEFT);
        const pays = await waitPay(rpc, wallets.two.address, state.redeemedLive.txid, [DOWN_PAY, CARRIER]);
        const end = await dagOf(rpc);
        say(`RESULT live ${JSON.stringify({
          observed: "read-back",
          mint: state.liveMinted.txid,
          wrongPub: state.rejectedWrongKey && state.rejectedWrongKey.pub,
          high: state.refreshedHigh.txid,
          down: state.refreshedDown.txid,
          redeem: state.redeemedLive.txid,
          surplus: vault.row.amount.toString(),
          pay: DOWN_PAY.toString(),
          pays,
          covenant: vault.covenantId,
          virtualDaa: end.virtualDaa.toString(),
          sink: end.sink,
        })}`);
        return;
      }

      if (!phaseAtLeast(state, "refreshedHigh")) {
        if (!phaseAtLeast(state, "liveMinted")) {
          const have = await waitRow(rpc, kaspa, sitting, LIVE_VALUE);
          if (!state.redeemedA2 || have.covenantId !== state.redeemedA2.covenantId) {
            throw new Error(`live vault covenant ${have.covenantId} is not the recorded redeem`);
          }
          say(`live-from covenant=${have.covenantId} value=${have.row.amount} quote=${LIVE_PRICE}`);
          const mintedBuilt = compile(mintedVault);
          const noteBuilt = compile(mintedNote);
          const window = windowFor(Date.now(), false);
          const signed = signPrice(LIVE_PRICE, window.notBefore, window.expiry, oracle.priv);
          const args = [LIVE_CENTS, Buffer.from(wallets.two.pub, "hex"), LIVE_PRICE, window.notBefore, window.expiry, signed.sig, "OWNER"];
          await accept("live-mint", "liveMinted", wallets.one, {
            feeNeed: CARRIER + LIVE_FEE,
            lockTime: window.lockTime,
            covenantRows: [have.row],
            sigs: [{ index: 0, built: have.built, entry: "mint", key: wallets.one.key, args }],
            fixed: (sdk) => [
              { value: LIVE_VALUE, script: sdk.payToScriptHashScript(mintedBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
              { value: CARRIER, script: sdk.payToScriptHashScript(noteBuilt.redeem), covenant: binding(sdk, 0, have.covenantId) },
            ],
          }, () => pairOf(mintedVault, mintedNote, LIVE_VALUE));
        }

        const minted = await pairOf(mintedVault, mintedNote, LIVE_VALUE);
        if (minted.vault.covenantId !== state.redeemedA2.covenantId) throw new Error("live mint covenant drifted");
        say(`live-mint covenant=${minted.vault.covenantId} note=${minted.note.address}`);

        if (!phaseAtLeast(state, "rejectedWrongKey")) {
          let wrong = null;
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const priv = randomBytes(32);
            try {
              const probe = signPrice(1, 1, 2, priv);
              if (probe.pub.toString("hex") === oracle.pub) continue;
              secrets.push(priv.toString("hex"));
              wrong = priv;
              break;
            } catch {
              // The scalar was outside the schnorr range.
            }
          }
          if (!wrong) throw new Error("could not draw a second oracle key");
          const bad = refreshOf(minted, highVault, highNote, HIGH_PRICE, wrong);
          say(`live wrong-key pub=${bad.pub}`);
          await reject("reject-wrong-key", "rejectedWrongKey", wallets.one, bad.spec);
          state.rejectedWrongKey.pub = bad.pub;
          saveJson(STATE_FILE, state);
        }

        const good = refreshOf(minted, highVault, highNote, HIGH_PRICE, oracle.priv);
        if (good.pub !== oracle.pub) throw new Error("refresh signed a different oracle");
        await accept("refresh-high", "refreshedHigh", wallets.one, good.spec, () => pairOf(highVault, highNote, LIVE_VALUE));
        say(`refresh-high price=${HIGH_PRICE} holder-signed=false`);
      }

      if (!phaseAtLeast(state, "refreshedDown")) {
        const high = await pairOf(highVault, highNote, LIVE_VALUE);
        if (high.vault.covenantId !== state.redeemedA2.covenantId) throw new Error("refresh-high covenant drifted");
        if (!phaseAtLeast(state, "rejectedShortLive")) {
          await reject("reject-short-live", "rejectedShortLive", wallets.two, {
            feeNeed: LIVE_FEE,
            lockTime: 0,
            covenantRows: [high.vault.row, high.note.row],
            sigs: [
              { index: 0, built: high.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
              { index: 1, built: high.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
            ],
            fixed: (sdk) => [
              { value: DOWN_LEFT, script: sdk.payToScriptHashScript(doneBuilt.redeem), covenant: binding(sdk, 0, high.vault.covenantId) },
              { value: DOWN_PAY, script: sdk.payToAddressScript(wallets.two.address) },
              { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
            ],
          });
          say(`reject-short-live offered ${DOWN_PAY} against fair ${HIGH_PAY}`);
        }
        const downMove = refreshOf(high, downVault, downNote, DOWN_PRICE, oracle.priv);
        await accept("refresh-down", "refreshedDown", wallets.one, downMove.spec, () => pairOf(downVault, downNote, LIVE_VALUE));
        say(`refresh-down price=${DOWN_PRICE} holder-signed=false`);
      }

      const down = await pairOf(downVault, downNote, LIVE_VALUE);
      const redeemed = await accept("redeem-live", "redeemedLive", wallets.two, {
        feeNeed: LIVE_FEE,
        lockTime: 0,
        covenantRows: [down.vault.row, down.note.row],
        sigs: [
          { index: 0, built: down.vault.built, entry: "vaultRedeem", key: wallets.two.key, args: [] },
          { index: 1, built: down.note.built, entry: "noteRedeem", key: wallets.two.key, args: ["OWNER"] },
        ],
        fixed: (sdk) => [
          { value: DOWN_LEFT, script: sdk.payToScriptHashScript(doneBuilt.redeem), covenant: binding(sdk, 0, down.vault.covenantId) },
          { value: DOWN_PAY, script: sdk.payToAddressScript(wallets.two.address) },
          { value: CARRIER, script: sdk.payToAddressScript(wallets.two.address) },
        ],
      }, async () => {
        const vault = await waitRow(rpc, kaspa, doneVault, DOWN_LEFT);
        const txid = state.redeemedLive.txid;
        const pays = await waitPay(rpc, wallets.two.address, txid, [DOWN_PAY, CARRIER]);
        return { vault, pays, txid };
      });
      const end = await dagOf(rpc);
      say(`RESULT live ${JSON.stringify({
        observed: "accepted",
        mint: state.liveMinted.txid,
        wrongPub: state.rejectedWrongKey.pub,
        high: state.refreshedHigh.txid,
        down: state.refreshedDown.txid,
        redeem: redeemed.txid,
        cents: LIVE_CENTS,
        mintPrice: LIVE_PRICE,
        highPrice: HIGH_PRICE,
        downPrice: DOWN_PRICE,
        surplus: redeemed.vault.row.amount.toString(),
        pay: DOWN_PAY.toString(),
        carrier: CARRIER.toString(),
        covenant: redeemed.vault.covenantId,
        virtualDaa: end.virtualDaa.toString(),
        sink: end.sink,
        median: end.median,
      })}`);
      return;
    }

    if (process.argv.includes("--quote")) {
      const nextPrice = 200_000_000;
      const cents = 50;
      const pay = fairSompi(cents, nextPrice);
      const left = SURPLUS - pay;
      if (pay !== 100_000_000n || left !== 100_000_000n) throw new Error("second quote pay");
      if (atRatio(cents, nextPrice, RATIO) !== SURPLUS) throw new Error("second quote ratio");
      if (phaseAtLeast(state, "lateMinted")) {
        say(`RESULT quote ${JSON.stringify({
          refresh: state.refreshedA.txid,
          mint: state.mintedA2.txid,
          redeem: state.redeemedA2.txid,
          note: "the 100000000 surplus was spent by a later mint",
        })}`);
        return;
      }
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
