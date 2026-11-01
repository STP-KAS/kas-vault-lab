// Integer picture of the issues. Not consensus. Not a price.

export const SECONDS_PER_MONTH = 2629800;
export const DUST = 20000000;
export const CARRIER = 20000000;

export function fairSompi(cents, price) {
  if (cents < 0 || price <= 0) throw new Error("bad quote");
  return Math.floor((cents * price + 99) / 100);
}

export function atRatio(cents, price, ratioBps) {
  return Math.floor((fairSompi(cents, price) * ratioBps + 9999) / 10000);
}

// Month index from DAA score. Hashrate is not an argument.
// Same division as CoinbaseManager::subsidy_month after the BPS change:
// seconds = (daa - deflationDaa) / bps, month = seconds / SECONDS_PER_MONTH.
export function subsidyMonth(daa, deflationDaa, bps) {
  if (bps <= 0) throw new Error("bad bps");
  if (daa < deflationDaa) return 0;
  const seconds = Math.floor((daa - deflationDaa) / bps);
  return Math.floor(seconds / SECONDS_PER_MONTH);
}

// Miner dollar value if a hard fork diverts fraction alpha of the subsidy
// into an overcollateralized dollar. CR is bps (15000 = 1.5x).
// V = (s + f) * P - alpha * s * P * (1 - 1/CR)
export function forcedMinerValue(subsidy, fees, price, alphaBps, crBps) {
  const gross = (subsidy + fees) * price;
  const haircut = Math.floor((alphaBps * subsidy * price * (crBps - 10000)) / (crBps * 10000));
  return gross - haircut;
}

// A position minted at `price` is insolvent at `next` when next/price < 1/CR.
export function survivesGap(price, next, crBps) {
  if (price <= 0 || next < 0 || crBps <= 0) throw new Error("bad gap");
  return next * crBps >= price * 10000;
}

export function redeem(vault) {
  if (!vault.quote || vault.quote <= 0) throw new Error("no quote");
  if (vault.debt <= 0) throw new Error("nothing to redeem");
  const pay = fairSompi(vault.debt, vault.quote);
  if (pay < DUST) throw new Error("pay below dust");
  if (vault.collateral <= pay) throw new Error("collateral does not cover redeem");
  const left = vault.collateral - pay;
  if (left < DUST) throw new Error("surplus below dust");
  return {
    debt: 0,
    quote: vault.quote,
    collateral: left,
    paidToHolder: pay,
    carrierReturned: CARRIER,
    feeTakenFromLock: 0,
  };
}

export function mintAllowed(book) {
  if (!book.fresh) return false;
  if (!book.quote || book.quote <= 0) return false;
  return book.collateral >= atRatio(book.mintCents, book.quote, book.ratioBps);
}

// One UTXO can be spent once in a round. Two positions do not share a UTXO.
export function acceptedSpends(txs) {
  const spent = new Set();
  const kept = [];
  for (const tx of txs) {
    if (spent.has(tx.spends)) continue;
    spent.add(tx.spends);
    kept.push(tx.id);
  }
  return kept;
}

// Blue blocks pay the finder. Red rewards pay the miner who merged them.
export function rewardRecipient(color, finder, merger) {
  if (color === "blue") return finder;
  if (color === "red") return merger;
  throw new Error("bad color");
}

// UTC midnights. The caller passes calendar dates. This is not a security proof.
export function utcDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) throw new Error("bad dates");
  return Math.round((end - start) / 86_400_000);
}

// Same integers as the devnet coinbase. Price is quote-units per sompi, before the ratio.
// face = subsidy * alpha * price / cr. Fees stay in the free output.
export function splitReward(subsidy, fees, alphaBps, price, crBps) {
  if (subsidy < 0 || fees < 0 || price <= 0 || crBps <= 0) throw new Error("bad split");
  if (alphaBps < 0 || alphaBps > 10_000) throw new Error("bad alpha");
  const diverted = Math.floor((subsidy * alphaBps) / 10_000);
  const free = subsidy - diverted + fees;
  const face = Math.floor((subsidy * alphaBps * price) / crBps);
  return { free, diverted, face };
}

// Redeem the face at once. The surplus stays locked. minerKas is what the finder holds after that.
export function redeemMined(subsidy, fees, alphaBps, price, crBps) {
  const parts = splitReward(subsidy, fees, alphaBps, price, crBps);
  const kasBack = Math.floor(parts.face / price);
  if (kasBack > parts.diverted) throw new Error("redeem exceeds the lock");
  return {
    ...parts,
    kasBack,
    surplus: parts.diverted - kasBack,
    minerKas: parts.free + kasBack,
  };
}

// Equal blocks. Face paid to the finder is the finder's share of the blocks.
export function faceShare(found, totalBlocks, subsidy, alphaBps, price, crBps) {
  if (!Number.isInteger(found) || !Number.isInteger(totalBlocks)) throw new Error("bad share");
  if (found < 0 || found > totalBlocks || totalBlocks <= 0) throw new Error("bad share");
  const one = splitReward(subsidy, 0, alphaBps, price, crBps).face;
  return { face: one * found, all: one * totalBlocks };
}

// coinbase supply follows the subsidy. A voluntary lock follows the sompi someone locked.
export function supplyOf(path, subsidy, locked, alphaBps, price, crBps) {
  if (path === "coinbase") return splitReward(subsidy, 0, alphaBps, price, crBps).face;
  if (path === "lock") return locked;
  throw new Error("bad path");
}

// A shared pot moves only when enough signatures are present.
export function potMoves(signatures, required) {
  if (required <= 0 || signatures < 0) throw new Error("bad pot");
  return signatures >= required;
}
