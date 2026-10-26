// Price stand-in. Kaspa core has no price oracle.
// The message is three little-endian 8-byte integers: price, notBefore, expiry.
// The oracle signs blake3(message) with BIP340. The signature is 64 bytes.
// FIXTURE_ORACLE_PRIV is a debugger scalar. Never fund it.

import { schnorr } from "@noble/curves/secp256k1";
import { blake3 } from "@noble/hashes/blake3";

export const FIXTURE_ORACLE_PRIV = Uint8Array.from([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
]);

export function num2bin8(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("window field is out of range");
  }
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

export function priceMessage(price, notBefore, expiry) {
  return Buffer.concat([num2bin8(price), num2bin8(notBefore), num2bin8(expiry)]);
}

export function oraclePub(priv = FIXTURE_ORACLE_PRIV) {
  return Buffer.from(schnorr.getPublicKey(priv));
}

export function signPrice(price, notBefore, expiry, priv = FIXTURE_ORACLE_PRIV) {
  const message = priceMessage(price, notBefore, expiry);
  const digest = Buffer.from(blake3(message));
  const sig = Buffer.from(schnorr.sign(digest, priv));
  if (sig.length !== 64) throw new Error("oracle signature is not 64 bytes");
  return { message, digest, sig, pub: oraclePub(priv) };
}
