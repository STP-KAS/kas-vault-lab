// Private half-devnet position. Talks only to ws://127.0.0.1:17610.
// Mines only through grpc://127.0.0.1:16610. Does not spend peg.sil or the clocks.
// hourWait is 8. That is the desk wait, not an hour.
// A doubling is submitted after that wait and must fail.
// Four thirds of the quote is the step that must be included.

import { createRequire } from "node:module";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { schnorr } from "@noble/curves/secp256k1";
import { blake3 } from "@noble/hashes/blake3";
import { num2bin8, signPrice } from "./oracle.mjs";
import { encodeEntry, withRedeem } from "./sigscript.mjs";

const URL = "ws://127.0.0.1:17610";
const GRPC = "grpc://127.0.0.1:16610";
const NETWORK = "devnet";
const WASM = "C:\\Users\\Remco\\Documents\\kaspa\\tn10-core-stress\\sdk\\kaspa-wasm32-sdk\\nodejs\\kaspa\\kaspa.js";
const SILVERC = "C:\\Users\\Remco\\tools\\silverc\\silverc.exe";
const MINE = "C:\\Users\\Remco\\Documents\\kaspa\\stpnet\\target\\release\\stp-mine.exe";
const KEYS = "C:\\kaspa-stpnet\\wallets\\keys.txt";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "contracts", "position.sil");
const LOCAL = join(ROOT, ".local");
const STATE_FILE = join(LOCAL, "devnet-position-state.json");
const ORACLE_FILE = join(LOCAL, "devnet-oracle.json");
const JOURNAL = join(ROOT, "results", "devnet-position.jsonl");

const HOUR = 8;
const COLLATERAL = 200_000_000n;
const CARRIER = 20_000_000n;
const QUOTE = 300_000_000;
const NEXT = 400_000_000;
const DOUBLE = 600_000_000;
const CENTS = 20;
const PAY = 80_000_000n;
const LEFT = 120_000_000n;
const FEE_FLOOR = 5_000_000n;
const MATURITY = 1000n;
const MAX_SEQUENCE = (2n ** 64n) - 1n;
const ZERO = Buffer.alloc(32);
const EXTENSION = Buffer.alloc(32, 0x50);
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
    { kind: "int", value: fields.amount },
    { kind: "bytes", value: [...Buffer.from(fields.owner, "hex")] },
    { kind: "byte", value: 0 },
    { kind: "byte", value: 0 },
    { kind: "bytes", value: [...ZERO] },
    { kind: "bytes", value: [...EXTENSION] },
    { kind: "int", value: fields.kind },
    { kind: "int", value: fields.debt },
    { kind: "bytes", value: [...Buffer.from(fields.oracle, "hex")] },
    { kind: "int", value: 25_000 },
    { kind: "int", value: 20_000 },
    { kind: "int", value: 500 },
    { kind: "int", value: fields.sealed },
    { kind: "int", value: fields.quote },
    { kind: "int", value: HOUR },
  ];
}

function compile(fields) {
  const key = JSON.stringify(fields);
  const hit = compiled.get(key);
  if (hit) return hit;
  const dir = join(tmpdir(), "kas-vault-lab-position");
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
  const row = { artifact, redeem: Buffer.from(bytes) };
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

function loadOracle(kaspa) {
  const saved = loadJson(ORACLE_FILE, null);
  if (!saved || !saved.priv) throw new Error("devnet oracle file is missing");
  secrets.push(String(saved.priv).toLowerCase());
  const key = new kaspa.PrivateKey(saved.priv);
  const pub = pubOf(kaspa, key);
  const noble = signPrice(1, 1, 2, Buffer.from(saved.priv, "hex")).pub.toString("hex");
  if (noble !== pub) throw new Error("oracle pubkey mismatch");
  return { key, pub, priv: Buffer.from(saved.priv, "hex") };
}

function signStep(price, quote, covenantId, priv) {
  const id = Buffer.from(hexOf(covenantId), "hex");
  if (id.length !== 32) throw new Error("covenant id is not 32 bytes");
  const message = Buffer.concat([num2bin8(price), num2bin8(quote), id]);
  const sig = Buffer.from(schnorr.sign(Buffer.from(blake3(message)), priv));
  if (sig.length !== 64) throw new Error("step signature is not 64 bytes");
  return sig;
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

function parsePushes(script) {
  const bytes = Buffer.isBuffer(script) ? script : Buffer.from(hexOf(script), "hex");
  const pushes = [];
  let i = 0;
  while (i < bytes.length) {
    const op = bytes[i];
    i += 1;
    let len = 0;
    if (op === 0x00) {
      pushes.push(Buffer.alloc(0));
      continue;
    }
    if (op >= 0x01 && op <= 0x4b) len = op;
    else if (op === 0x4c) {
      len = bytes[i];
      i += 1;
    } else if (op === 0x4d) {
      len = bytes.readUInt16LE(i);
      i += 2;
    } else if (op === 0x4e) {
      len = bytes.readUInt32LE(i);
      i += 4;
    } else {
      return { ok: false, op, at: i - 1, pushes };
    }
    if (i + len > bytes.length) return { ok: false, op, at: i, pushes };
    pushes.push(bytes.subarray(i, i + len));
    i += len;
  }
  return { ok: true, pushes };
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

function binding(kaspa, id, index = 0) {
  return new kaspa.CovenantBinding(index, new kaspa.Hash(id));
}

async function submit(kaspa, rpc, spec) {
  let fee = FEE_FLOOR;
  let budget = 40;
  let lastError = "";
  let localId = "";
  for (let attempt = 1; attempt <= 24; attempt += 1) {
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
      computeBudget: spec.sigs.some((sig) => sig.input === index) ? budget : 10,
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
    if (spec.genesis) tx.populateGenesisCovenants([new kaspa.GenesisCovenantGroup(0, spec.genesisOutputs || [0])]);
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
      say(`${spec.label} fee ${fee} below ${required}`);
      fee = required + 1000n;
      continue;
    }
    for (const sig of spec.sigs) {
      const signed = sig.key
        ? Buffer.from(rawSig(kaspa.createInputSignature(tx, sig.input, sig.key)), "hex")
        : blankSig();
      tx.inputs[sig.input].signatureScript = entryOf(kaspa, sig.built, sig.entry, materialize(sig.args, signed));
      tx.inputs[sig.input].computeBudget = budget;
    }
    const feeIndex = spec.feeIndex;
    tx.inputs[feeIndex].signatureScript = p2pkScript(kaspa.createInputSignature(tx, feeIndex, spec.feeKey));
    tx.inputs[feeIndex].computeBudget = 10;
    tx.finalize();
    localId = hexOf(tx.id);
    if (spec.dry) return { accepted: false, dry: true, tx, fee: fee.toString(), budget, id: localId };
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
      if (/fee|mass/i.test(lastError) && attempt < 4) {
        fee *= 2n;
        continue;
      }
      say(`${spec.label} rejected ${lastError}`);
      return { accepted: false, error: lastError, id: localId };
    }
  }
  say(`${spec.label} gave up ${lastError}`);
  return { accepted: false, error: lastError || "not accepted", id: localId };
}

async function pickCoin(rpc, wallet, virtualDaa, need, skip) {
  const rows = await utxosOf(rpc, wallet.address);
  const fit = rows
    .filter((row) => {
      const id = hexOf(row.outpoint.transactionId);
      if (skip.has(`${id}:${row.outpoint.index}`)) return false;
      if (covOf(row)) return false;
      if (scriptHex(row.scriptPublicKey) !== scriptHex(wallet.spk)) return false;
      if (coinbaseOf(row) && daaOf(row) + MATURITY > virtualDaa) return false;
      return BigInt(row.amount) >= need;
    })
    .sort((a, b) => (BigInt(a.amount) < BigInt(b.amount) ? -1 : 1));
  if (!fit.length) throw new Error("no mature coin covers the position");
  return fit[0];
}

async function findRow(rpc, kaspa, built, amount) {
  const address = kaspa.addressFromScriptPublicKey(kaspa.payToScriptHashScript(built.redeem), NETWORK).toString();
  const rows = await utxosOf(rpc, address);
  const hit = rows.find((row) => BigInt(row.amount) === amount);
  if (!hit || !covOf(hit)) return null;
  return { address, row: hit, born: daaOf(hit).toString(), covenantId: covOf(hit) };
}

async function waitRow(rpc, kaspa, built, amount) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findRow(rpc, kaspa, built, amount);
    if (found) return found;
    await sleep(500);
  }
  throw new Error("position output did not appear");
}

function vaultOf(owner, oracle, over) {
  return {
    amount: 0,
    owner,
    oracle,
    kind: 1,
    debt: 0,
    sealed: 0,
    quote: 0,
    ...over,
  };
}

function noteOf(holder, oracle, quote) {
  return {
    amount: CENTS,
    owner: holder,
    oracle,
    kind: 2,
    debt: 0,
    sealed: 1,
    quote,
  };
}

function windowNow() {
  const now = Date.now();
  return { notBefore: now - 1_000, lockTime: now, expiry: now + 60_000 };
}

function le(bytes, value) {
  const buf = Buffer.alloc(bytes);
  if (bytes === 2) buf.writeUInt16LE(Number(value));
  else if (bytes === 4) buf.writeUInt32LE(Number(value));
  else buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(hexOf(value), "hex");
}

function hashChunks(kaspa, chunks) {
  const hasher = new kaspa.TransactionSigningHash();
  for (const chunk of chunks) hasher.update(chunk);
  return bytesOf(hasher.finalize());
}

function dumpTx(tx, rows) {
  return {
    version: Number(tx.version),
    lockTime: tx.lockTime.toString(),
    inputs: tx.inputs.map((input, index) => ({
      txid: hexOf(input.previousOutpoint.transactionId),
      index: Number(input.previousOutpoint.index),
      sequence: input.sequence.toString(),
      sigscript: hexOf(input.signatureScript),
      amount: rows[index].amount.toString(),
      spk: scriptHex(rows[index].scriptPublicKey),
      blockDaa: daaOf(rows[index]).toString(),
      covenantId: covOf(rows[index]) || null,
      isCoinbase: coinbaseOf(rows[index]),
      budget: Number(input.computeBudget || 0),
    })),
    outputs: tx.outputs.map((output) => ({
      value: output.value.toString(),
      spk: scriptHex(output.scriptPublicKey),
      auth: output.covenant ? Number(output.covenant.authorizingInput) : null,
      covenantId: output.covenant ? hexOf(output.covenant.covenantId.toString()) : null,
    })),
  };
}

function writeDump(name, tx, rows) {
  const path = join(tmpdir(), name);
  writeFileSync(path, JSON.stringify(dumpTx(tx, rows)));
  return path;
}

function feeSigOk(kaspa, tx) {
  const input = tx.inputs[2];
  const script = bytesOf(input.signatureScript);
  if (script.length !== 66 || script[0] !== 0x41) return { ok: false, reason: `fee script ${script.length}` };
  const spk = bytesOf(input.utxo.scriptPublicKey.script);
  if (spk.length < 33 || spk[0] !== 0x20) return { ok: false, reason: `fee spk ${spk.length}` };
  const prev = hashChunks(kaspa, tx.inputs.map((row) => Buffer.concat([
    bytesOf(row.previousOutpoint.transactionId),
    le(4, row.previousOutpoint.index),
  ])));
  const seqs = hashChunks(kaspa, tx.inputs.map((row) => le(8, row.sequence)));
  const outs = hashChunks(kaspa, tx.outputs.map((output) => {
    const outSpk = bytesOf(output.scriptPublicKey.script);
    const parts = [le(8, output.value), le(2, output.scriptPublicKey.version), le(8, outSpk.length), outSpk];
    const cov = output.covenant;
    if (cov) parts.push(Buffer.from([1]), le(2, cov.authorizingInput), bytesOf(cov.covenantId.toString()));
    else parts.push(Buffer.from([0]));
    return Buffer.concat(parts);
  }));
  const id = bytesOf(input.previousOutpoint.transactionId);
  const msg = hashChunks(kaspa, [
    le(2, tx.version),
    prev,
    seqs,
    id,
    le(4, input.previousOutpoint.index),
    le(2, input.utxo.scriptPublicKey.version),
    le(8, spk.length),
    spk,
    le(8, input.utxo.amount),
    le(8, input.sequence),
    outs,
    le(8, tx.lockTime),
    Buffer.alloc(20),
    le(8, 0),
    Buffer.alloc(32),
    Buffer.from([1]),
  ]);
  try {
    return { ok: schnorr.verify(script.subarray(1, 65), msg, spk.subarray(1, 33)), reason: "checked" };
  } catch (error) {
    return { ok: false, reason: String(error && error.message ? error.message : error).slice(0, 80) };
  }
}

function ctorArgs(fields) {
  return [
    fields.amount,
    `0x${fields.owner}`,
    "0x00",
    "0x00",
    `0x${"00".repeat(32)}`,
    `0x${EXTENSION.toString("hex")}`,
    fields.kind,
    fields.debt,
    `0x${fields.oracle}`,
    25_000,
    20_000,
    500,
    fields.sealed,
    fields.quote,
    HOUR,
  ];
}

function spkMatches(kaspa, row, redeem) {
  return scriptHex(kaspa.payToScriptHashScript(redeem)) === scriptHex(row.scriptPublicKey);
}

function tailOf(sigHex, redeem) {
  const parsed = parsePushes(sigHex || "");
  const last = parsed.pushes.length ? parsed.pushes[parsed.pushes.length - 1] : Buffer.alloc(0);
  return {
    pushOk: parsed.ok,
    pushes: parsed.pushes.length,
    last: last.length,
    tail: last.equals(Buffer.from(redeem)),
  };
}

async function inspectStep(kaspa, rpc, wallets, oracle, vaultBuilt, noteBuilt) {
  const dag = await dagOf(rpc);
  const vault = await findRow(rpc, kaspa, vaultBuilt, COLLATERAL);
  const note = await findRow(rpc, kaspa, noteBuilt, CARRIER);
  if (!vault || !note) throw new Error("minted position is not spendable");
  const need = BigInt(vault.born) + BigInt(HOUR) - 1n;
  const stepped = compile(vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: NEXT }));
  const steppedNoteBuilt = compile(noteOf(wallets.two.pub, oracle.pub, NEXT));
  const outputs = [
    {
      value: COLLATERAL,
      script: kaspa.payToScriptHashScript(stepped.redeem),
      covenant: binding(kaspa, vault.covenantId, 0),
    },
    {
      value: CARRIER,
      script: kaspa.payToScriptHashScript(steppedNoteBuilt.redeem),
      covenant: binding(kaspa, vault.covenantId, 1),
    },
  ];
  const fee = await pickCoin(rpc, wallets.one, dag.virtualDaa, FEE_FLOOR, new Set());
  const stepSig = signStep(NEXT, QUOTE, vault.covenantId, oracle.priv);
  const id = Buffer.from(hexOf(vault.covenantId), "hex");
  const message = Buffer.concat([num2bin8(NEXT), num2bin8(QUOTE), id]);
  const sigOk = schnorr.verify(stepSig, blake3(message), Buffer.from(oracle.pub, "hex"));
  const preview = await submit(kaspa, rpc, {
    label: "position-inspect",
    dry: true,
    rows: [vault.row, note.row, fee],
    sequences: [0n, MAX_SEQUENCE, MAX_SEQUENCE],
    lockTime: need,
    outputs,
    changeScript: wallets.one.spk,
    feeKey: wallets.one.key,
    feeIndex: 2,
    sigs: [
      { input: 0, built: vaultBuilt, entry: "step", key: null, args: [NEXT, stepSig] },
      { input: 1, built: noteBuilt, entry: "stepNote", key: null, args: [NEXT, stepSig] },
    ],
  });
  const tx = preview.tx;
  const vaultTail = tailOf(tx.inputs[0].signatureScript, vaultBuilt.redeem);
  const noteTail = tailOf(tx.inputs[1].signatureScript, noteBuilt.redeem);
  const outFacts = [];
  for (let i = 0; i < tx.outputs.length; i += 1) {
    const cov = tx.outputs[i].covenant;
    outFacts.push(cov ? `${i}:auth${cov.authorizingInput}` : `${i}:none`);
  }
  const seqFacts = [];
  for (let i = 0; i < tx.inputs.length; i += 1) seqFacts.push(`${i}:${tx.inputs[i].sequence}`);
  say(`inspect virtual=${dag.virtualDaa} vaultBorn=${vault.born} noteBorn=${note.born} need=${need} past=${dag.virtualDaa > need}`);
  say(`inspect rowDaa=${vault.row.blockDaaScore} entryDaa=${vault.row.entry && vault.row.entry.blockDaaScore} noteRowDaa=${note.row.blockDaaScore}`);
  say(`inspect sameId=${vault.covenantId === note.covenantId} idLen=${hexOf(vault.covenantId).length} sigOk=${sigOk}`);
  say(`inspect redeem vault=${vaultBuilt.redeem.length} note=${noteBuilt.redeem.length} stepped=${stepped.redeem.length} steppedNote=${steppedNoteBuilt.redeem.length}`);
  say(`inspect spk vault=${spkMatches(kaspa, vault.row, vaultBuilt.redeem)} note=${spkMatches(kaspa, note.row, noteBuilt.redeem)}`);
  say(`inspect tail vault=${vaultTail.tail} pushes=${vaultTail.pushes} last=${vaultTail.last} pushOk=${vaultTail.pushOk}`);
  say(`inspect tail note=${noteTail.tail} pushes=${noteTail.pushes} last=${noteTail.last} pushOk=${noteTail.pushOk}`);
  const feeCheck = feeSigOk(kaspa, tx);
  say(`inspect lock=${tx.lockTime} seq=${seqFacts.join(",")} outs=${outFacts.join(",")} fee=${preview.fee} amountNote=${note.row.amount} amountVault=${vault.row.amount} feeSig=${feeCheck.ok} ${feeCheck.reason}`);
  const feeHex = "20" + "11".repeat(32) + "ac";
  const sigHex = `0x${stepSig.toString("hex")}`;
  const tests = ["step", "stepNote"].map((name, index) => ({
    name: `live_${name}`,
    function: name,
    constructor_args: ctorArgs(index === 0 ? vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: QUOTE }) : noteOf(wallets.two.pub, oracle.pub, QUOTE)),
    args: [NEXT, sigHex],
    expect: "pass",
    tx: {
      version: 1,
      lock_time: 7,
      active_input_index: index,
      inputs: [
        {
          utxo_value: Number(COLLATERAL),
          sequence: 0,
          covenant_id: `0x${vault.covenantId}`,
          constructor_args: ctorArgs(vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: QUOTE })),
          signature_script_hex: hexOf(tx.inputs[0].signatureScript),
        },
        {
          utxo_value: Number(CARRIER),
          sequence: "SEQUENCE_MAX",
          covenant_id: `0x${note.covenantId}`,
          constructor_args: ctorArgs(noteOf(wallets.two.pub, oracle.pub, QUOTE)),
          signature_script_hex: hexOf(tx.inputs[1].signatureScript),
        },
        {
          utxo_value: 100_000_000,
          sequence: "SEQUENCE_MAX",
          utxo_script_hex: feeHex,
        },
      ],
      outputs: [
        {
          value: Number(COLLATERAL),
          covenant_id: `0x${vault.covenantId}`,
          authorizing_input: 0,
          constructor_args: ctorArgs(vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: NEXT })),
        },
        {
          value: Number(CARRIER),
          covenant_id: `0x${vault.covenantId}`,
          authorizing_input: 1,
          constructor_args: ctorArgs(noteOf(wallets.two.pub, oracle.pub, NEXT)),
        },
        { value: 1_000_000, p2pk_pubkey: "11".repeat(32) },
      ],
    },
  }));
  const outPath = join(tmpdir(), "position-live-step.test.json");
  writeFileSync(outPath, JSON.stringify({ tests }, null, 2).replaceAll('"SEQUENCE_MAX"', "18446744073709551615"));
  say(`inspect wrote ${outPath}`);
}

async function minePast(rpc, address, need) {
  let now = await dagOf(rpc);
  let mines = 0;
  while (now.virtualDaa <= need) {
    if (mines >= 24) throw new Error("DAA did not pass the lock");
    mineOne(address);
    mines += 1;
    now = await dagOf(rpc);
    say(`mined ${mines} virtual=${now.virtualDaa}`);
  }
  return { now, mines };
}

async function main() {
  if (process.argv.includes("--help")) {
    say("node script/devnet-position.mjs");
    return;
  }
  const kaspa = await loadKaspa();
  const wallets = loadWallets(kaspa);
  const oracle = loadOracle(kaspa);
  const rpc = new kaspa.RpcClient({ url: URL, encoding: kaspa.Encoding.Borsh, networkId: NETWORK });
  await rpc.connect();
  const info = await rpc.getServerInfo();
  if (String(info.networkId) !== NETWORK) throw new Error(`refusing network ${info.networkId}`);
  const state = loadJson(STATE_FILE, { phase: "start", hour: HOUR, quote: QUOTE, next: NEXT });
  try {
    if (process.argv.includes("--inspect") && state.phase !== "minted") {
      say(`inspect refused phase=${state.phase}`);
      return;
    }
    if (state.phase === "redeemed") {
      say(`already redeemed txid=${state.redeem.txid} pay=${state.redeem.pay}`);
      return;
    }
    const dag = await dagOf(rpc);
    say(`virtualDaa=${dag.virtualDaa} phase=${state.phase}`);
    journal({ label: "position-dag", virtualDaa: dag.virtualDaa.toString(), phase: state.phase, sink: dag.sink });

    const openFields = vaultOf(wallets.one.pub, oracle.pub, {});
    const sealedFields = vaultOf(wallets.one.pub, oracle.pub, { sealed: 1 });
    const mintedFields = vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: QUOTE });
    const noteFields = noteOf(wallets.two.pub, oracle.pub, QUOTE);
    const steppedFields = vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: NEXT });
    const steppedNote = noteOf(wallets.two.pub, oracle.pub, NEXT);
    const redeemedFields = vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: 0, quote: NEXT });

    if (state.phase === "start") {
      const coin = await pickCoin(rpc, wallets.one, dag.virtualDaa, COLLATERAL + FEE_FLOOR, new Set());
      const built = compile(openFields);
      const opened = await submit(kaspa, rpc, {
        label: "position-open",
        rows: [coin],
        sequences: [MAX_SEQUENCE],
        lockTime: 0,
        genesis: true,
        genesisOutputs: [0],
        outputs: [{ value: COLLATERAL, script: kaspa.payToScriptHashScript(built.redeem) }],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 0,
        sigs: [],
      });
      if (!opened.accepted) throw new Error(`open rejected: ${opened.error}`);
      mineOne(wallets.three.address);
      const row = await waitRow(rpc, kaspa, built, COLLATERAL);
      state.phase = "opened";
      state.open = { txid: opened.id, born: row.born, covenantId: row.covenantId };
      saveJson(STATE_FILE, state);
      journal({ label: "position-open", txid: opened.id, born: row.born, covenantId: row.covenantId });
      say(`open txid=${opened.id} covenant=${row.covenantId}`);
    }

    if (state.phase === "opened") {
      const built = compile(openFields);
      const sitting = await findRow(rpc, kaspa, built, COLLATERAL);
      if (!sitting) throw new Error("open output is not spendable");
      const next = compile(sealedFields);
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_FLOOR, new Set());
      const sealed = await submit(kaspa, rpc, {
        label: "position-seal",
        rows: [sitting.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
        lockTime: 0,
        outputs: [{
          value: COLLATERAL,
          script: kaspa.payToScriptHashScript(next.redeem),
          covenant: binding(kaspa, sitting.covenantId),
        }],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 1,
        sigs: [{ input: 0, built, entry: "seal", key: wallets.one.key, args: [OWNER] }],
      });
      if (!sealed.accepted) throw new Error(`seal rejected: ${sealed.error}`);
      mineOne(wallets.three.address);
      const row = await waitRow(rpc, kaspa, next, COLLATERAL);
      state.phase = "sealed";
      state.seal = { txid: sealed.id, born: row.born, covenantId: row.covenantId };
      saveJson(STATE_FILE, state);
      journal({ label: "position-seal", txid: sealed.id, covenantId: row.covenantId });
      say(`seal txid=${sealed.id} covenant=${row.covenantId}`);
    }

    if (state.phase === "sealed") {
      const built = compile(sealedFields);
      const sitting = await findRow(rpc, kaspa, built, COLLATERAL);
      if (!sitting) throw new Error("sealed output is not spendable");
      const minted = compile(mintedFields);
      const note = compile(noteFields);
      const spot = windowNow();
      const priced = signPrice(QUOTE, spot.notBefore, spot.expiry, oracle.priv);
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, CARRIER + FEE_FLOOR, new Set());
      const sent = await submit(kaspa, rpc, {
        label: "position-mint",
        rows: [sitting.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE],
        lockTime: spot.lockTime,
        outputs: [
          {
            value: COLLATERAL,
            script: kaspa.payToScriptHashScript(minted.redeem),
            covenant: binding(kaspa, sitting.covenantId),
          },
          {
            value: CARRIER,
            script: kaspa.payToScriptHashScript(note.redeem),
            covenant: binding(kaspa, sitting.covenantId),
          },
        ],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 1,
        sigs: [{
          input: 0,
          built,
          entry: "mint",
          key: wallets.one.key,
          args: [CENTS, Buffer.from(wallets.two.pub, "hex"), QUOTE, spot.notBefore, spot.expiry, priced.sig, OWNER],
        }],
      });
      if (!sent.accepted) throw new Error(`mint rejected: ${sent.error}`);
      mineOne(wallets.three.address);
      const vault = await waitRow(rpc, kaspa, minted, COLLATERAL);
      const carrier = await waitRow(rpc, kaspa, note, CARRIER);
      if (vault.covenantId !== carrier.covenantId) throw new Error("mint split the covenant id");
      state.phase = "minted";
      state.mint = { txid: sent.id, born: vault.born, covenantId: vault.covenantId, quote: QUOTE };
      saveJson(STATE_FILE, state);
      journal({ label: "position-mint", txid: sent.id, born: vault.born, covenantId: vault.covenantId, quote: QUOTE });
      say(`mint txid=${sent.id} born=${vault.born} covenant=${vault.covenantId}`);
    }

    if (state.phase === "minted") {
      const vaultBuilt = compile(mintedFields);
      const noteBuilt = compile(noteFields);
      if (process.argv.includes("--inspect")) {
        await inspectStep(kaspa, rpc, wallets, oracle, vaultBuilt, noteBuilt);
        return;
      }
      const vault = await findRow(rpc, kaspa, vaultBuilt, COLLATERAL);
      const note = await findRow(rpc, kaspa, noteBuilt, CARRIER);
      if (!vault || !note) throw new Error("minted position is not spendable");
      const need = BigInt(vault.born) + BigInt(HOUR) - 1n;
      const waited = await minePast(rpc, wallets.three.address, need);
      const againVault = await findRow(rpc, kaspa, vaultBuilt, COLLATERAL);
      const againNote = await findRow(rpc, kaspa, noteBuilt, CARRIER);
      if (!againVault || !againNote) throw new Error("position moved during the wait");
      const stepped = compile(steppedFields);
      const steppedNoteBuilt = compile(steppedNote);
      const doubledVault = compile(vaultOf(wallets.one.pub, oracle.pub, { sealed: 1, debt: CENTS, quote: DOUBLE }));
      const doubledNote = compile(noteOf(wallets.two.pub, oracle.pub, DOUBLE));
      const outputs = [
        {
          value: COLLATERAL,
          script: kaspa.payToScriptHashScript(stepped.redeem),
          covenant: binding(kaspa, againVault.covenantId, 0),
        },
        {
          value: CARRIER,
          script: kaspa.payToScriptHashScript(steppedNoteBuilt.redeem),
          covenant: binding(kaspa, againVault.covenantId, 1),
        },
      ];
      const doubleOutputs = [
        {
          value: COLLATERAL,
          script: kaspa.payToScriptHashScript(doubledVault.redeem),
          covenant: binding(kaspa, againVault.covenantId, 0),
        },
        {
          value: CARRIER,
          script: kaspa.payToScriptHashScript(doubledNote.redeem),
          covenant: binding(kaspa, againVault.covenantId, 1),
        },
      ];
      const tracing = process.argv.includes("--trace");
      const stepOnly = process.argv.includes("--step");
      const feeDouble = await pickCoin(rpc, wallets.one, waited.now.virtualDaa, FEE_FLOOR, new Set());
      const doubled = stepOnly ? { accepted: false, id: "skipped", error: "cap already traced" } : await submit(kaspa, rpc, {
        label: "position-double",
        dry: tracing,
        rows: [againVault.row, againNote.row, feeDouble],
        sequences: [0n, MAX_SEQUENCE, MAX_SEQUENCE],
        lockTime: need,
        outputs: doubleOutputs,
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 2,
        sigs: [
          {
            input: 0,
            built: vaultBuilt,
            entry: "step",
            key: null,
            args: [DOUBLE, signStep(DOUBLE, QUOTE, againVault.covenantId, oracle.priv)],
          },
          {
            input: 1,
            built: noteBuilt,
            entry: "stepNote",
            key: null,
            args: [DOUBLE, signStep(DOUBLE, QUOTE, againVault.covenantId, oracle.priv)],
          },
        ],
      });
      if (!tracing && !stepOnly) {
        journal({
          label: "position-double",
          accepted: doubled.accepted,
          error: doubled.error || "",
          txid: doubled.id,
          virtualDaa: waited.now.virtualDaa.toString(),
          need: need.toString(),
        });
      }
      say(`double accepted=${doubled.accepted} ${doubled.error || doubled.id}`);
      if (tracing && doubled.tx) say(`double dump=${writeDump("position-double-trace.json", doubled.tx, [againVault.row, againNote.row, feeDouble])}`);
      if (doubled.accepted) throw new Error("a doubling was accepted");
      const feeStep = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_FLOOR, new Set([
        `${hexOf(feeDouble.outpoint.transactionId)}:${feeDouble.outpoint.index}`,
      ]));
      say(`step coin=${feeStep.amount} daa=${daaOf(feeStep)} held=${feeDouble.amount}`);
      const preview = await submit(kaspa, rpc, {
        label: "position-step",
        dry: tracing,
        rows: [againVault.row, againNote.row, feeStep],
        sequences: [0n, MAX_SEQUENCE, MAX_SEQUENCE],
        lockTime: need,
        outputs,
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 2,
        sigs: [
          {
            input: 0,
            built: vaultBuilt,
            entry: "step",
            key: null,
            args: [NEXT, signStep(NEXT, QUOTE, againVault.covenantId, oracle.priv)],
          },
          {
            input: 1,
            built: noteBuilt,
            entry: "stepNote",
            key: null,
            args: [NEXT, signStep(NEXT, QUOTE, againVault.covenantId, oracle.priv)],
          },
        ],
      });
      if (tracing) {
        const stepName = stepOnly ? "position-step-again.json" : "position-step-trace.json";
        const stepPath = writeDump(stepName, preview.tx, [againVault.row, againNote.row, feeStep]);
        const feeCheck = feeSigOk(kaspa, preview.tx);
        say(`step dump=${stepPath} id=${preview.id} fee=${preview.fee} feeSig=${feeCheck.ok} ${feeCheck.reason}`);
        return;
      }
      const knownReject = new Set([
        "e8a40216817ad49f3232bdf2fffcf0c49221bd64344f1cf84c6c6fb6e797aca0",
        "fd74b8433ccd63d2ea3d5b5e7f2f687eaab34f4293b2ba4560f1dc5be9397e5e",
        "7d9a3d6d1c6b3235b580596049ab3c351b97b5f4fd3e85a0753efd4744b4e1a2",
        "acb5ba20ac25db42175e799fa5f663640afc3a17742662031e73bb4a2802de0b",
        "b353c6ddfdf8959d65d7bfa485ee07366f8ed7ee16758852ac0eb87ad42b0abb",
      ]);
      const moved = preview;
      if (knownReject.has(moved.id)) throw new Error(`refusing known reject ${moved.id}`);
      say(`step submit id=${moved.id} fee=${moved.fee}`);
      if (!moved.accepted) {
        journal({
          label: "position-step",
          accepted: false,
          error: moved.error || "",
          txid: moved.id,
          need: need.toString(),
        });
        throw new Error(`step rejected: ${moved.error}`);
      }
      mineOne(wallets.three.address);
      const after = await waitRow(rpc, kaspa, stepped, COLLATERAL);
      const afterNote = await waitRow(rpc, kaspa, steppedNoteBuilt, CARRIER);
      state.phase = "stepped";
      state.step = {
        txid: moved.id,
        born: after.born,
        covenantId: after.covenantId,
        quote: NEXT,
        need: need.toString(),
        mines: waited.mines,
        doubleRejected: true,
      };
      if (after.covenantId !== afterNote.covenantId) throw new Error("step split the covenant id");
      saveJson(STATE_FILE, state);
      journal({
        label: "position-step",
        txid: moved.id,
        born: after.born,
        need: need.toString(),
        mines: waited.mines,
        quote: NEXT,
        covenantId: after.covenantId,
      });
      say(`step txid=${moved.id} born=${after.born} mines=${waited.mines}`);
    }

    if (state.phase === "stepped") {
      const vaultBuilt = compile(steppedFields);
      const noteBuilt = compile(steppedNote);
      const redeemed = compile(redeemedFields);
      const vault = await findRow(rpc, kaspa, vaultBuilt, COLLATERAL);
      const note = await findRow(rpc, kaspa, noteBuilt, CARRIER);
      if (!vault || !note) throw new Error("stepped position is not spendable");
      const fee = await pickCoin(rpc, wallets.one, (await dagOf(rpc)).virtualDaa, FEE_FLOOR, new Set());
      const sent = await submit(kaspa, rpc, {
        label: "position-redeem",
        rows: [vault.row, note.row, fee],
        sequences: [MAX_SEQUENCE, MAX_SEQUENCE, MAX_SEQUENCE],
        lockTime: 0,
        outputs: [
          {
            value: LEFT,
            script: kaspa.payToScriptHashScript(redeemed.redeem),
            covenant: binding(kaspa, vault.covenantId),
          },
          { value: PAY, script: wallets.two.spk },
          { value: CARRIER, script: wallets.two.spk },
        ],
        changeScript: wallets.one.spk,
        feeKey: wallets.one.key,
        feeIndex: 2,
        sigs: [
          { input: 0, built: vaultBuilt, entry: "vaultRedeem", key: null, args: [] },
          { input: 1, built: noteBuilt, entry: "noteRedeem", key: wallets.two.key, args: [OWNER] },
        ],
      });
      if (!sent.accepted) throw new Error(`redeem rejected: ${sent.error}`);
      mineOne(wallets.three.address);
      const left = await waitRow(rpc, kaspa, redeemed, LEFT);
      state.phase = "redeemed";
      state.redeem = { txid: sent.id, pay: PAY.toString(), left: LEFT.toString(), covenantId: left.covenantId, born: left.born };
      saveJson(STATE_FILE, state);
      journal({
        label: "position-redeem",
        txid: sent.id,
        pay: PAY.toString(),
        left: LEFT.toString(),
        quote: NEXT,
        covenantId: left.covenantId,
      });
      say(`redeem txid=${sent.id} pay=${PAY} left=${LEFT} covenant=${left.covenantId}`);
    }
  } finally {
    await rpc.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${hide(error && error.stack ? error.stack : error)}\n`);
  process.exitCode = 1;
});
