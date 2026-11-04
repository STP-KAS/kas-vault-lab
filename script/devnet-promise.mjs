// Private half-devnet fixed promise. Talks only to ws://127.0.0.1:17610.
// Mines only through grpc://127.0.0.1:16610.
// Does not spend peg.sil, position.sil, the clocks, or an STP1 lock.
// A rerun returns when this file's phase is claimed. It does not open another.

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
const SOURCE = join(ROOT, "contracts", "promise.sil");
const LOCAL = join(ROOT, ".local");
const STATE_FILE = join(LOCAL, "devnet-promise-state.json");
const JOURNAL = join(ROOT, "results", "devnet-promise.jsonl");

const LOCK = 200_000_000n;
const PROMISE = 100_000_000n;
const ADD = 50_000_000n;
const AFTER_ADD = 250_000_000n;
const TAKE = 50_000_000n;
const AFTER_TAKE = 200_000_000n;
const OVER = 150_000_001n;
const SHORT = 50_000_000n;
const FEE_FLOOR = 5_000_000n;
const FEE_ROOM = 100_000_000n;
const MATURITY = 1000n;
const MAX_SEQUENCE = (2n ** 64n) - 1n;
const OWNER = { owner: true };

const secrets = [];
const compiled = new Map();

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

function argsOf(fields) {
  return [
    { kind: "bytes", value: [...Buffer.from(fields.locker, "hex")] },
    { kind: "bytes", value: [...Buffer.from(fields.bearer, "hex")] },
    { kind: "int", value: fields.promise },
  ];
}

function compile(fields) {
  const key = JSON.stringify(fields);
  const hit = compiled.get(key);
  if (hit) return hit;
  const dir = join(tmpdir(), "kas-vault-lab-promise");
  mkdirSync(dir, { recursive: true });
  const argsPath = join(dir, `args-${compiled.size}.json`);
  const outPath = join(dir, `out-${compiled.size}.json`);
  writeFileSync(argsPath, JSON.stringify(argsOf(fields)));
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
  const row = { artifact, redeem: Buffer.from(bytes), bytes: bytes.length };
  compiled.set(key, row);
  return row;
}

function entryOf(kaspa, built, name, args) {
  const action = encodeEntry(kaspa, built.artifact, name, args);
  return withRedeem(kaspa, action, built.redeem);
}

function materialize(args, ownerSig) {
  return args.map((arg) => (arg === OWNER ? ownerSig : arg));
}

async function loadKaspa() {
  const require = createRequire(join(ROOT, "package.json"));
  globalThis.WebSocket = require("websocket").w3cwebsocket;
  return import(pathToFileURL(WASM).href);
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
  if (!found.one || !found.two || !found.three) throw new Error("missing wallet");
  return found;
}

async function dagOf(rpc) {
  const dag = await rpc.getBlockDagInfo();
  return { virtualDaa: BigInt(dag.virtualDaaScore), sink: hexOf(dag.sink) };
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

function binding(kaspa, id) {
  return new kaspa.CovenantBinding(0, new kaspa.Hash(id));
}

async function reloadHandles(rpc, handles) {
  const fresh = [];
  for (const handle of handles) {
    const bag = await utxosOf(rpc, handle.address);
    const hit = bag.find((item) => hexOf(item.outpoint.transactionId) === handle.id && Number(item.outpoint.index) === handle.index);
    if (!hit) throw new Error(`missing coin ${handle.id.slice(0, 8)}:${handle.index}`);
    fresh.push(hit);
  }
  return fresh;
}

async function submit(kaspa, rpc, spec) {
  let fee = FEE_FLOOR;
  let budget = 40;
  let lastError = "";
  let localId = "";
  const handles = spec.rows.map((row) => ({
    id: hexOf(row.outpoint.transactionId),
    index: Number(row.outpoint.index),
    address: row.address.toString(),
  }));
  const outputPlans = spec.outputs.map((item) => ({
    value: item.value,
    script: item.script,
    auth: item.covenant ? 0 : null,
    covenantId: item.covenant ? hexOf(item.covenant.covenantId) : null,
  }));
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    if (attempt > 1) spec.rows = await reloadHandles(rpc, handles);
    const inputSum = spec.rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const fixedSum = outputPlans.reduce((sum, item) => sum + BigInt(item.value), 0n);
    const change = inputSum - fixedSum - fee;
    if (change < 1000n) throw new Error(`${spec.label} change would be ${change} fee=${fee}`);
    const outputs = [...outputPlans, { value: change, script: spec.changeScript, auth: null, covenantId: null }].map((item) => {
      const covenant = item.covenantId == null ? null : new kaspa.CovenantBinding(item.auth, new kaspa.Hash(item.covenantId));
      return outputOf(kaspa, item.value, item.script, covenant);
    });
    const inputs = spec.rows.map((row, index) => ({
      previousOutpoint: { transactionId: row.outpoint.transactionId, index: row.outpoint.index },
      signatureScript: "",
      sequence: spec.sequences[index],
      sigOpCount: 0,
      computeBudget: spec.sigs.some((sig) => sig.input === index) ? budget : 10,
      utxo: row,
    }));
    const tx = new kaspa.Transaction({
      version: 1,
      inputs,
      outputs,
      lockTime: 0n,
      subnetworkId: "00".repeat(20),
      gas: 0n,
      payload: "",
    });
    tx.version = 1;
    if (spec.genesis) tx.populateGenesisCovenants([new kaspa.GenesisCovenantGroup(0, [0])]);
    for (const sig of spec.sigs) {
      tx.inputs[sig.input].signatureScript = entryOf(kaspa, sig.built, sig.entry, materialize(sig.args, blankSig()));
      tx.inputs[sig.input].computeBudget = budget;
    }
    let required = 0n;
    try {
      const quote = kaspa.calculateTransactionFee(NETWORK, tx);
      if (quote != null) required = BigInt(quote);
    } catch {
      required = FEE_FLOOR;
    }
    if (fee < required + 1000n) {
      fee = required + 1000n;
      continue;
    }
    for (const sig of spec.sigs) {
      const signed = Buffer.from(rawSig(kaspa.createInputSignature(tx, sig.input, sig.key)), "hex");
      tx.inputs[sig.input].signatureScript = entryOf(kaspa, sig.built, sig.entry, materialize(sig.args, signed));
      tx.inputs[sig.input].computeBudget = budget;
    }
    tx.inputs[spec.feeIndex].signatureScript = p2pkScript(kaspa.createInputSignature(tx, spec.feeIndex, spec.feeKey));
    tx.inputs[spec.feeIndex].computeBudget = 10;
    tx.finalize();
    localId = hexOf(tx.id);
    try {
      const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
      return { accepted: true, id: hexOf(result.transactionId || tx.id), fee: fee.toString(), budget };
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
      if (/fee|mass/i.test(lastError) && attempt < 6) {
        fee *= 2n;
        continue;
      }
      say(`${spec.label} rejected ${lastError}`);
      return { accepted: false, error: lastError, id: localId, fee: fee.toString() };
    }
  }
  say(`${spec.label} gave up ${lastError}`);
  return { accepted: false, error: lastError || "not accepted", id: localId };
}

async function pickCoin(rpc, wallet, virtualDaa, need, skip) {
  const rows = await utxosOf(rpc, wallet.address);
  const fit = rows
    .filter((row) => {
      const id = `${hexOf(row.outpoint.transactionId)}:${row.outpoint.index}`;
      if (skip.has(id)) return false;
      if (covOf(row)) return false;
      if (scriptHex(row.scriptPublicKey) !== scriptHex(wallet.spk)) return false;
      if (coinbaseOf(row) && daaOf(row) + MATURITY > virtualDaa) return false;
      return BigInt(row.amount) >= need;
    })
    .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? -1 : 1));
  if (!fit.length) throw new Error(`no mature coin covers ${need} sompi`);
  return fit[0];
}

async function findRow(rpc, kaspa, built, amount) {
  const address = kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) === amount && covOf(row));
  if (!hit) return null;
  return { address, row: hit, born: daaOf(hit).toString(), covenantId: covOf(hit) };
}

async function waitRow(rpc, kaspa, built, amount) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findRow(rpc, kaspa, built, amount);
    if (found) return found;
    await sleep(500);
  }
  throw new Error(`promise output of ${amount} sompi did not appear`);
}

function fieldsOf(locker, bearer, promise) {
  return { locker, bearer, promise: Number(promise) };
}

function scriptReject(error) {
  return /script ran, but verification failed|signature script/i.test(String(error || ""));
}

async function outputAt(rpc, address, txid, index) {
  const rows = await utxosOf(rpc, address);
  return rows.find((row) => hexOf(row.outpoint.transactionId) === txid && Number(row.outpoint.index) === index) || null;
}

async function main() {
  const kaspa = await loadKaspa();
  const wallets = loadWallets(kaspa);
  const real = fieldsOf(wallets.one.pub, wallets.two.pub, PROMISE);
  const rewritten = fieldsOf(wallets.one.pub, wallets.two.pub, PROMISE * 2n);
  const built = compile(real);
  const wrong = compile(rewritten);
  say(`bytecode=${built.bytes} wrong=${wrong.bytes}`);
  if (process.argv.includes("--compile")) return;

  const rpc = new kaspa.RpcClient({ url: URL, encoding: kaspa.Encoding.Borsh, networkId: NETWORK });
  await rpc.connect();
  try {
    const info = await rpc.getServerInfo();
    if (String(info.networkId) !== NETWORK) throw new Error(`refusing network ${info.networkId}`);
    const state = loadJson(STATE_FILE, { phase: "start", promise: PROMISE.toString(), lock: LOCK.toString() });
    if (state.phase === "claimed") {
      say(`already claimed txid=${state.claim.txid} pay=${state.claim.pay} surplus=${state.claim.surplus}`);
      return;
    }
    const dag = await dagOf(rpc);
    say(`virtualDaa=${dag.virtualDaa} phase=${state.phase} sink=${dag.sink}`);
    journal({ label: "promise-dag", virtualDaa: dag.virtualDaa.toString(), phase: state.phase, sink: dag.sink });

    if (state.phase === "start") {
      const coin = await pickCoin(rpc, wallets.one, dag.virtualDaa, LOCK + FEE_ROOM, new Set());
      const opened = await submit(kaspa, rpc, {
        label: "promise-open",
        rows: [coin],
        sequences: [MAX_SEQUENCE],
        genesis: true,
        outputs: [{ value: LOCK, script: kaspa.payToScriptHashScript(built.redeem) }],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 0,
        sigs: [],
      });
      if (!opened.accepted) throw new Error(`open rejected: ${opened.error}`);
      mineOne(wallets.three.address);
      const row = await waitRow(rpc, kaspa, built, LOCK);
      state.phase = "opened";
      state.open = { txid: opened.id, born: row.born, covenantId: row.covenantId, fee: opened.fee };
      saveJson(STATE_FILE, state);
      journal({ label: "promise-open", txid: opened.id, born: row.born, covenantId: row.covenantId, fee: opened.fee });
      say(`open txid=${opened.id} covenant=${row.covenantId}`);
    }

    if (state.phase === "opened") {
      const sitting = await findRow(rpc, kaspa, built, LOCK);
      if (!sitting) throw new Error("open output is not spendable");
      if (!state.rewrite) {
        const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, ADD + FEE_ROOM, new Set());
        const sent = await submit(kaspa, rpc, {
          label: "promise-rewrite",
          rows: [sitting.row, fee],
          sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
          outputs: [{
            value: AFTER_ADD,
            script: kaspa.payToScriptHashScript(wrong.redeem),
            covenant: binding(kaspa, sitting.covenantId),
          }],
          changeScript: wallets.one.spk,
          feeKey: wallets.one.key,
          feeIndex: 1,
          sigs: [{ input: 0, built, entry: "add", key: wallets.one.key, args: [Number(ADD), OWNER] }],
        });
        if (sent.accepted) throw new Error(`rewrite was accepted ${sent.id}`);
        if (!scriptReject(sent.error)) throw new Error(`rewrite was not a script rejection: ${sent.error}`);
        state.rewrite = { txid: sent.id, error: sent.error };
        saveJson(STATE_FILE, state);
        journal({ label: "promise-rewrite", accepted: false, txid: sent.id, error: sent.error });
        say(`rewrite rejected txid=${sent.id}`);
      }
      const again = await findRow(rpc, kaspa, built, LOCK);
      if (!again) throw new Error("the lock moved during the rewrite");
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, ADD + FEE_ROOM, new Set());
      const added = await submit(kaspa, rpc, {
        label: "promise-add",
        rows: [again.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
        outputs: [{
          value: AFTER_ADD,
          script: kaspa.payToScriptHashScript(built.redeem),
          covenant: binding(kaspa, again.covenantId),
        }],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 1,
        sigs: [{ input: 0, built, entry: "add", key: wallets.one.key, args: [Number(ADD), OWNER] }],
      });
      if (!added.accepted) throw new Error(`add rejected: ${added.error}`);
      mineOne(wallets.three.address);
      const row = await waitRow(rpc, kaspa, built, AFTER_ADD);
      if (row.covenantId !== again.covenantId) throw new Error("add changed the covenant id");
      state.phase = "added";
      state.add = { txid: added.id, born: row.born, covenantId: row.covenantId, fee: added.fee };
      saveJson(STATE_FILE, state);
      journal({ label: "promise-add", txid: added.id, covenantId: row.covenantId, fee: added.fee });
      say(`add txid=${added.id} covenant=${row.covenantId}`);
    }

    if (state.phase === "added") {
      const sitting = await findRow(rpc, kaspa, built, AFTER_ADD);
      if (!sitting) throw new Error("added output is not spendable");
      if (!state.over) {
        const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_ROOM, new Set());
        const left = AFTER_ADD - OVER;
        const sent = await submit(kaspa, rpc, {
          label: "promise-over",
          rows: [sitting.row, fee],
          sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
          outputs: [
            {
              value: left,
              script: kaspa.payToScriptHashScript(built.redeem),
              covenant: binding(kaspa, sitting.covenantId),
            },
            { value: OVER, script: wallets.one.spk },
          ],
          changeScript: wallets.one.spk,
          feeKey: wallets.one.key,
          feeIndex: 1,
          sigs: [{ input: 0, built, entry: "withdraw", key: wallets.one.key, args: [Number(OVER), OWNER] }],
        });
        if (sent.accepted) throw new Error(`over-withdraw was accepted ${sent.id}`);
        if (!scriptReject(sent.error)) throw new Error(`over-withdraw was not a script rejection: ${sent.error}`);
        state.over = { txid: sent.id, error: sent.error, take: OVER.toString() };
        saveJson(STATE_FILE, state);
        journal({ label: "promise-over", accepted: false, txid: sent.id, take: OVER.toString(), error: sent.error });
        say(`over-withdraw rejected txid=${sent.id}`);
      }
      const again = await findRow(rpc, kaspa, built, AFTER_ADD);
      if (!again) throw new Error("the lock moved during the over-withdraw");
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_ROOM, new Set());
      const taken = await submit(kaspa, rpc, {
        label: "promise-withdraw",
        rows: [again.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
        outputs: [
          {
            value: AFTER_TAKE,
            script: kaspa.payToScriptHashScript(built.redeem),
            covenant: binding(kaspa, again.covenantId),
          },
          { value: TAKE, script: wallets.one.spk },
        ],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 1,
        sigs: [{ input: 0, built, entry: "withdraw", key: wallets.one.key, args: [Number(TAKE), OWNER] }],
      });
      if (!taken.accepted) throw new Error(`withdraw rejected: ${taken.error}`);
      mineOne(wallets.three.address);
      const row = await waitRow(rpc, kaspa, built, AFTER_TAKE);
      const paid = await outputAt(rpc, wallets.one.address, taken.id, 1);
      if (!paid || BigInt(paid.amount) !== TAKE) throw new Error("withdraw did not pay the cushion");
      state.phase = "withdrawn";
      state.withdraw = { txid: taken.id, born: row.born, covenantId: row.covenantId, fee: taken.fee, take: TAKE.toString() };
      saveJson(STATE_FILE, state);
      journal({ label: "promise-withdraw", txid: taken.id, covenantId: row.covenantId, fee: taken.fee, take: TAKE.toString() });
      say(`withdraw txid=${taken.id} take=${TAKE}`);
    }

    if (state.phase === "withdrawn") {
      const sitting = await findRow(rpc, kaspa, built, AFTER_TAKE);
      if (!sitting) throw new Error("withdrawn output is not spendable");
      if (!state.short) {
        const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_ROOM, new Set());
        const sent = await submit(kaspa, rpc, {
          label: "promise-short",
          rows: [sitting.row, fee],
          sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
          outputs: [
            { value: AFTER_TAKE - SHORT, script: wallets.one.spk },
            { value: SHORT, script: wallets.two.spk },
          ],
          changeScript: wallets.one.spk,
          feeKey: wallets.one.key,
          feeIndex: 1,
          sigs: [{ input: 0, built, entry: "claim", key: wallets.two.key, args: [OWNER] }],
        });
        if (sent.accepted) throw new Error(`short claim was accepted ${sent.id}`);
        if (!scriptReject(sent.error)) throw new Error(`short claim was not a script rejection: ${sent.error}`);
        state.short = { txid: sent.id, error: sent.error, pay: SHORT.toString() };
        saveJson(STATE_FILE, state);
        journal({ label: "promise-short", accepted: false, txid: sent.id, pay: SHORT.toString(), error: sent.error });
        say(`short claim rejected txid=${sent.id}`);
      }
      const again = await findRow(rpc, kaspa, built, AFTER_TAKE);
      if (!again) throw new Error("the lock moved during the short claim");
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_ROOM, new Set());
      const surplus = AFTER_TAKE - PROMISE;
      const sent = await submit(kaspa, rpc, {
        label: "promise-claim",
        rows: [again.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
        outputs: [
          { value: surplus, script: wallets.one.spk },
          { value: PROMISE, script: wallets.two.spk },
        ],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 1,
        sigs: [{ input: 0, built, entry: "claim", key: wallets.two.key, args: [OWNER] }],
      });
      if (!sent.accepted) throw new Error(`claim rejected: ${sent.error}`);
      mineOne(wallets.three.address);
      mineOne(wallets.three.address);
      const locker = await outputAt(rpc, wallets.one.address, sent.id, 0);
      const bearer = await outputAt(rpc, wallets.two.address, sent.id, 1);
      if (!locker || BigInt(locker.amount) !== surplus) throw new Error("surplus did not land");
      if (!bearer || BigInt(bearer.amount) !== PROMISE) throw new Error("promise did not land");
      const left = await findRow(rpc, kaspa, built, AFTER_TAKE);
      if (left) throw new Error("the lock is still spendable");
      const end = await dagOf(rpc);
      state.phase = "claimed";
      state.claim = {
        txid: sent.id,
        pay: PROMISE.toString(),
        surplus: surplus.toString(),
        fee: sent.fee,
        sink: end.sink,
        virtualDaa: end.virtualDaa.toString(),
      };
      saveJson(STATE_FILE, state);
      journal({ label: "promise-claim", ...state.claim });
      say(`claim txid=${sent.id} pay=${PROMISE} surplus=${surplus} virtualDaa=${end.virtualDaa}`);
    }
  } finally {
    await rpc.disconnect();
  }
}

main()
  .then(() => setTimeout(() => process.exit(process.exitCode || 0), 300))
  .catch((error) => {
    process.stderr.write(`${hide(error && error.stack ? error.stack : error)}\n`);
    setTimeout(() => process.exit(1), 300);
  });
