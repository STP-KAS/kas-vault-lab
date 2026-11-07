// The position. One lock, the full KAS reward, no freeze.
// The quote can move one step. The key cannot write the next quote alone.
// A lock time is either a DAA count or a millisecond timestamp.
// This file does not execute a script and it does not start a node.

import { atRatio, daaWaitAllows, DUST, fairSompi, minAttackerBps } from "./issues.mjs";

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

// Largest next quote the four-thirds cap allows. The script does not look at the lock.
export function maxRise(quote) {
  if (!Number.isInteger(quote) || quote <= 0) throw new Error("bad quote");
  const next = Number((BigInt(quote) * 4n) / 3n);
  if (!quoteStepAllows(quote, next)) throw new Error("bad rise");
  return next;
}

// Redeem pays fair sompi and leaves the surplus in the vault. Both outputs must clear dust.
export function redeemFits(collateral, cents, price) {
  if (!Number.isInteger(collateral) || collateral < 0) throw new Error("bad collateral");
  const pay = fairSompi(cents, price);
  return pay >= DUST && collateral - pay >= DUST;
}

// The cap and the dust, together. step() in position.sil checks only the cap.
export function riseLeavesDust(collateral, cents, quote, next) {
  return quoteStepAllows(quote, next) && redeemFits(collateral, cents, next);
}

// How many maximum rises it takes for redeem to fail. The quote before that rise still fits.
export function risesUntilRedeemFails(collateral, cents, quote) {
  if (!redeemFits(collateral, cents, quote)) throw new Error("already stuck");
  let current = quote;
  for (let step = 1; step <= 16; step++) {
    const next = maxRise(current);
    if (!redeemFits(collateral, cents, next)) {
      const pay = fairSompi(cents, next);
      return { step, quote: next, pay, left: collateral - pay };
    }
    current = next;
  }
  throw new Error("still fits");
}

// Withdraw must leave the mint ratio. At the minimum open the remainder already misses it.
export function withdrawFits(collateral, cents, price, ratioBps) {
  const need = atRatio(cents, price, ratioBps);
  if (need >= collateral) return false;
  return collateral - Math.max(DUST, need) >= 1;
}

// seal, withdraw, vaultRedeem, and noteRedeem do not ask for an oracle signature.
// mint, step, and stepNote do. There is no add entry and no repay entry.
const ORACLE_ENTRY = new Set(["mint", "step", "stepNote"]);
const SILENT_ENTRY = new Set(["seal", "withdraw", "vaultRedeem", "noteRedeem"]);

export function entryAsksOracle(name) {
  if (ORACLE_ENTRY.has(name)) return true;
  if (SILENT_ENTRY.has(name)) return false;
  throw new Error("bad entry");
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
