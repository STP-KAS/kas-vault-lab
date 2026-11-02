import test from "node:test";
import assert from "node:assert/strict";
import {
  CARRIER,
  DUST,
  acceptedSpends,
  atRatio,
  fairSompi,
  forcedMinerValue,
  mintAllowed,
  redeem,
  faceShare,
  potMoves,
  redeemMined,
  rewardRecipient,
  splitReward,
  subsidyMonth,
  supplyOf,
  survivesGap,
  utcDays,
} from "./issues.mjs";

test("one dollar of quote is the rounded sompi, and the ratio rounds up", () => {
  assert.equal(fairSompi(100, 100_000_000), 100_000_000);
  assert.equal(atRatio(100, 100_000_000, 20_000), 200_000_000);
  assert.equal(atRatio(1, 100_000_000, 20_000), 2_000_000);
});

test("issuance month follows the clock, not the number of machines", () => {
  const daa = 10_000_000;
  const start = 1_000_000;
  const atTen = subsidyMonth(daa, start, 10);
  const atOne = subsidyMonth(daa, start, 1);
  assert.equal(subsidyMonth(daa, start, 10), atTen);
  assert.equal(subsidyMonth(daa, start, 10), subsidyMonth(daa, start, 10));
  assert.ok(atOne > atTen);
});

test("a subsidy split pays the miner less than the KAS reward", () => {
  const pure = forcedMinerValue(3, 0, 2, 0, 15_000);
  const diverted = forcedMinerValue(3, 0, 2, 10_000, 15_000);
  assert.equal(pure, 6);
  assert.equal(diverted, 4);
  assert.ok(diverted < pure);
});

test("a 1.5x position dies on a gap larger than one third", () => {
  assert.equal(survivesGap(300, 200, 15_000), true);
  assert.equal(survivesGap(300, 199, 15_000), false);
});

test("redeem pays the stored quote and leaves the surplus in the vault", () => {
  const out = redeem({
    debt: 100,
    quote: 100_000_000,
    collateral: 300_000_000,
  });
  assert.equal(out.paidToHolder, 100_000_000);
  assert.equal(out.collateral, 200_000_000);
  assert.equal(out.debt, 0);
  assert.equal(out.quote, 100_000_000);
  assert.equal(out.carrierReturned, CARRIER);
  assert.equal(out.feeTakenFromLock, 0);
  assert.ok(out.collateral >= DUST);
});

test("a stale quote still redeems and does not mint", () => {
  const book = {
    fresh: false,
    quote: 100_000_000,
    collateral: 300_000_000,
    mintCents: 100,
    ratioBps: 20_000,
  };
  assert.equal(mintAllowed(book), false);
  const out = redeem({ debt: 100, quote: book.quote, collateral: book.collateral });
  assert.equal(out.paidToHolder, fairSompi(100, book.quote));
});

test("a fresh quote mints only when the lock covers the ratio", () => {
  const fresh = {
    fresh: true,
    quote: 100_000_000,
    collateral: 200_000_000,
    mintCents: 100,
    ratioBps: 20_000,
  };
  assert.equal(mintAllowed(fresh), true);
  assert.equal(mintAllowed({ ...fresh, collateral: 199_999_999 }), false);
});

test("two positions settle in one round and one shared vault does not", () => {
  const positions = acceptedSpends([
    { id: "a", spends: "pos-a" },
    { id: "b", spends: "pos-b" },
  ]);
  assert.deepEqual(positions, ["a", "b"]);
  const singleton = acceptedSpends([
    { id: "first", spends: "global" },
    { id: "second", spends: "global" },
  ]);
  assert.deepEqual(singleton, ["first"]);
});

test("a red block's reward is paid to the merger", () => {
  assert.equal(rewardRecipient("blue", "finder", "merger"), "finder");
  assert.equal(rewardRecipient("red", "finder", "merger"), "merger");
});

test("the white paper and the genesis block have exact day counts to 1 Nov 2026", () => {
  assert.equal(utcDays("2008-10-31", "2026-11-01"), 6575);
  assert.equal(utcDays("2009-01-03", "2026-11-01"), 6511);
});

test("an immediate redeem of the devnet split returns less KAS than the full subsidy", () => {
  const subsidy = 4_400_000_000;
  const out = redeemMined(subsidy, 0, 5_000, 1, 15_000);
  assert.equal(out.free, 2_200_000_000);
  assert.equal(out.diverted, 2_200_000_000);
  assert.equal(out.face, 1_466_666_666);
  assert.equal(out.kasBack, 1_466_666_666);
  assert.equal(out.surplus, 733_333_334);
  assert.equal(out.minerKas, 3_666_666_666);
  assert.ok(out.minerKas < subsidy);
});

test("new face follows the blocks a miner found", () => {
  const share = faceShare(4, 6, 4_400_000_000, 5_000, 1, 15_000);
  assert.equal(share.face * 6, share.all * 4);
  assert.equal(share.all, splitReward(4_400_000_000, 0, 5_000, 1, 15_000).face * 6);
});

test("a zero subsidy mints no coinbase face, and a lock still follows the sompi", () => {
  assert.equal(supplyOf("coinbase", 0, 0, 5_000, 1, 15_000), 0);
  assert.equal(supplyOf("lock", 0, 2_200_000_000, 5_000, 1, 15_000), 2_200_000_000);
});

test("a pot of 20000 keys does not move on 19999 signatures", () => {
  assert.equal(potMoves(19_999, 20_000), false);
  assert.equal(potMoves(20_000, 20_000), true);
  assert.equal(potMoves(1, 1), true);
});

const MONTH0 = 4_400_000_000;

test("five percent locks less KAS than half and still pays the miner less than the full subsidy", () => {
  const little = splitReward(MONTH0, 0, 500, 1, 15_000);
  assert.equal(little.diverted, 220_000_000);
  assert.equal(little.free, 4_180_000_000);
  assert.equal(little.face, 146_666_666);
  const redeemed = redeemMined(MONTH0, 0, 500, 1, 15_000);
  assert.equal(redeemed.kasBack, 146_666_666);
  assert.equal(redeemed.surplus, 73_333_334);
  assert.equal(redeemed.minerKas, 4_326_666_666);
  assert.ok(redeemed.minerKas < MONTH0);
  assert.ok(redeemed.minerKas > redeemMined(MONTH0, 0, 5_000, 1, 15_000).minerKas);
});

test("a smaller slice does not survive a deeper crash and does not cap a large miner", () => {
  assert.equal(survivesGap(3, 2, 15_000), true);
  assert.equal(survivesGap(3, 1, 15_000), false);
  assert.equal(survivesGap(2, 1, 20_000), true);
  assert.equal(survivesGap(2, 1, 15_000), false);
  const wider = redeemMined(MONTH0, 0, 500, 1, 20_000);
  assert.equal(wider.face, 110_000_000);
  assert.equal(wider.diverted, 220_000_000);
  assert.equal(wider.surplus, 110_000_000);
  assert.equal(wider.minerKas, 4_290_000_000);
  const half = faceShare(4, 6, MONTH0, 5_000, 1, 15_000);
  const little = faceShare(4, 6, MONTH0, 500, 1, 15_000);
  assert.equal(half.face * little.all, little.face * half.all);
  assert.ok(little.all < half.all);
});

test("the value haircut scales with the slice, and a voluntary lock takes none of the subsidy", () => {
  assert.equal(forcedMinerValue(MONTH0, 0, 2, 0, 15_000), 8_800_000_000);
  assert.equal(forcedMinerValue(MONTH0, 0, 2, 500, 15_000), 8_653_333_334);
  assert.equal(forcedMinerValue(MONTH0, 0, 2, 5_000, 15_000), 7_333_333_334);
  assert.equal(splitReward(MONTH0, 0, 0, 1, 15_000).free, MONTH0);
  assert.equal(supplyOf("coinbase", MONTH0, 2_200_000_000, 0, 1, 15_000), 0);
  assert.equal(supplyOf("lock", MONTH0, 2_200_000_000, 0, 1, 15_000), 2_200_000_000);
});

test("a fee stays in the free output and does not change the face", () => {
  const plain = splitReward(MONTH0, 0, 5_000, 1, 15_000);
  const paid = splitReward(MONTH0, 200_000, 5_000, 1, 15_000);
  assert.equal(paid.free, plain.free + 200_000);
  assert.equal(paid.diverted, plain.diverted);
  assert.equal(paid.face, plain.face);
  assert.equal(paid.face, 1_466_666_666);
});

test("the face can hit zero while the subsidy still pays, and the diverted sompi stays locked", () => {
  const tail = splitReward(29, 0, 500, 1, 15_000);
  assert.equal(tail.face, 0);
  assert.equal(tail.diverted, 1);
  assert.equal(tail.free, 28);
  assert.equal(redeemMined(29, 0, 500, 1, 15_000).kasBack, 0);
  assert.equal(splitReward(30, 0, 500, 1, 15_000).face, 1);
  assert.equal(splitReward(2, 0, 5_000, 1, 15_000).face, 0);
  assert.equal(splitReward(3, 0, 5_000, 1, 15_000).face, 1);
  assert.equal(splitReward(0, 0, 500, 1, 15_000).face, 0);
});
