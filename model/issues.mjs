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

// Fall, in basis points, from an open collateral ratio down to 100% of the debt.
// 250% open is 6000 bps, which is 1 - 1/2.5. This is not a price.
export function fallToUnbackedBps(openBps) {
  if (!Number.isInteger(openBps) || openBps <= 10_000) throw new Error("bad open ratio");
  return 10_000 - Math.floor((10_000 * 10_000) / openBps);
}

// Collateral ratio after the price falls by fallBps, starting from openBps.
export function ratioAfterFall(openBps, fallBps) {
  if (!Number.isInteger(openBps) || !Number.isInteger(fallBps)) throw new Error("bad fall");
  if (openBps <= 0 || fallBps < 0 || fallBps > 10_000) throw new Error("bad fall");
  return Math.floor((openBps * (10_000 - fallBps)) / 10_000);
}

// Exact repay fraction that restores targetBps. bonusBps is the extra collateral
// taken on the repaid debt. num/den is the repaid debt in the same units as value and debt.
export function partialRepay(value, debt, targetBps, bonusBps) {
  if (!Number.isInteger(value) || !Number.isInteger(debt)) throw new Error("bad vault");
  if (debt <= 0 || value < 0 || targetBps <= 10_000) throw new Error("bad vault");
  const den = targetBps - 10_000 - bonusBps;
  if (den <= 0) throw new Error("bad penalty");
  const num = targetBps * debt - 10_000 * value;
  if (num <= 0) return { num: 0, den, seizedNum: 0 };
  const seizedNum = num * (10_000 + bonusBps);
  const seizedDen = den * 10_000;
  return { num, den, seizedNum, seizedDen };
}

// An attacker moves a median only with at least as many votes as the honest voters.
export function votesMoveMedian(attacker, honest) {
  if (attacker < 0 || honest < 0 || attacker + honest === 0) throw new Error("bad votes");
  return attacker >= honest;
}

// A window prices only when at least half its blocks carry a vote.
export function windowHasPrice(votingBlocks, blocks) {
  if (!Number.isInteger(blocks) || blocks <= 0) throw new Error("bad window");
  if (!Number.isInteger(votingBlocks) || votingBlocks < 0 || votingBlocks > blocks) throw new Error("bad window");
  return votingBlocks * 2 >= blocks;
}

// BIP 100, the closed text. Not a Kaspa rule, and not a covenant in this repo.
// A retarget reads 2016 coinbase votes. A missing or zero vote counts as the
// current limit. The raise is the 1512th highest vote, and it may not exceed
// the current limit times 105/100, rounded down. The lower is the 1512th
// lowest, and it may not go under the current limit times 100/105, rounded down.
export const BIP100_PERIOD = 2016;
const BIP100_RANK = 1512;

export function bip100Next(votes, current) {
  if (!Number.isInteger(current) || current <= 0) throw new Error("bad limit");
  if (!Array.isArray(votes) || votes.length !== BIP100_PERIOD) throw new Error("bad votes");
  const filled = votes.map((vote) => {
    if (vote == null || vote === 0) return current;
    if (!Number.isInteger(vote) || vote < 0) throw new Error("bad vote");
    return vote;
  });
  const raise = [...filled].sort((a, b) => b - a)[BIP100_RANK - 1];
  const lower = [...filled].sort((a, b) => a - b)[BIP100_RANK - 1];
  const raiseCap = Math.floor((current * 105) / 100);
  const lowerCap = Math.floor((current * 100) / 105);
  const raiseValue = raise > raiseCap ? raiseCap : raise;
  if (raiseValue > current) return raiseValue;
  const lowerValue = lower < lowerCap ? lowerCap : lower;
  if (lowerValue < current) return lowerValue;
  return current;
}

// floor(current * num / den), in integers. The closed BIP 100 caps are 105/100 and 100/105.
export function floorScale(current, num, den) {
  if (!Number.isInteger(current) || current <= 0) throw new Error("bad level");
  if (!Number.isInteger(num) || !Number.isInteger(den) || num <= 0 || den <= 0) throw new Error("bad scale");
  const next = (BigInt(current) * BigInt(num)) / BigInt(den);
  if (next > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("level too large");
  return Number(next);
}

// How many floors until the integer crosses bound. Null when a floor stalls.
export function stepsToBound(start, bound, num, den) {
  if (!Number.isInteger(start) || !Number.isInteger(bound) || start <= 0 || bound <= 0) throw new Error("bad walk");
  if (bound === start) return { steps: 0, reached: start };
  const rising = bound > start;
  let current = start;
  let steps = 0;
  while (rising ? current < bound : current > bound) {
    const next = floorScale(current, num, den);
    if (rising ? next <= current : next >= current) return null;
    current = next;
    steps += 1;
    if (steps > 100_000) throw new Error("walk too long");
  }
  return { steps, reached: current };
}

// A finder who is cut keeps the subsidy minus the haircut. The haircut is not returned.
export function subsidyAfterCut(subsidy, haircutBps) {
  if (!Number.isInteger(subsidy) || subsidy < 0) throw new Error("bad subsidy");
  if (!Number.isInteger(haircutBps) || haircutBps < 0 || haircutBps > 10_000) throw new Error("bad haircut");
  const haircut = Number((BigInt(subsidy) * BigInt(haircutBps)) / 10_000n);
  const keep = subsidy - haircut;
  return { haircut, keep, cutExceedsKeep: haircut > keep };
}

// Blocks a hashrate share finds, rounded down.
export function coalitionBlocks(blocks, attackerBps) {
  if (!Number.isInteger(blocks) || blocks < 0) throw new Error("bad blocks");
  if (!Number.isInteger(attackerBps) || attackerBps < 0 || attackerBps > 10_000) throw new Error("bad share");
  const found = (BigInt(blocks) * BigInt(attackerBps)) / 10_000n;
  if (found > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("blocks too large");
  return Number(found);
}

// Sompi across those blocks. BigInt, because a long period leaves the safe integer range.
export function coalitionSompi(blocks, attackerBps, perBlock) {
  if (!Number.isInteger(perBlock) || perBlock < 0) throw new Error("bad pay");
  const found = coalitionBlocks(blocks, attackerBps);
  return { found, sompi: BigInt(found) * BigInt(perBlock) };
}

// A band around the median pays whoever the median is. votesMoveMedian is that test.
// The coalition that meets it forfeits nothing. Buterin's 28 Mar 2014 text says
// more than half the votes set the median. The tie here is the study's existing one.
export function bandForfeitSompi(attackerVotes, honestVotes, perVoteHaircut) {
  if (!Number.isInteger(attackerVotes) || !Number.isInteger(honestVotes)) throw new Error("bad votes");
  if (!Number.isInteger(perVoteHaircut) || perVoteHaircut < 0) throw new Error("bad haircut");
  if (attackerVotes < 0 || honestVotes < 0 || attackerVotes + honestVotes === 0) throw new Error("bad votes");
  if (votesMoveMedian(attackerVotes, honestVotes)) return 0n;
  return BigInt(attackerVotes) * BigInt(perVoteHaircut);
}

// Greatest integer whose square is <= n.
export function isqrt(n) {
  if (typeof n !== "bigint" || n < 0n) throw new Error("bad square");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// Floor of the binomial spread, in blocks, when each block is won with shareBps.
// One winner per block. A flood of parallel headers is a different picture.
export function blockSpread(blocks, shareBps) {
  if (!Number.isInteger(blocks) || blocks < 0) throw new Error("bad blocks");
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10_000) throw new Error("bad share");
  const numer = BigInt(blocks) * BigInt(shareBps) * BigInt(10_000 - shareBps);
  const den = 100_000_000n;
  return Number(isqrt(numer / den));
}

// Attacker hashrate, in bps of the network, needed to be half the votes.
// A participation below 5000 bps has no price, so the attacker share is null.
export function minAttackerBps(participationBps) {
  if (!Number.isInteger(participationBps) || participationBps < 0 || participationBps > 10_000) {
    throw new Error("bad participation");
  }
  if (participationBps < 5_000) return null;
  return Math.floor(participationBps / 2);
}

// Remaining price after `hours` of a compound per-hour fall, as a reduced fraction.
export function cappedFall(hours, fallPerHourBps) {
  if (!Number.isInteger(hours) || hours < 0) throw new Error("bad hours");
  if (!Number.isInteger(fallPerHourBps) || fallPerHourBps < 0 || fallPerHourBps >= 10_000) {
    throw new Error("bad cap");
  }
  let num = 1n;
  let den = 1n;
  const keep = BigInt(10_000 - fallPerHourBps);
  for (let i = 0; i < hours; i += 1) {
    num *= keep;
    den *= 10_000n;
  }
  return { num, den };
}

// The five durations named on the Kaspa Dollar pages, counted in DAA.
// The page does not publish these products. bps is the network's, not a hidden constant.
export function daaSpan(seconds, bps) {
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error("bad seconds");
  if (!Number.isInteger(bps) || bps <= 0) throw new Error("bad bps");
  return seconds * bps;
}

// peg.sil compares the signer's lock time with the signed window. The block time is not an input.
export function signerWindowAllows(lockTime, notBefore, expiry) {
  if (!Number.isInteger(lockTime) || !Number.isInteger(notBefore) || !Number.isInteger(expiry)) {
    throw new Error("bad window");
  }
  if (expiry <= notBefore) throw new Error("bad window");
  return lockTime >= notBefore && lockTime <= expiry;
}

// A header timestamp must be newer than the past median and at most toleranceMs ahead of the node.
export function headerTimestampAllowed(header, median, localNow, toleranceMs) {
  if (header <= median) return false;
  return header <= localNow + toleranceMs;
}

// Consensus includes a DAA lock only when lockTime < blockDaa, unless every sequence is max.
// The script asks for born + wait - 1, so the including block is at least `wait` DAA later.
// A max sequence is the bypass. SilverScript 0.1.0 has no CheckLockTimeVerify, so the
// contract compares the 8 sequence bytes instead.
export function daaWaitAllows(born, wait, lockTime, blockDaa, sequenceMax) {
  if (!Number.isInteger(born) || !Number.isInteger(wait) || wait < 1) throw new Error("bad wait");
  if (!Number.isInteger(lockTime) || !Number.isInteger(blockDaa)) throw new Error("bad wait");
  const threshold = 500_000_000_000;
  const need = born + wait - 1;
  const script = lockTime === need && lockTime < threshold && sequenceMax === false;
  const consensus = sequenceMax === true || lockTime < blockDaa;
  return { need, script, consensus, accepts: script && consensus };
}

// One multiplicative step. Down keeps (10000 - capBps) / 10000. Up allows (10000 + capBps) / 10000.
export function anchoredStep(anchor, capBps, direction) {
  if (!Number.isInteger(anchor) || anchor <= 0) throw new Error("bad anchor");
  if (!Number.isInteger(capBps) || capBps < 0 || capBps >= 10_000) throw new Error("bad cap");
  if (direction === "down") return Math.floor((anchor * (10_000 - capBps)) / 10_000);
  if (direction === "up") return Math.floor((anchor * (10_000 + capBps)) / 10_000);
  throw new Error("bad direction");
}

// Until an hour of DAA has passed, the anchor does not move.
// After that, one step. Mint is then not above the median. Liquidation is not below it.
export function cappedQuote(anchor, ageDaa, hourDaa, median, side) {
  if (!Number.isInteger(ageDaa) || !Number.isInteger(hourDaa) || hourDaa < 1) throw new Error("bad hour");
  if (!Number.isInteger(median) || median <= 0) throw new Error("bad median");
  const aged = ageDaa >= hourDaa;
  if (side === "mint") {
    const ceiling = aged ? anchoredStep(anchor, 1_000, "up") : anchor;
    return median < ceiling ? median : ceiling;
  }
  if (side === "liquidation") {
    const floor = aged ? anchoredStep(anchor, 2_500, "down") : anchor;
    return median > floor ? median : floor;
  }
  throw new Error("bad side");
}

// Remaining price, in bps of the start, after a linear drop of pointsBps each hour.
export function linearRemainingBps(hours, pointsBps) {
  if (!Number.isInteger(hours) || hours < 0) throw new Error("bad hours");
  if (!Number.isInteger(pointsBps) || pointsBps < 0) throw new Error("bad points");
  const lost = hours * pointsBps;
  return lost >= 10_000 ? 0 : 10_000 - lost;
}

// What a vault may do when the last accepted price is ageDaa old.
// Before the halt, every action except settlement. During the halt, only add, repay, and close.
// At settlement, mint and liquidate stay stopped, and redeem returns.
export function ageAllows(ageDaa, haltDaa, settleDaa, action) {
  if (!Number.isInteger(ageDaa) || ageDaa < 0) throw new Error("bad age");
  if (!Number.isInteger(haltDaa) || !Number.isInteger(settleDaa) || haltDaa < 1 || settleDaa <= haltDaa) {
    throw new Error("bad age");
  }
  const known = ["mint", "withdraw", "liquidate", "redeem", "add", "repay", "close", "settle"];
  if (!known.includes(action)) throw new Error("bad action");
  if (ageDaa < haltDaa) return action !== "settle";
  if (ageDaa < settleDaa) return action === "add" || action === "repay" || action === "close";
  return action !== "mint" && action !== "liquidate";
}
