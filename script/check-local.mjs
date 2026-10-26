// Offline checks. Needs KASPA_WASM pointing at the storm2 kaspa.js module.
// Prints public values only.

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { oraclePub, signPrice, FIXTURE_ORACLE_PRIV } from "./oracle.mjs";

const wasm = process.env.KASPA_WASM;
if (!wasm) {
  console.error("KASPA_WASM is unset");
  process.exit(1);
}

const require = createRequire(wasm);
globalThis.WebSocket = require("websocket").w3cwebsocket;
const kaspa = await import(pathToFileURL(wasm).href);

const builder = new kaspa.ScriptBuilder();
builder.addI64(17n);
builder.addData(Buffer.from([1, 2, 3, 4]));
builder.addI64(1n);
builder.addData(Buffer.from([1]));
builder.addData(Buffer.from("2c49ed65", "hex"));
const got = builder.drain();
const want = "011104010203045151042c49ed65";
if (got !== want) {
  console.error(`sigscript vector ${got}`);
  process.exit(1);
}
console.log("sigscript vector ok");

const key = new kaspa.PrivateKey(Buffer.from(FIXTURE_ORACLE_PRIV).toString("hex"));
const kaspaPub = key.toPublicKey().toXOnlyPublicKey().toString();
const noblePub = oraclePub().toString("hex");
if (kaspaPub !== noblePub) {
  console.error("x-only pubkey mismatch");
  process.exit(1);
}
console.log(`fixture oracle pub ${noblePub}`);

const signed = signPrice(100000000, 1000, 4600);
console.log(`fixture digest ${signed.digest.toString("hex")}`);
console.log(`fixture datasig ${signed.sig.toString("hex")}`);
