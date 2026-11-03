import test from "node:test";
import assert from "node:assert/strict";
import { minAttackerBps } from "./issues.mjs";
import {
  LOCK_TIME_THRESHOLD,
  lockTimeDomain,
  positionWindow,
  quoteStepAllows,
  quoteWrite,
  stepAllows,
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

test("the position prices a window only when the attack is half of hashrate", () => {
  assert.equal(minAttackerBps(5_000), 2_500);
  assert.equal(positionWindow(5_000), false);
  assert.equal(positionWindow(9_000), false);
  assert.equal(positionWindow(10_000), true);
  assert.equal(positionWindow(4_999), false);
});
