# Study

1 Nov 2026. A study of whether a dollar on Kaspa can be mined, and whether compute is what backs it. This is not support for Kaspa Dollar. It is not a proposal to change the subsidy. The lab token remains worthless.

## What the chain pays

In `kaspanet/rusty-kaspa` `consensus/src/processes/coinbase.rs`, read on master on this date, `expected_coinbase_transaction` builds a coinbase with no inputs. Each blue block in the mergeset, inside the DAA window, is paid `subsidy + total_fees` in sompi to the script that block published. A red block's subsidy and fees are added into one output paid to the merging block's script. `calc_block_subsidy` indexes a month table. `subsidy_month` turns DAA score into seconds by dividing by blocks per second, then divides by `2,629,800`.

More machines do not mint more KAS per day. They split that schedule and raise the cost of a rewrite. Coinbase maturity is 100 seconds times the blocks-per-second parameter, so a new reward cannot be locked inside the block that earned it.

Toccata already allows a covenant to lock sompi and account a note. That does not add a field to the coinbase.

## Six meanings of backed

| Meaning | What a holder can do | What mining supplies |
| --- | --- | --- |
| Secured | A rewrite costs hashrate | The record of any note on Kaspa |
| Produced | Someone burned power to win a schedule | KAS. The power is then gone |
| Escrowed | Burn the claim, receive an asset that is still there | Only the sompi a covenant is holding |
| Priced | The note stays near one dollar when KAS moves | Nothing, until a quote and a redeem exist |
| Hedged | A miner borrows against KAS already mined | A loan. The collateral is KAS, not hashes |
| Physical | Burn the claim, receive a kilowatt-hour | Not this hash function |

Murialdo and Belof, *Cryptoeconomic Systems*, 13 June 2022, describe a token that would mint from about one kilowatt-hour and return one kilowatt-hour through a Szilard engine. Their follow-up says ordinary mining consumes the electricity. The paper says to run that design on proof of stake. A kilowatt-hour also does not cost the same number of dollars everywhere, so that peg would still not be a dollar peg.

## The constructions

**Receipt.** Lock sompi, return those sompi. The holder keeps the coin's price. The 1984 square's KUSD is this shape. It is not a stablecoin.

**Anyone locks KAS and mints a note.** Liquity is the working shape elsewhere: a position, a ratio, redeem of one dollar for one dollar of collateral, and a pool that absorbs liquidations. On Kaspa the position should be its own UTXO. A single global reserve can be spent once per round while many blocks are found in parallel. Djed uses a shared reserve and a reserve coin, with mints only while the reserve is at least 400 percent. That cushion is real. The shared UTXO is the wrong shape on this DAG. DefiLlama showed DJED near one dollar on 1 Nov 2026 with about 1.45 million dollars outstanding. A small peg can hold and still not be money.

**Only miners mint.** The collateral is still matured KAS. Pooled hashrate pays the pool. The pool becomes the issuer.

**A stability pool miners may join.** Voluntary. It defends a note that already exists. It does not create one. It is not in `peg.sil`.

**Divert part of the subsidy.** A hard fork. The miner's value is the KAS reward minus the overcollateral haircut:

`V = (s + f) * P - alpha * s * P * (1 - 1/CR)`

At a 1.5 ratio and a full diversion, one third of that slice is a haircut. `model/issues.mjs` checks a small integer case: subsidy 3, price 2, no fees, full diversion, ratio 1.5, value 4 against an undiverted 6.

**A borrower-paid fee to the including miner.** The subsidy stays whole. The recipient is not known when the transaction is signed, and a later red coloring pays the merger. This is not built.

**Seigniorage, rebase, a new chain.** A second volatile coin that recapitalizes the first is the Terra shape. A rebasing balance is not a unit of account. Merge-mining shares hashes and still needs one of the pegs above. Kash was a separate chain. None of these turn joules into a reserve.

**Dollar paper with a freeze key.** The peg people already trust. The freeze must not reach KAS and must not reach this note. That product can sit beside a vault. It is a different object.

## What is better, for which job

A note whose dollar price stays still while KAS moves: per-position locks, redeem at a quote, no subsidy change, no freeze key. Miners may borrow or keep. They are not the reserve.

A miner who owes a power bill: the same vault, as a loan against KAS they already hold. Escrowed KAS cannot be pointed at another chain. A promise of future hashes can.

A second line on the payslip: KAS fees, plus keeper surplus when a position fails. Not a new coinbase asset.

A kilowatt-hour you can redeem: no construction in this study.

## What the lab did with that

`vault.sil` stays the 27 Oct instrument. It can be solvent at a signed price and still has no holder redeem.

`peg.sil` adds the redeem. The stored quote is the price. The holder is paid that many sompi. The surplus remains locked. Minting still requires a signature over a one-hour window. Refresh can write a new quote without the owner's signature, including a quote that makes the vault look worse. That stops the owner from hiding a crash. It does not make the signer honest.

The model checks the rest: the month index ignores hashrate, the haircut is real, a one-third gap breaks a 1.5 ratio, two positions settle together, one shared UTXO does not, and a red reward goes to the merger.

## Left open

The quote is a signature, not a market and not a proof. Finality is longer than acceptance. The note's carrier is not a fee. Two vault ids are two notes. `peg.sil` does not liquidate and was not broadcast. A passing model test is not a node.
