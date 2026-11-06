// The handoff. The bearer names the next bearer. The count stays.
// promise.sil is not this file. This file does not execute a script and it does not start a node.

import { chainClaimAllows, claimPays, openAllows } from "./promise.mjs";

const ZERO = "0".repeat(64);

function key(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error("bad " + label);
  return value;
}

// The next bearer is someone else. The zero key is not a bearer.
export function passAllows(bearerNow, nextBearer) {
  const current = key(bearerNow, "bearer");
  const next = key(nextBearer, "next");
  if (current === ZERO || next === ZERO) return false;
  return next !== current;
}

// The lock and the promise are the same numbers after the handoff.
export function passKeeps(locked, promise, nextLocked, nextPromise) {
  if (!openAllows(locked, promise) || !openAllows(nextLocked, nextPromise)) return false;
  return nextLocked === locked && nextPromise === promise;
}

// contracts/promise-pass.sil uses the same surplus rule as promise.sil.
export function passClaimAllows(locked, promise) {
  return chainClaimAllows(locked, promise);
}

export { claimPays };
