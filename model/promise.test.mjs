import test from "node:test";
import assert from "node:assert/strict";
import {
  afterAdd,
  afterWithdraw,
  claimPays,
  feeStaysOut,
  openAllows,
  samePromise,
  withdrawAllows,
} from "./promise.mjs";

const LOCK = 200_000_000;
const PROMISE = 100_000_000;

test("a lock can cover a smaller promise", () => {
  assert.equal(openAllows(LOCK, PROMISE), true);
  assert.equal(openAllows(LOCK, LOCK), true);
  assert.equal(openAllows(LOCK, LOCK + 1), false);
  assert.equal(openAllows(LOCK, 0), false);
  assert.equal(openAllows(0, PROMISE), false);
});

test("adding sompi does not change the promise", () => {
  const next = afterAdd(LOCK, PROMISE, 50_000_000);
  assert.deepEqual(next, { locked: 250_000_000, promise: PROMISE });
  assert.equal(samePromise(PROMISE, next.promise), true);
  assert.equal(samePromise(PROMISE, 200_000_000), false);
});

test("the locker can take only the cushion", () => {
  assert.equal(withdrawAllows(LOCK, PROMISE, PROMISE), true);
  assert.equal(withdrawAllows(LOCK, PROMISE, PROMISE + 1), false);
  assert.equal(withdrawAllows(LOCK, LOCK, 1), false);
  const left = afterWithdraw(LOCK, PROMISE, PROMISE);
  assert.deepEqual(left, { locked: PROMISE, promise: PROMISE });
});

test("the bearer is paid the promise and the surplus goes back", () => {
  assert.deepEqual(claimPays(LOCK, PROMISE), { pay: PROMISE, surplus: PROMISE });
  assert.deepEqual(claimPays(LOCK, LOCK), { pay: LOCK, surplus: 0 });
  assert.equal(feeStaysOut(LOCK, PROMISE), true);
  assert.throws(() => claimPays(LOCK, LOCK + 1), /bad claim/);
});
