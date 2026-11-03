// The position. One lock, the full KAS reward, no freeze.
// The quote can move one step. The key cannot write the next quote alone.
// A lock time is either a DAA count or a millisecond timestamp.
// This file does not execute a script and it does not start a node.

import { daaWaitAllows, minAttackerBps } from "./issues.mjs";

export const LOCK_TIME_THRESHOLD = 500_000_000_000;

// Higher means one note pays more sompi. Three quarters through four thirds.
export function quoteStepAllows(quote, next) {
  if (!Number.isInteger(quote) || !Number.isInteger(next) || quote <= 0 || next <= 0) {
    throw new Error("bad quote");
  }
  const down = BigInt(next) * 4n >= BigInt(quote) * 3n;
  const up = BigInt(next) * 3n <= BigInt(quote) * 4n;
  return down && up;
}

export function lockTimeDomain(lockTime) {
  if (!Number.isInteger(lockTime) || lockTime < 0) throw new Error("bad lock");
  return lockTime < LOCK_TIME_THRESHOLD ? "daa" : "timestamp";
}

// Their page prices a window at 50 percent of blocks, so the floor is 25 percent of hashrate.
// The position posts a price only when half of the votes is at least half of hashrate.
export function positionWindow(participationBps) {
  const attack = minAttackerBps(participationBps);
  if (attack == null) return false;
  return attack >= 5_000;
}

// debt 0: the owner has to sign the mint. The key alone does not store a quote.
// debt above 0: anyone may step, and only inside the cap, after the DAA wait.
export function quoteWrite(debt, ownerSigned, withinCap, waited) {
  if (!Number.isInteger(debt) || debt < 0) throw new Error("bad debt");
  if (debt === 0) return ownerSigned === true;
  return withinCap === true && waited === true;
}

export function stepAllows(born, hourWait, lockTime, blockDaa, sequenceMax, quote, next) {
  const wait = daaWaitAllows(born, hourWait, lockTime, blockDaa, sequenceMax);
  const price = quoteStepAllows(quote, next);
  const domain = lockTimeDomain(lockTime);
  return {
    ...wait,
    price,
    domain,
    accepts: wait.accepts && price && domain === "daa",
  };
}
