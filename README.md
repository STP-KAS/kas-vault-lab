# kas-vault-lab

Intentions are good; thought process is questionable.

Experimental only. This is a study. We are not claiming a stablecoin, a product, or money. This is not Kaspa Dollar, and it is not an endorsement of a mined dollar.

## What we are doing

We are testing a unit that can sit on Kaspa. The unit should be as hard to rewrite as the chain that orders it. Nobody should be able to freeze it. The miners who secure the chain should keep being paid in KAS. The tests stay on this desk: integer checks, a short public testnet sample, a private devnet, a `peg.sil` redeem on that devnet, a DAA wait of 8, and two positions on that devnet. The second one stepped twice, and the redeem paid the second quote. On 4 Nov 2026 a covenant on that devnet paid a promise of 100000000 sompi. The count was chosen once. The promise moves when KAS moves. On 5 Nov 2026 a different contract let that bearer name the next one. The count stayed 100000000. The next bearer is the address that mines this devnet, and the claim paid that address in an ordinary output. `promise.sil` still cannot change its bearer. The short extract, and the handoff under it, is [FINDINGS.md](FINDINGS.md).

## Why

Kaspa already orders transactions, fast, under proof of work. A unit people can invoice in is a reason to settle here. A company coin can be sequenced by that proof of work and still be a company coin. A hard fork that wants a decentralized unit has to stand without that company. Electricity secures the record. It is not a balance anyone can redeem. The price of KAS in another unit is a number someone still has to supply.

## Where and when

Each line is the short record. The link is the note for that day: what was done, why, and what the node returned.

| When | Where | What happened |
| --- | --- | --- |
| 27 Oct 2026 | Public TN10, this repo | [A covenant lab. `vault.sil` locks test KAS and accounts a worthless note. The faucet did not pay, so no vault transaction was broadcast.](RESULTS.md#what-was-asked) |
| 1 Nov 2026 | This repo | [The study, the doors, and the integer model. No new chain rule in this repository.](STUDY.md#what-the-chain-pays) |
| 1 Nov 2026 | Public TN10, about half a minute, two CPU threads | [Ordinary sompi coinbases. The miners were stopped. No patch.](STUDY.md#put-on-the-node) |
| 1 Nov 2026 | Private devnet, localhost only, three addresses, one thread each | [25 blocks. Half the subsidy locked under an `STP1` script. All of it immature. The fork was not pushed.](STUDY.md#private-devnet-1-nov-2026) |
| 1 Nov 2026 | The same notes, no new blocks | [Schedule, holdings, and a shared pot. The model only.](STUDY.md#schedule-holdings-and-a-safe-place) |
| 1 Nov 2026 | The same private devnet, six CPU threads, then one confirming block | [Mature KAS was spent. The node rejected the lock.](STUDY.md#after-maturity-1-nov-2026) |
| 2 Nov 2026 | The same private devnet, localhost | [The block field is virtual DAA. An immature spend was rejected. One more block paid a 200000 sompi fee entirely as KAS.](RESULTS.md#the-block-field-a-fee-and-five-percent-2-nov-2026) |
| 2 Nov 2026 | A second private devnet, other ports, other data directory | [Five percent of the subsidy. Free 41.8 KAS, lock 2.2 KAS. The source constant was put back to half.](STUDY.md#two-sizes-one-door-2-nov-2026) |
| 2 Nov 2026 | The half-split devnet, localhost only | [Two `peg.sil` vaults redeemed 1 KAS each. The lab key then doubled the stored price, and 50 cents paid the same 1 KAS.](STUDY.md#the-note-that-redeemed-2-nov-2026) |
| 2 Nov 2026 | The same half-split devnet, localhost only | [One mint was signed inside a 45 second window and mined 2515 milliseconds after that window closed. The script accepted it.](STUDY.md#the-window-that-was-already-signed-2-nov-2026) |
| 2 Nov 2026 | The same half-split devnet, localhost only | [A 20-cent note was repriced twice without the holder's signature. At the restored price the holder received 0.4 KAS.](STUDY.md#the-note-someone-already-held-2-nov-2026) |
| 3 Nov 2026 | The same half-split devnet, localhost only | [A new vault kept the mint quote. The holder redeemed 0.2 KAS and left 0.8 KAS. Covenant A was not upgraded.](STUDY.md#the-quote-the-holder-already-had-3-nov-2026) |
| 3 Nov 2026 | The same half-split devnet, localhost only | [With nothing outstanding, the lab key stored a new quote and 10 cents redeemed for the same 0.2 KAS. The child block paid the miner 22.052223 KAS and locked 22 KAS.](STUDY.md#the-next-note-and-what-the-block-paid-3-nov-2026) |
| 3 Nov 2026 | The public Kaspa Dollar pages, read here, no new chain | [Their vault bands, their miner median, and a fee beside the subsidy. The whitepaper page says it publishes on 8 November 2026.](STUDY.md#kaspa-dollar-read-on-3-nov-2026) |
| 3 Nov 2026 | The same half-split devnet, localhost only | [Five times on their page, and a DAA wait of 8 accepted twice. The one-entry form of the same wait was rejected.](STUDY.md#their-hours-read-on-3-nov-2026) |
| 3 Nov 2026 | The same half-split devnet, localhost only | [A position locked 2 KAS. One step moved the quote from 300000000 to 400000000. The holder redeemed 0.8 KAS and left 1.2 KAS.](STUDY.md#the-position-3-nov-2026) |
| 3 Nov 2026 | The same half-split devnet, localhost only | [A second covenant stepped from 400000000 to 533333333. The holder redeemed 1.06666667 KAS and left 0.93333333 KAS.](STUDY.md#a-second-step-3-nov-2026) |
| 4 Nov 2026 | These notes, no new chain | [A promise counted in sompi. It is chosen once. No quote, no step, and no coinbase face. The model passed. It was not broadcast.](STUDY.md#the-fixed-promise-4-nov-2026) |
| 4 Nov 2026 | The same half-split devnet, localhost only | [A promise of 100000000 sompi was paid to the bearer. A rewrite of that count was rejected. The miner was paid the full KAS reward.](STUDY.md#the-promise-on-the-node-4-nov-2026) |
| 5 Nov 2026 | These notes, no new chain | [A short extract of the position, the promise, and the 3 Nov page reading. SilverScript v1.0.0 emitted the same bytecode. No new covenant.](FINDINGS.md) |
| 5 Nov 2026 | The same half-split devnet, localhost only | [The bearer handed the same promise of 100000000 sompi to the mining address. A doubled count was rejected. The miner was paid the full KAS reward.](STUDY.md#the-bearer-handed-the-promise-5-nov-2026) |
| 5 Nov 2026 | These notes, no new chain | [The constructor integers, and a model of the handoff. No new covenant.](STUDY.md#the-handoff-integers-5-nov-2026) |
| 6 Nov 2026 | These notes, no new chain | [SchellingCoin, BIP 100, and why this desk does not build that oracle.](STUDY.md#the-oracle-he-named-6-nov-2026) |

The private devnet has no peers, no DNS seeds, and no UPnP. It is not public TN10 and it is not mainnet. Home ASICs were not pointed at it.

## Still open

These are the limits that later measurements did not close. Settled corrections are in [Pushback, kept on 3 Nov 2026](STUDY.md#pushback-kept-on-3-nov-2026).

- The quote is a lab key. On `peg.sil` an outstanding note keeps the mint quote, and when nothing is outstanding the same key still sets the next quote. Covenant A still has the 2 Nov script. On `position.sil` there is no entry that stores a quote from the key alone. While a note is outstanding, that key can still move the quote by one capped step, and the holder does not sign the step. On the second covenant it did that twice, and the redeem paid 106666667 sompi at quote 533333333. [The quote the holder already had.](STUDY.md#the-quote-the-holder-already-had-3-nov-2026) [The position.](STUDY.md#the-position-3-nov-2026)
- A mint signed inside its window was mined after the window. That script reads the lock time the signer wrote. The position's mint uses the same window. The position's step uses a DAA count, and the included step's lock was 1262 in a block whose header DAA is 1263. [The window that was already signed.](STUDY.md#the-window-that-was-already-signed-2-nov-2026)
- `peg.sil` does not liquidate. `position.sil` stores a liquidation ratio and a bonus, and no entry spends them. The older covenant ids and this position are separate notes. The `STP1` lock does not pay. No freeze was added. [After maturity.](STUDY.md#after-maturity-1-nov-2026)
- A unit mined by hash, immovable by a large holder, with no issuer and no freeze, that still pays miners the full subsidy, does not close as one machine. What stays inside those constraints is the voluntary lock, the full KAS reward, and no freeze. [Schedule, holdings, and a safe place.](STUDY.md#schedule-holdings-and-a-safe-place)
- Kaspa Dollar's covenants are unpublished, and the five times on their pages do not name a clock. The DAA wait of 8 was accepted twice. The one-entry form was rejected, and the node did not name the line. Their page still prices a window at half of its blocks, so the attack there can be a quarter of hashrate. The position's model asks for a window where that attack is half of hashrate. This desk is the only miner, so that gate was not mined. [Their hours.](STUDY.md#their-hours-read-on-3-nov-2026)
- Acceptance was not waited out to finality depth. A failed script comes back as one sentence.
- The fixed promise was paid once. The bearer received 100000000 sompi from a lock of 200000000. A rewrite of the count was rejected. A withdraw that would have left less than the promise was rejected. A claim that paid 50000000 was rejected. The chain script requires a surplus above zero, so a lock equal to the promise was not this broadcast. The model still allows that equal case. The promise moves when KAS moves. Finality was not waited. [The promise on the node.](STUDY.md#the-promise-on-the-node-4-nov-2026)
- `promise.sil` still names one bearer. `promise-pass.sil` let that bearer name the next one. The count stayed 100000000 and the lock stayed 200000000 until the claim. The next bearer is the address that mines this devnet. The payment was an ordinary output. A version-1 transaction id does not cover the signature, so the rejected locker signature and the included pass share one id. Finality was not waited. [The bearer handed the promise.](STUDY.md#the-bearer-handed-the-promise-5-nov-2026)
- `position.sil` has no entry that adds collateral. The entries are `seal`, `mint`, `step`, `stepNote`, `withdraw`, `vaultRedeem`, and `noteRedeem`. `withdraw` can reduce the collateral. While the debt is above 0, what remains has to meet the mint ratio. [The handoff integers.](STUDY.md#the-handoff-integers-5-nov-2026)
- The local calculator accepted 2000000 sompi on `fd74b8433ccd63d2ea3d5b5e7f2f687eaab34f4293b2ba4560f1dc5be9397e5e`. The node required 3784000 for transient mass 37840. The position driver now starts at 5000000. That floor is the driver's number. It is not a measurement that the calculator matches the node.
- A pass to the same bearer, and a lock equal to the promise, were not broadcast on `promise-pass.sil`. The script already refuses the same bearer. The file has no withdraw, so a rejected equal-lock claim would leave the sompi in the covenant. The model refuses both. The chain was not asked.
- The oracle named on 6 Nov 2026 was not built here. BIP 100 moves on 1512 of 2016 votes, and by at most 5 percent. The thin window already recorded still moves on a quarter of the hashrate. A coinbase price is not a change to the hash. [The oracle he named.](STUDY.md#the-oracle-he-named-6-nov-2026)

## Shapes

These are different promises. None of them has been chosen. [The doors, side by side.](DOORS.md#the-doors-side-by-side)

- A receipt returns the same sompi. The holder keeps KAS volatility.
- A person locks KAS they already hold. Each lock is its own UTXO. The miner is paid the full KAS reward. `peg.sil` is this shape, and the quote is still a key.
- A coinbase can lock part of the subsidy. Half and five percent were both run on a private devnet. The lock does not spend. This is not a public rule.
- A shared pot of many keys can refuse one signature. That is a freeze. It is not built.
- A company can mint against reserves and redeem at its own door, and can keep a freeze there. [What a Tether-like issuer can do here.](DOORS.md#what-a-tether-like-issuer-can-do-here) It is not built here.
- [Kaspa Dollar's public pages](STUDY.md#kaspa-dollar-read-on-3-nov-2026), read again on 3 Nov 2026, describe a vault at 2.5 times, a liquidation back toward 2.0, and a median of miner prices. The block reward stays whole. The covenants are unpublished. `peg.sil` was not changed to those ratios.
- A rollup puts a sequencer back in front of the payments. Refused as an ordering design.
- The position is the practice this desk would keep while every shape above stays. One person locks KAS they already hold. The miner is paid the full KAS reward. There is no company, no shared pot, no freeze, and no coinbase split. The quote may move by one step, from three quarters through four thirds, and only after a DAA wait. Redeem pays the quote that was stored. A second covenant on the same devnet stepped once more, from 400000000 to 533333333, and the redeem paid that quote. [The position, 3 Nov 2026.](STUDY.md#the-position-3-nov-2026) [A second step, 3 Nov 2026.](STUDY.md#a-second-step-3-nov-2026)
- The fixed promise was broadcast once on the same private devnet. The count is sompi, chosen once, with no quote and no step. The bearer was paid 100000000. It does not replace the position. [The promise on the node, 4 Nov 2026.](STUDY.md#the-promise-on-the-node-4-nov-2026)
- A second file, `promise-pass.sil`, was broadcast once. The bearer named a next bearer. The sompi count stayed. It does not replace `promise.sil`, and `promise.sil` still cannot change its bearer. [The bearer handed the promise, 5 Nov 2026.](STUDY.md#the-bearer-handed-the-promise-5-nov-2026)

## Pushback

Some earlier sentences were wrong, or too final. The ones that still change how to read this repo:

- The devnet face is not a stablecoin, and years of proof of work are not a price. The position does not read the face, and it does not read the constant 1. [The day counts and the constant 1.](STUDY.md#schedule-holdings-and-a-safe-place)
- A note the holder already held was not safe from the 2 Nov script. The 3 Nov `peg.sil` keeps an outstanding quote, and the key can still price the next note when nothing is outstanding. `position.sil` has no entry for that second case. The key can still move an outstanding quote by one capped step. The step in the chain is `e9649e1bab8f00be3ff51ce4a8f55983a7a5f4f349f9cf8937614f9adca09803`.
- "A hashrate majority" is the case where every block votes. At the thinnest window their page prices, half of the votes is a quarter of hashrate. The position's model refuses a price until half of the votes is at least half of hashrate. One block that does not vote then leaves no price. That rule was checked in the model. It was not mined. [The doors.](DOORS.md#two-powers)
- The five times were treated as a mechanism the page had already chosen. The page names the intervals and leaves the clock blank. On the evening read, the uncapped-decrease bullet and the fall-cap sentences were both still there. The position uses one band in both directions. The page has not chosen that band.
- A four-thirds body at a fee of 2000000 sompi, `fd74b8433ccd63d2ea3d5b5e7f2f687eaab34f4293b2ba4560f1dc5be9397e5e`, was rejected because the fee was under 3784000 for transient mass 37840. The local calculator had accepted 2000000. The included body is the step above, at a fee of 5000000.

The settled lines, including the block-count field, the balance reader, and the five percent run, are in [Pushback, kept on 3 Nov 2026](STUDY.md#pushback-kept-on-3-nov-2026).

## The notes

| File | What it is |
| --- | --- |
| [FINDINGS.md](FINDINGS.md) | The short extract, then the handoff. The earlier long notes were not rewritten |
| [STUDY.md](STUDY.md) | The argument, from 1 Nov through the oracle named on 6 Nov |
| [RESULTS.md](RESULTS.md) | What was submitted, and the transaction ids |
| [ISSUES.md](ISSUES.md) | Each question, and whether the code answers it |
| [DOORS.md](DOORS.md) | Who orders, and who holds the key |
| [LIMITS.md](LIMITS.md) | Why this is not a stablecoin |
| [ECONOMICS.md](ECONOMICS.md) | Bands, fees, and what a redeem paid |
| [DESIGN.md](DESIGN.md) | Covenant rules |
| [contracts/peg.sil](contracts/peg.sil) | Holder redeem at the stored quote |
| [contracts/position.sil](contracts/position.sil) | One lock, one capped step, the full KAS reward |
| [contracts/promise.sil](contracts/promise.sil) | One lock, one sompi promise, no quote |
| [contracts/promise-pass.sil](contracts/promise-pass.sil) | The bearer names the next bearer. The count stays |
| [model/promise.mjs](model/promise.mjs) | The same integers. The model still allows a surplus of zero |
| [model/promise-pass.mjs](model/promise-pass.mjs) | The handoff. The next bearer is someone else. The count stays |
| [contracts/vault.sil](contracts/vault.sil) | The 27 Oct vault. Unchanged |
| [RUN.md](RUN.md) | Commands for this desk. Not a public run. |
