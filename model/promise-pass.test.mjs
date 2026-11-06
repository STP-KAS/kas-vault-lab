import test from "node:test";
import assert from "node:assert/strict";
import { claimPays } from "./promise.mjs";
import { passAllows, passClaimAllows, passKeeps } from "./promise-pass.mjs";

const LOCK = 200_000_000;
const PROMISE = 100_000_000;
const ZERO = "0".repeat(64);
const BEARER = "11".repeat(32);
const NEXT = "22".repeat(32);

test("the bearer can name someone else and the count stays", () => {
  assert.equal(passAllows(BEARER, NEXT), true);
  assert.equal(passKeeps(LOCK, PROMISE, LOCK, PROMISE), true);
  assert.equal(passClaimAllows(LOCK, PROMISE), true);
  assert.deepEqual(claimPays(LOCK, PROMISE), { pay: PROMISE, surplus: PROMISE });
});

test("a pass to the same bearer or the zero key is refused", () => {
  assert.equal(passAllows(BEARER, BEARER), false);
  assert.equal(passAllows(BEARER, ZERO), false);
  assert.equal(passAllows(ZERO, NEXT), false);
});

test("a doubled promise is not a handoff", () => {
  assert.equal(passKeeps(LOCK, PROMISE, LOCK, PROMISE * 2), false);
  assert.equal(passKeeps(LOCK, PROMISE, LOCK + PROMISE, PROMISE), false);
});

test("a handoff claim still needs a surplus and the model still allows zero", () => {
  assert.equal(passClaimAllows(LOCK, LOCK), false);
  assert.deepEqual(claimPays(LOCK, LOCK), { pay: LOCK, surplus: 0 });
});
