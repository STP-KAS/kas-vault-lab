# Limits

tUSD-TEST is a test token on TN10. It has no issuer reserve, no dollar account, and no redemption into anything but the sompi this one vault already holds. The script can be solvent at a signed price and still not be a stablecoin.

## Oracle

The price is a signature from a key this lab generated. The node checks the signature and the lock-time window. It does not check a market. A signer who publishes a low price can make a healthy vault liquidatable. A signer who publishes a high price can block a liquidation that a real market would allow. There is no committee, no median, and no delay beyond the one-hour window. The miner median read on 3 Nov 2026 is Kaspa Dollar's page, in `STUDY.md`. It is not this key.

## The stale-price hole

The script requires the transaction lock time to sit inside the signed window, and the window is at most one hour in unix milliseconds. Consensus does something weaker. A time lock time is valid once median time is past it. A transaction whose lock time was inside the window can be mined later. A transaction can also set its lock time to an old expiry, after median time is already past that expiry, and still be final. The debugger rejects a lock time that is already above the expiry carried in the same transaction. It cannot reject the delayed-mining case. This lab does not claim that case is closed.

Unix seconds are the wrong unit on this consensus. `LOCK_TIME_THRESHOLD` in rusty-kaspa `a41a333` is 500,000,000,000. Below that, the lock time is a DAA score. A 2026 unix-second value is below the threshold. The driver uses milliseconds and refuses to build a window that would be read as DAA.

## Peg

Minting at 200% and burning to withdraw keeps one vault overcollateralized at the signed price. It does not keep a token at one dollar when KAS moves and the signer has not published a new price. It does not let a stranger redeem. Two vaults do not share a float. A run on "the stablecoin" is not a state this script has.

The square's OLAF, KUSD, and SquarePeg locks are receipts of sompi at an old quote. They have the same peg limit, for a different reason: the sompi are fixed, so the dollar face moves. `ECONOMICS.md` separates those receipts from this vault.

## Governance

There is no admin key that can change the ratio, the oracle, or the debt. The parameters are constructor state. Replacing them means spending to a successor the current script rejects, which the node will not mine. That is also a limit: a mistake in the oracle key or the ratios is permanent for that lineage. Seal exists so a sloppy genesis cannot mint. It is not a government.

There is no freeze. There is no blacklist. The oracle trust above is the power a signer actually has.

## KCC-20

The field prefix matches Final KCC-20, and this vault's cents are conserved between its debt and its one note. The program rejects borrow schemes `0x01` to `0x03` and every owner scheme except `0x00`. It has no standard transfer entry. KCC-20 says a conforming program must support the enabled borrow schemes. This one does not. A wallet that only speaks KCC-20 will not move the note.

## What a passing TN10 test does not show

A transaction id shows that one node accepted one shape, or rejected it. It does not show that every backend in the public pool would agree. The REST health `p2pId` changed between reads on 26 Oct 2026. `RESULTS.md` lists the id that answered each sample.

A local debugger pass shows the script's `require` lines. It does not show mempool policy, fee, or median time. The owner signature and the real oracle signature are checked on TN10 for the cases that need them.

No mainnet coin moves. The keys under `.local/` are testnet keys. The fixture scalar 1 is not a wallet.

## Peg contract, 1 Nov 2026

The paragraphs above describe `contracts/vault.sil`. They stay. `contracts/peg.sil` is a second contract.

**Fact.** `vaultRedeem` and `noteRedeem` pay `fairSompi(debt, quote)` to the note owner and leave the surplus on the vault output. They do not call `priceMessage`. The 27 Oct sentence "it does not let a stranger redeem" is true of `vault.sil` and false of this redeem, for the holder of that one note.

**Fact.** Mint and both refresh entries still call `priceMessage`. The delayed-mining hole above still applies to those entries. Redeem does not close it for them.

**Fact.** The redeem checks `outputs[0].value == inputs[0].value - pay` and returns the carrier on output 2. A fee taken from the lock fails that equality.

**Fact.** `peg.sil` has no liquidation entry. A crash through the liquidation ratio is still the 27 Oct liquidate entries, on the other contract, not on this one.

## A hard record is not a stable price

**Fact.** The day counts, the devnet redeem integers, the 4-of-6 face share, the zero-subsidy face, and the 20000-of-20000 pot are model checks. They do not execute `peg.sil`. They do not move a market.

**Reasoning.** A Kaspa UTXO is as hard to rewrite as the chain it sits in. That hardness is the history. A price in an outside unit is a number someone has to supply. Years of proof of work on Bitcoin did not write that number into the protocol. A mined face that follows hashrate gives the largest pools the largest new inventory. The model shows the share. It does not show a rule that can cap a person, because the chain has no person. This study does not claim a stablecoin.

**Fact.** The oracle key is still a key. Storing its last price does not check a market. Two covenant ids are still two notes. The 2 Nov redeem ids are in `RESULTS.md`. The key that signed them also replaced the stored price, and the payout followed.

**Fact.** On the private devnet, after virtual DAA 1197, a mature free output spent and the paired lock did not. Waiting out coinbase maturity did not turn the stored face into a payment or a price.

**Fact.** On 2 Nov 2026 the same chain rejected an immature coinbase spend, and the next block paid a 200000 sompi fee as KAS rather than as face. A second devnet at five percent paid 29 locks of 220000000 sompi and face 146666666. The model still marks a drop from 3 to 1 as insolvent at ratio 1.5, at either slice. A face of zero at a non-zero subsidy is a property of the integer, checked in the model, and it was not paid on these chains because they are at the month-0 subsidy. None of these runs is a market.

**Fact.** Later the same day the half-split devnet accepted two holder redeems of `peg.sil` and then a third, after `refreshSolo` doubled the stored price. The third redeem paid the same 100000000 sompi for 50 cents that the first had paid for 100 cents. The script has a transaction id. The price has a key. `peg.sil` still has no liquidation entry. The `STP1` coinbase script was not changed.

**Fact.** The same evening a mint signed inside its window was included after the expiry. Mint `9eb4a0d71e0b4d3aba458d05475a169f80183a8ab24e2af8443e05b04694c89f` landed in block `1076583701234c34600ca5afef17e60576a52125b5c1fe64acb5457ae4300fa3`. The block timestamp is 2515 milliseconds after the signed expiry. The past median time was 74706069 milliseconds behind that block. The script accepted the mint. The check it performed is `OpTxLockTime` against the numbers in the oracle message. This devnet's script cannot read the including block's timestamp. The hole named above was run. It is still open. The redeem of that mint paid 25000000 sompi and left 75000000, because the lab key had signed price 100000000 for 25 cents while the vault's old stored quote was 200000000 and the debt was 0.

**Fact.** The same evening the lab key repriced a note that address two already held. Refresh does not take the holder's signature. A different key was rejected. Price 400000000 made `fairSompi` 80000000 against 75000000 of collateral, and a smaller redeem was rejected. Price 200000000 then paid 40000000 for 20 cents that had been minted at 20000000. The ids are in `RESULTS.md`. Holding the note did not hold the price.

**Fact.** On 3 Nov 2026 a new vault, compiled from the edited `peg.sil`, rejected that kind of refresh. The asked price was 400000000. `fairSompi` of the outstanding 20 cents at that price is 80000000, which fits in the 100000000 collateral. The node rejected the script and did not name the rule. The holder redeemed at the mint quote and received 20000000 sompi, leaving 80000000. Covenant A was not upgraded. The 2 Nov source is `contracts/peg-2026-11-02.sil`. `refreshSolo` still writes a quote when debt is 0, and a mint at debt 0 still stores the signed price. The window hole, the median lag, the generic script error, and the missing liquidation entry are unchanged.

**Fact.** Later the same morning that `refreshSolo` was broadcast on the new vault. It stored 200000000 while the vault held 80000000 and the debt was 0. Ten cents then redeemed for 20000000 sompi, the same amount twenty cents had paid at 100000000, and left 60000000. The child block paid the miner 2205222300 sompi and locked 2200000000. The locked output did not pay the holder. The public mainnet reward the same day was 2.06017223 KAS per block, one sompi output in the official coinbase. A smaller miner reward remains a haircut. It remains without a price.

**Fact.** The Kaspa Dollar reading of 3 Nov 2026 is a reading of public pages and an integer model. It is not a measurement on a chain. A private devnet whose only miner is this desk cannot test a median that needs a quarter of hashrate, or a half, of anyone else. No mainnet header was read for the KIP-21 miner-payload field. The whitepaper body was not on the page. The quote in `peg.sil` is still a key.

**Fact.** The five times on those pages were still unnamed as a clock when this note was written. The DAA products, the one-hour anchor, and the choice of the fall cap over the uncapped bullet are this study's completion. A header timestamp can sit 74706069 milliseconds above the past median and remain a legal header. That gap is longer than 30 minutes, so header-minus-median is a bad halt. `peg.sil` still judges its window by the lock time the signer wrote. The DAA wait that did land is `contracts/clock-probe.sil`, wait 8, two spends, included at block DAA 1242 and 1252. Wait 8 is not 18000 and it is not 25920000. The one-entry contract rejected the spend after the same wait, and both of its 50000000 sompi outputs are still there. The node did not name the failing require.

**Fact.** The position on the same devnet stored one quote and moved it once, from 300000000 to 400000000, under a DAA lock of 1262. The redeem paid 80000000 sompi and left 120000000. The step's block time sits 163606227 milliseconds above the same past median. The script did not read that timestamp. The signer is still a key. The contract stores a liquidation ratio and does not liquidate. The full-participation price gate is a model check. One miner did not test it. The ids are in `RESULTS.md`.

## A promise with no outside unit, 4 Nov 2026

**Fact.** `model/promise.mjs` takes sompi only. It does not take a price, an oracle key, a step, or a subsidy. A lock of 200000000 can name a promise of 100000000. The bearer would be paid 100000000 and the locker would receive the other 100000000. Adding 50000000 leaves the promise at 100000000. A withdraw of 100000001 is refused. No script in this repo commits those rules. No transaction was broadcast. The `STP1` lock is unchanged and still does not pay. `peg.sil` and `position.sil` were not edited. The quote on those two contracts is still a key.

**Fact.** Later the same day `contracts/promise.sil` was compiled and broadcast on the half-split devnet. The bearer was paid 100000000 sompi. The surplus of 100000000 returned to the locker. Pay plus surplus equals the lock. The fee was another coin, 5000000 sompi, and the next coinbase paid it on the free half. The locked half stayed 2200000000 and still does not pay. The script requires the lock to be greater than the promise, so a surplus of zero was not broadcast. The model still allows that case. The count does not track an outside unit. The promise moves when KAS moves. The ids are in `RESULTS.md`. Finality was not waited. The quote on `peg.sil` and `position.sil` is still a key.

## The bearer can be named, 5 Nov 2026

**Fact.** `promise.sil` still cannot change its bearer. `contracts/promise-pass.sil` was compiled and broadcast on the same half-split devnet. The current bearer named the next bearer. The lock stayed 200000000 sompi and the promise stayed 100000000. The claim paid the next bearer 100000000 and returned 100000000 to the locker. The next bearer is the address that mines this devnet. The payment is an ordinary output. The fee was another coin. The locked half stayed 2200000000 and still does not pay. A doubled promise was rejected. The count does not track an outside unit. The ids are in `RESULTS.md`. Finality was not waited. The quote on `peg.sil` and `position.sil` is still a key.
