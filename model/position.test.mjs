import test from "node:test";
import assert from "node:assert/strict";
import { ageAllows, atRatio, daaSpan, fairSompi, minAttackerBps } from "./issues.mjs";
import {
  LOCK_TIME_THRESHOLD,
  entryAsksOracle,
  lockTimeDomain,
  maxRise,
  positionWindow,
  quoteStepAllows,
  quoteWrite,
  redeemFits,
  riseLeavesDust,
  risesUntilRedeemFails,
  stepAllows,
  withdrawFits,
} from "./position.mjs";

const QUOTE = 300_000_000;

test("one step stays between three quarters and four thirds", () => {
  assert.equal(quoteStepAllows(QUOTE, 400_000_000), true);
  assert.equal(quoteStepAllows(QUOTE, 225_000_000), true);
  assert.equal(quoteStepAllows(QUOTE, QUOTE), true);
  assert.equal(quoteStepAllows(QUOTE, QUOTE * 2), false);
  assert.equal(quoteStepAllows(QUOTE, QUOTE / 2), false);
});

test("a lock time is one domain", () => {
  assert.equal(lockTimeDomain(1_231), "daa");
  assert.equal(lockTimeDomain(LOCK_TIME_THRESHOLD), "timestamp");
  assert.equal(lockTimeDomain(1_793_652_889_881), "timestamp");
  const step = stepAllows(1_224, 8, 1_231, 1_232, false, QUOTE, 400_000_000);
  assert.equal(step.accepts, true);
  assert.equal(step.domain, "daa");
  const stamped = stepAllows(1_224, 8, 1_793_652_889_881, 1_232, false, QUOTE, 400_000_000);
  assert.equal(stamped.domain, "timestamp");
  assert.equal(stamped.accepts, false);
});

test("the desk wait of 8 is not the hour, and a max sequence does not pass", () => {
  const early = stepAllows(1_224, 8, 1_231, 1_224, false, QUOTE, 400_000_000);
  assert.equal(early.consensus, false);
  assert.equal(early.accepts, false);
  const skipped = stepAllows(1_224, 8, 1_231, 1_232, true, QUOTE, 400_000_000);
  assert.equal(skipped.script, false);
  const hour = stepAllows(0, 36_000, 35_999, 36_000, false, QUOTE, 400_000_000);
  assert.equal(hour.accepts, true);
  const doubled = stepAllows(0, 36_000, 35_999, 36_000, false, QUOTE, QUOTE * 2);
  assert.equal(doubled.price, false);
  assert.equal(doubled.accepts, false);
});

test("the key alone does not store the next quote", () => {
  assert.equal(quoteWrite(0, false, true, true), false);
  assert.equal(quoteWrite(0, true, true, false), true);
  assert.equal(quoteWrite(20, false, false, true), false);
  assert.equal(quoteWrite(20, false, true, false), false);
  assert.equal(quoteWrite(20, false, true, true), true);
});

test("a second step is capped against the new quote and waits from the new birth", () => {
  const third = 533_333_333;
  assert.equal(quoteStepAllows(400_000_000, third), true);
  assert.equal(quoteStepAllows(400_000_000, third + 1), false);
  assert.equal(quoteStepAllows(400_000_000, 600_000_000), false);
  assert.equal(quoteStepAllows(QUOTE, third), false);
  const first = stepAllows(1_255, 8, 1_262, 1_263, false, QUOTE, 400_000_000);
  assert.equal(first.accepts, true);
  const reused = stepAllows(1_264, 8, 1_262, 1_272, false, 400_000_000, third);
  assert.equal(reused.script, false);
  assert.equal(reused.accepts, false);
  const second = stepAllows(1_264, 8, 1_271, 1_272, false, 400_000_000, third);
  assert.equal(second.accepts, true);
  assert.equal(second.need, 1_271);
});

test("three maximum rises stick a vault opened at the mint ratio", () => {
  const cents = 20;
  const quote = 300_000_000;
  const ratio = 25_000;
  const collateral = atRatio(cents, quote, ratio);
  assert.equal(fairSompi(cents, quote), 60_000_000);
  assert.equal(collateral, 150_000_000);
  assert.equal(withdrawFits(collateral, cents, quote, ratio), false);
  assert.equal(redeemFits(collateral, cents, quote), true);
  const stuck = risesUntilRedeemFails(collateral, cents, quote);
  assert.equal(stuck.step, 3);
  assert.equal(stuck.quote, 711_111_110);
  assert.equal(stuck.pay, 142_222_222);
  assert.equal(stuck.left, 7_777_778);
  assert.equal(maxRise(533_333_333), 711_111_110);
  const moved = stepAllows(0, 8, 7, 8, false, 533_333_333, 711_111_110);
  assert.equal(moved.price, true);
  assert.equal(moved.accepts, true);
  assert.equal(riseLeavesDust(collateral, cents, 533_333_333, 711_111_110), false);
  assert.equal(redeemFits(collateral, cents, 650_000_000), true);
  assert.equal(fairSompi(cents, 650_000_000), 130_000_000);
  assert.equal(riseLeavesDust(collateral, cents, 533_333_333, 650_000_000), true);
  assert.equal(redeemFits(collateral, cents, 650_000_001), false);
  assert.equal(quoteStepAllows(711_111_110, 533_333_333), true);
  assert.equal(redeemFits(collateral, cents, 533_333_333), true);
  const mined = risesUntilRedeemFails(200_000_000, cents, quote);
  assert.equal(mined.step, 4);
  assert.equal(mined.quote, 948_148_146);
  assert.equal(mined.pay, 189_629_630);
  assert.equal(mined.left, 10_370_370);
  assert.equal(redeemFits(200_000_000, cents, 533_333_333), true);
  assert.equal(entryAsksOracle("step"), true);
  assert.equal(entryAsksOracle("stepNote"), true);
  assert.equal(entryAsksOracle("mint"), true);
  assert.equal(entryAsksOracle("vaultRedeem"), false);
  assert.equal(entryAsksOracle("noteRedeem"), false);
  assert.equal(entryAsksOracle("withdraw"), false);
  assert.equal(entryAsksOracle("seal"), false);
  const halt = daaSpan(30 * 60, 10);
  const settle = daaSpan(30 * 24 * 60 * 60, 10);
  assert.equal(ageAllows(halt, halt, settle, "redeem"), false);
  assert.equal(ageAllows(halt, halt, settle, "repay"), true);
  assert.equal(ageAllows(halt, halt, settle, "add"), true);
});

test("the position prices a window only when the attack is half of hashrate", () => {
  assert.equal(minAttackerBps(5_000), 2_500);
  assert.equal(positionWindow(5_000), false);
  assert.equal(positionWindow(9_000), false);
  assert.equal(positionWindow(10_000), true);
  assert.equal(positionWindow(4_999), false);
});
