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

## Home machines

**Fact.** IceRiver Kaspa ASICs hash kHeavyHash and join a pool over stratum. The worker is a `kaspa:` address. K1Pool's Kaspa guide pays KAS on a schedule. F2Pool lists KAS as PPLNS. The Kaspa wiki describes the pool taking the block and paying the miners by its own rule (PPLNS, PPS, and the rest). A solo port on a pool still publishes the block for you and pays you from the pool. The ASIC never spends a covenant.

**Fact.** Kat Pool advertises a second payout, NACHO, as a rebate from the pool's fee. That credit is the pool's ledger. It is not a coinbase output and not a vault redeem.

**Reasoning.** Pointing a home ASIC at `peg.sil` does not test the peg. The machine can only win KAS. After the coinbase matures, a wallet can lock that KAS. The wallet step is the whole experiment, and it does not need the ASIC in the room. Moving a mainnet machine onto testnet would stop its KAS work. Testnet hashing is a CPU or GPU job. This study does not change a pool setting and does not name a home worker.

**Reasoning.** The same machines make the pool-gated mint concrete. The address that receives the payout is the pool's customer account, or the pool's own coinbase. If only that address could mint, the pool would be the issuer. `peg.sil` does not have that gate. Anyone who already holds sompi can lock them.

## Left open

The quote is a signature, not a market and not a proof. Finality is longer than acceptance. The note's carrier is not a fee. Two vault ids are two notes. `peg.sil` does not liquidate and was not broadcast. A passing model test is not a node.

## Continued

The question after this study is not which single unit should exist. `DOORS.md` keeps every door and separates ordering from the issuer's key. Miners already order Kaspa. A company that wants its unit sequenced here can have that. It cannot hand the miners its bank and call the result decentralized. A freeze inside circulating transfers stays a freeze, on this chain as on any other.

## Put on the node

**Fact.** On 1 Nov 2026 the live check was whether a TN10 block found by this desk is still only sompi. It is. Two public addresses, one thread each, for about half a minute. `RESULTS.md` names the blocks and the sompi that arrived. The miners were stopped. `peg.sil` was not spent.

**Reasoning.** Two coinbase addresses are still one operator and one asset. Many people locking their own KAS are the shape this lab can express, and each lock is its own UTXO. A coinbase that also paid a second asset would be a different consensus rule. The arithmetic already says that rule pays the miner less KAS. The node confirmed the half that does not need a patch: the block that was found paid sompi.

## Private devnet, 1 Nov 2026

**Fact.** The public TN10 node on this desk was left running. A second process, built from rusty-kaspa `v2.1.0` (`01b532e8`), was started as its own devnet. It listens on localhost, has no DNS seeds, and has no peer. The patch is a local branch. It is not in this repository, and it was not pushed to Kaspa. Mainnet, testnet, and simnet still build the ordinary coinbase. Only devnet applies the split.

**Fact.** The split is the haircut already in `model/issues.mjs`. Half the subsidy (`alpha` 5000 bps) is locked sompi. The other half, plus any fees, is spendable KAS. Fees are not haircut. The STP face is `subsidy * alpha * price / collateral ratio`, integer division, with price 1 and ratio 15000 bps. The coinbase payload still stores the full subsidy. A red reward is split per red block, then the floors are summed, and the merging block gets one free output and one lock. The lock script is version 0: `OP_DATA_4` and the bytes `STP1`, `OP_DATA_8` and the face as a little-endian u64, `OP_PUSHDATA1` and the owner script, then `OP_FALSE`. The script does not pay. The locked sompi stays in the UTXO set. The face is not a transferable coin. A stock wallet does not list it.

**Fact.** Three new devnet addresses mined at that one node, one thread each. The node then reported 25 blocks and virtual DAA 25. The miners were stopped. The node was left up. `RESULTS.md` has the addresses, the sompi, and one coinbase. Coinbase maturity on this net is 1000 DAA, so every output was still immature. No peg transaction was broadcast.

**Reasoning.** On a net where these threads are the only hash, they are the whole consensus, because there is no one else to disagree. That does not move TN10 or mainnet. The price in the face is the constant above. Hashrate did not set it. This run pays the miner less KAS than the unsplit subsidy. It does not redeem, it does not trade, and it does not make STP a balance a stock wallet can spend. The door this lab can already express without a fork is still `peg.sil`: a holder locks KAS and redeems at the stored quote.

## Schedule, holdings, and a safe place

This section is a study. It does not issue a coin and it does not ask a public network to change its subsidy. The arithmetic is in `model/issues.mjs`. The chain code it refers to is Kaspa's. The conclusions are only as strong as those tests and the devnet log.

**Fact.** Bitcoin's white paper is dated 31 October 2008. The genesis block is dated 3 January 2009. From the paper's date to 1 November 2026 is 18 years and 1 day, 6575 days. From the genesis date to the same day is 17 years and 302 days, 6511 days. The model checks the day counts. The heaviest-work rule has been the public chain rule since that genesis block. In August 2010 an overflow bug created an output of about 184 billion bitcoin on a block, and miners reorganized onto a patched binary that removed it. The years are a record of operation. They are not a proof that a majority of hash is unable to rewrite recent history.

**Fact.** In rusty-kaspa `v2.1.0` the coinbase month table has 426 entries. The deflationary reward starts at 44000000000 sompi per second. The unit test in that tree expects the subsidy to be 0 after 36 yearly steps of the table. Fees are a separate input. The private devnet paid 4400000000 sompi per block, which is that per-second number divided by 10.

**Fact.** On the coinbase path the new face is `subsidy * alpha * price / ratio`. A subsidy of 0 produces a face of 0. A voluntary lock does not read the subsidy. Its size is the sompi someone locked. The model checks both.

**Fact.** Redeeming the devnet face at once, at price 1, returns 1466666666 sompi from a lock of 2200000000. The surplus left in the lock is 733333334 sompi. The finder also keeps the free 2200000000. The sum, 3666666666, is less than the 4400000000 subsidy. The devnet script cannot perform this redeem. `OP_FALSE` ends the lock. The number is the model's, beside the outputs the node already produced.

**Fact.** If each block's face is paid to the address that found the block, 4 equal blocks out of 6 carry 4/6 of the new face. The model checks the cross-multiply. The next block can pay the same address again. Kaspa does not keep an account named "one miner." A pool is one script.

**Fact.** A pot that requires 20000 signatures does not move when 19999 are present. A spend that requires the holder's one signature does move. The model checks both. `DOORS.md` labels the shared pot as a freeze.

**Reasoning.** The sentence to keep from the TN10 sample is the one about many locks. Each lock is its own UTXO. The miner is paid the KAS reward for securing the chain. The note appears when a holder locks KAS they already have. A large miner then holds more KAS, which is already true of mining. The miner does not receive the note from the block. The miner can buy the note later. A purchase and a sale both move a market. They do not rewrite another holder's lock.

**Reasoning.** Paying the note to the finder does the opposite. The largest hash receives the largest new inventory on every block, until the subsidy reaches 0. After that the coinbase path mints nothing. No rule that Kaspa can enforce, short of a list of who is whom, stops a pool from holding what it was paid. A list of persons is an issuer. Forbidding the sale means the note cannot be bought. A multisig of thousands of keys over one pot can refuse to sign, and every holder waits. Separate pots are the per-position lock. They are not a multisig.

**Reasoning.** Tether's public shape is a company that creates the token when it accepts reserves, and that releases or destroys it when a customer passes the company's own desk. The chain does not count the bank. The secondary price stays near the desk's price while the desk is believed to be open. The part worth keeping is narrow: new units only against new reserves, and a redeem that returns the reserve asset. The part that does not belong on a bearer note is the desk's power to stop a transfer that has already left. A company that wants that desk still has the door-only issuer in `DOORS.md`. That door is a company. It is not the proof of work.

**Reasoning.** A lock can be as hard to rewrite as Kaspa, because a lock is a Kaspa UTXO. The same hash that rewrites the chain rewrites the lock. The price is a different property. Proof of work does not print the price of KAS in an outside unit. Bitcoin's years of operation did not put a dollar price into the protocol. A quote key, or a market outside the script, still has to name it. The constant used on the devnet is not that price.

**Reasoning.** One machine that is mined by hash, whose large holders cannot move a market, that has no issuer and no freeze, and that still pays miners the full subsidy for the whole schedule, does not close. The mined note gives the inventory to the hash. A bearer holding can be sold. The full miner pay is the unsplit subsidy. What stays inside those constraints is the voluntary lock, the full KAS reward, and no freeze. The coinbase split stays on the list. The bytes were run, and the haircut is a measured number. It is not the rule this study would put on a public network. Kaspa's own subsidy already ends. Extending it so a second unit can be mined forever would be a second monetary policy. This study does not propose that.

## After maturity, 1 Nov 2026

**Fact.** The same private devnet was mined with six CPU threads until virtual DAA passed coinbase maturity. `RESULTS.md` has the counts, the fee, and the two transaction ids. The free output spent. The lock was rejected twice, including once after the free output of that coinbase had confirmed. The rejection text was `stack contains 4 unexpected items`.

**Reasoning.** The earlier line that another coinbase sample would only repeat the haircut was too final. The 25-block run could not spend anything. This run could. What it showed is narrow and worth keeping: matured free sompi are KAS, and the `STP1` script does not become a payment by waiting. The face is still the constant written at coinbase time. No market cleared. No quote was checked. The path that remains open is the one already named. People lock KAS they already hold, each lock its own UTXO, miners paid in full. The coinbase split remains a private measurement, now including a real spend and a real rejection, and it remains off a public network. This is a study. We are not claiming a stablecoin.
