import test from "node:test";
import assert from "node:assert/strict";
import { paymaster, read, shape, spendAllowed } from "./doors.mjs";

const onKaspa = { orderedByMiners: true, sequencer: false };

test("a freeze token on Kaspa is ordered by miners and is not bearer", () => {
  const tetherShaped = read(shape("freeze-token", {
    ...onKaspa,
    freezeCirculating: true,
    unboundMint: true,
    priced: true,
  }));
  assert.equal(tetherShaped.orderingDecentralized, true);
  assert.equal(tetherShaped.circulatingBearer, false);
  assert.equal(tetherShaped.fits, false);
});

test("a door-only note is bearer in circulation and still has an issuer at the door", () => {
  const door = shape("door", {
    ...onKaspa,
    freezeCirculating: false,
    unboundMint: true,
    priced: true,
  });
  const view = read(door);
  assert.equal(view.orderingDecentralized, true);
  assert.equal(view.circulatingBearer, true);
  assert.equal(view.fits, true);
  assert.equal(door.unboundMint, true);
});

test("the vault study is bearer, priced, and still has a quote key", () => {
  const vault = shape("vault", { ...onKaspa, quoteKey: true, priced: true });
  assert.equal(read(vault).fits, true);
  assert.equal(vault.quoteKey, true);
  assert.equal(vault.freezeCirculating, false);
});

test("a receipt is bearer and not priced", () => {
  const receipt = read(shape("receipt", { ...onKaspa, priced: false }));
  assert.equal(receipt.circulatingBearer, true);
  assert.equal(receipt.fits, false);
});

test("a subsidy split cuts the miners", () => {
  const cut = read(shape("subsidy", { ...onKaspa, priced: true, subsidyHaircut: 1 }));
  assert.equal(cut.minersUncut, false);
  assert.equal(cut.fits, false);
});

test("a rollup sequencer is not Kaspa ordering", () => {
  const rollup = read(shape("rollup", {
    orderedByMiners: true,
    sequencer: true,
    priced: true,
  }));
  assert.equal(rollup.orderingDecentralized, false);
});

test("an open relayer pays the miner in KAS and is not a sequencer", () => {
  const out = paymaster({
    noteToRecipient: 100,
    noteToRelayer: 1,
    kasFromRelayer: 5000,
    minerKas: 5000,
  });
  assert.equal(out.userSpentNotes, 101);
  assert.equal(out.minerKas, 5000);
  assert.equal(out.sequencer, null);
});

test("a miner can include a frozen spend and the script still rejects it", () => {
  assert.equal(spendAllowed(true, true), false);
  assert.equal(spendAllowed(true, false), true);
  assert.equal(spendAllowed(false, false), false);
});
