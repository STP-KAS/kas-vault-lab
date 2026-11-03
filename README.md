# kas-vault-lab

Intentions are good; thought process is questionable.

Experimental only. This is a study. We are not claiming a stablecoin, a product, or money. This is not Kaspa Dollar, and it is not an endorsement of a mined dollar.

## What we are doing

We are testing a unit that can sit on Kaspa. The unit should be as hard to rewrite as the chain that orders it. Nobody should be able to freeze it. The miners who secure the chain should keep being paid in KAS. The tests stay on this desk: integer checks, a short public testnet sample, a private devnet whose coinbase pays KAS and locks the rest, and a `peg.sil` redeem on that same devnet.

## Why

Kaspa already orders transactions, fast, under proof of work. A unit people can invoice in is a reason to settle here. A company coin can be sequenced by that proof of work and still be a company coin. A hard fork that wants a decentralized unit has to stand without that company. Electricity secures the record. It is not a balance anyone can redeem. The price of KAS in another unit is a number someone still has to supply.

## Where and when

| When | Where | What happened |
| --- | --- | --- |
| 27 Oct 2026 | Public TN10, this repo | A covenant lab. `vault.sil` locks test KAS and accounts a worthless note. The rules are unchanged. |
| 1 Nov 2026 | This repo | The study, the doors, and the integer model. No new chain rule in this repository. |
| 1 Nov 2026 | Public TN10, about half a minute, two CPU threads | Ordinary sompi coinbases. The miners were stopped. No patch. |
| 1 Nov 2026 | Private devnet, localhost only, three addresses, one thread each | 25 blocks. Half the subsidy locked under an `STP1` script. All of it immature. The fork was not pushed. |
| 1 Nov 2026 | The same notes, no new blocks | Schedule, holdings, and a shared pot. The model only. |
| 1 Nov 2026 | The same private devnet, six CPU threads, then one confirming block | Block count and virtual DAA went from 25 to 1196, then to 1197. Mature KAS was spent. The node rejected the lock. |
| 2 Nov 2026 | The same private devnet, localhost | The block field is virtual DAA, not a census. An immature spend was rejected. One more block paid a 200000 sompi fee entirely as KAS. |
| 2 Nov 2026 | A second private devnet, other ports, other data directory | Five percent of the subsidy, 30 blocks. Free 41.8 KAS, lock 2.2 KAS, face 146666666. The source constant was put back to half. |
| 2 Nov 2026 | The half-split devnet, localhost only | Two `peg.sil` vaults. Each holder redeemed 1 KAS and left surplus. The lab quote key then doubled the stored price, and 50 cents paid the same 1 KAS. |
| 2 Nov 2026 | The same half-split devnet, localhost only | One mint was signed inside a 45 second window and mined 2515 milliseconds after that window closed. The script accepted it. The redeem paid 0.25 KAS and left 0.75 KAS. |
| 2 Nov 2026 | The same half-split devnet, localhost only | A 20-cent note was repriced twice without the holder's signature. A foreign key was rejected. At the high price the vault could not pay. At the restored price the holder received 0.4 KAS. |
| 3 Nov 2026 | The same half-split devnet, localhost only | A new vault kept the mint quote. The lab key's refresh to a different price was rejected. The holder redeemed 0.2 KAS and left 0.8 KAS. Covenant A was not upgraded. |
| 3 Nov 2026 | The same half-split devnet, localhost only | With nothing outstanding, the lab key stored a new quote and 10 cents redeemed for the same 0.2 KAS. The child block paid the miner 22.052223 KAS and locked 22 KAS. |
| 3 Nov 2026 | The public Kaspa Dollar pages, read here, no new chain | Their vault bands, their miner median, and a fee beside the subsidy. The whitepaper page says it publishes on 8 November 2026. No third devnet. |

The private devnet has no peers, no DNS seeds, and no UPnP. It is not public TN10 and it is not mainnet. Home ASICs were not pointed at it. They hash for KAS. They do not lock, mint, or redeem.

## The ideas, still open

These are different promises. None of them has been chosen as a product.

- A receipt returns the same sompi. The holder keeps KAS volatility.
- A person locks KAS they already hold. Each lock is its own UTXO. The miner is paid the full KAS reward. Redeem needs a quote. `peg.sil` is this shape. On 2 Nov 2026 two such locks redeemed on the private devnet. The quote was a lab key, and that key changed the payout. Later the same day the key changed the price of a note the holder already held, and the holder did not sign those changes. On 3 Nov 2026 a new vault kept the mint quote. A refresh that asked for a different price was rejected, and the holder redeemed the mint-time sompi. Covenant A still has the 2 Nov script. On the new vault, after the note was gone, `refreshSolo` stored 200000000 with no owner signature, and 10 cents redeemed for the same 20000000 sompi.
- A coinbase can lock part of the subsidy and store a face. The first private devnet ran this at half, so both outputs were large enough to see. Half is a lab size. After maturity the free KAS spent like ordinary KAS, and the node rejected the lock. A second private devnet ran the same rule at five percent: free 41.8 KAS, lock 2.2 KAS, face 146666666. Five percent is still a haircut. It does not survive a deeper price drop than the half, because the crash line is the collateral ratio. The face is not a coin a wallet can send. This is not a public rule.
- A shared pot of many keys can refuse one signature. Every holder then waits. That is a freeze. It is not built.
- A company can mint against reserves and redeem the reserve asset, and can keep a freeze at its own door. That door is not the proof of work. It is not built here.
- Kaspa Dollar's public pages, read on 3 Nov 2026, describe a different shape again. A person locks KAS in a vault, mints at 2.5 times, and a partial liquidation aims back at 2.0 times. The price is a median of prices miners write into the coinbase payload. A window with fewer than half its blocks voting has no price. The block reward stays whole, and an oracle fee in KAS is paid beside it. The fee size is unpublished. The covenants are unpublished. The whitepaper page says "Publishing on 8 November 2026." `peg.sil` was not changed to those ratios.
- A rollup puts a sequencer back in front of the payments. Refused as an ordering design.

## Pushback

A few sentences in this work were wrong, or too final.

- Calling the devnet face a stablecoin was wrong. The price in the script is the constant 1. The node refused to spend the lock. The error was `stack contains 4 unexpected items`.
- Half the subsidy is not "a little." It was chosen so both lines moved.
- "As secure as Kaspa" fits a Kaspa UTXO. It does not fit a price. Bitcoin's record from genesis on 3 Jan 2009 to 1 Nov 2026 is 17 years and 302 days, 6511 days. From the white paper on 31 Oct 2008 it is 18 years and 1 day, 6575 days. Those years did not put a dollar price into the protocol. In August 2010 an overflow was removed by reorganizing onto a patched binary. The years are an operating record.
- A pot of 20,000 keys is not a safe place. The model says 19,999 signatures do not move it.
- Miners declining to dump a note because dumping would hurt them is a wish. It is not a rule. The chain has no person to cap. A pool is one script.
- An earlier note said another sample of the same coinbase would only repeat the haircut. That stopped short. Maturity and a spend had not been tried. They have been tried. The free half spends. The locked half does not.
- The balance reader dropped one face after the free output of that same coinbase was spent. The reader only counts a coinbase while an address output of it remains. The second rejection from the node is the evidence that the lock was still there.
- The gap between 1200 success reports and 1171 new blocks was called unexplained. That was incomplete. The field printed as `blocks` is `estimate_block_count`, which is virtual DAA minus the retention root. It does not include non-DAA blocks. The 1 Nov log accepted 1226 submits. The selected chain at virtual DAA 1197 is 1197 of those, plus genesis in the block walk. The other 29 did not become an extra face. The accepted locks are one per paid block, each exactly half of one subsidy.
- Five percent was then run, because "a smaller diversion has not been run" was true and is no longer true. The smaller slice still pays the miner less than the full subsidy. `survivesGap` does not take the slice as an argument. A higher collateral ratio survives a deeper drop, and an immediate redeem then returns less KAS. A smaller slice does not cap a large miner's share of the face.
- "`peg.sil` has no transaction id" was true through the five percent run. It is no longer true. The redeem ids are in `RESULTS.md`. A confirmed redeem is a covenant UTXO on this private devnet. It is not a market price. The same lab key then stored 200000000 in place of 100000000, and a 50-cent note paid the same 1 KAS the 100-cent note had paid.
- The first stale mint was rejected as not finalized. Sequence 0 and a lock time near the wall clock were ahead of this devnet's median time. After every input sequence was the maximum, the script rejected the expired window. That is not a test of mining a still-valid signature later.
- That later test has now been run. Mint `9eb4a0d71e0b4d3aba458d05475a169f80183a8ab24e2af8443e05b04694c89f` was signed while its lock time was inside the window, held until the wall clock was past the expiry, and accepted. The including block's timestamp is after the expiry. The hope that the node would refuse a late but still-signed window was wrong for this script.
- A note in the holder's hands was treated as safe from a later quote. That was wrong for this script. `refreshVault` and `refreshNote` take the oracle signature and no holder signature. The 20-cent note was moved to a price the 0.75 KAS vault could not pay, then to a price that paid 0.4 KAS. A different key was rejected on the same shape.
- The 2 Nov script is still the script covenant A committed. A new vault on 3 Nov 2026 uses the edited `peg.sil`. On that vault the same refresh shape, signed by the lab key, was rejected, and the redeem paid the mint-time sompi. The next mint can still store whatever that key signs, because debt 0 still lets `refreshSolo` and `mint` write the quote.
- That last sentence was unread on the new vault until the following pass. `refreshSolo` `5ad0df61aacbe5bcae6c98c6cab14f86154e57cd41e6e6d1d95849752eeac758` stored 200000000. Mint `88461152f2a0d6762d775f5a23d8b7fa35f5d38fb67b498e72b3200e14b0f835` created 10 cents. Redeem `02275ccc1661a117114ea6be37479a7dda620a9c043eb382340b1371b68bcc4b` paid 20000000 sompi. Half the cents, the same kas.
- An earlier sentence said a hashrate majority that votes a price can undercollateralize a note. Kaspa Dollar's published rule is finer, and their page already says the two cases. A window has a price when at least half of its blocks voted. Moving the median takes at least as many votes as the honest voters. When every block votes, that is half the hashrate. When exactly half the blocks vote, half of those votes is a quarter of the hashrate. Their heading calls that floor "25% network participation." The votes inside a valid window are at least half the blocks. The same page says, in one bullet, that the liquidation price decreases with no cap, and says in the chart, the four conditions, and the fall-limit section that it falls by at most 25 percent an hour. The argument that a false low price takes hours needs the cap. Both sentences are on the page. This reading keeps both.

## What is still open

The quote is a lab key. It has changed a payout with no debt, and it has changed the price of a note the holder already held: mint `1d701f05f5263f7ff27298584ec27f3c160f7c338850853378b02ffaadf79a63`, refresh `860628daa0cabf017a50561cee1db7d735de8524e8723a431bd6911d09d949e9` to 400000000, refresh `f1812d1db4a657155decf2c0fc10bfa61835a9d71cd0da0bbbcb21e334e189f2` to 200000000, redeem `74fc74f78d03f4a1274b6f6c776f6965ca4142a24e03821d8093bd337be49e52` paid 40000000 sompi. The holder signed the redeem. The holder did not sign the refreshes. A signature that was valid when it was signed was then mined after the window: mint `9eb4a0d71e0b4d3aba458d05475a169f80183a8ab24e2af8443e05b04694c89f`, block `1076583701234c34600ca5afef17e60576a52125b5c1fe64acb5457ae4300fa3`, 2515 milliseconds after expiry. The script accepted it because `priceMessage` reads `OpTxLockTime`, which the signer chose. This devnet's script has no opcode for the including block's timestamp. The past median time was 74706069 milliseconds behind that block, and every input sequence was the maximum, so consensus did not wait for the median. Finality depth was not waited out. Two covenant ids redeemed on their own vaults. A spend that paired one vault with the other note was rejected, and the node did not name the clause. `peg.sil` does not liquidate. The devnet `STP1` lock still cannot pay. Five percent of the subsidy was run. It is the same door as the half. At the tail of the integer, a subsidy of 29 sompi with a five percent slice locks 1 sompi and mints a face of 0. Kaspa's own subsidy already ends, after 426 month entries, and the v2.1.0 test expects 0 after 36 yearly steps. This study does not lengthen that table. A never-ending mined face would be a second monetary policy. `cli-debugger` is still not on this machine, so `peg.sil` has no debugger count. On 3 Nov 2026 a new vault rejected a refresh from 100000000 to 400000000 while 20 cents were outstanding. `fairSompi` at the refused price is 80000000, which fits in the 100000000 collateral, and the node still rejected the transaction. Redeem `7231117dc777cfbac794151cfa77d5a18c785acd305e24b685f68f7552e36322` then paid 20000000 sompi and left 80000000. Covenant A was not spent and was not upgraded. Its committed source is `contracts/peg-2026-11-02.sil`. `refreshSolo` and a mint while debt is 0 can still write a quote. The window, the median, the generic script error, liquidation, and the `STP1` lock are unchanged. Later the same morning `refreshSolo` `5ad0df61aacbe5bcae6c98c6cab14f86154e57cd41e6e6d1d95849752eeac758` stored 200000000 on that vault while debt was 0. Mint `88461152f2a0d6762d775f5a23d8b7fa35f5d38fb67b498e72b3200e14b0f835` created 10 cents. Redeem `02275ccc1661a117114ea6be37479a7dda620a9c043eb382340b1371b68bcc4b` paid 20000000 sompi and left 60000000. The block that included the redeem, `adf9d579a602c1576f31b315136f418fda4ccd6d3fd7bb91c98727df1e107c8b`, paid 2202012000 free sompi and locked 2200000000. The extra 2012000 is the mint fee. The next block, `bc9a4c5cb1b3088825fdeb021f4ea77059c9881a3cd95495984bf0b1680e16c3`, paid 2205222300 free sompi and locked 2200000000. The extra 5222300 is the redeem fee. Official Kaspa v2.1.0 pays the subsidy and the fees as one sompi output. The half lock is this devnet's patch. The holder's 20000000 sompi left the vault. On 3 Nov 2026 `https://api.kaspa.org/info/blockreward` returned 2.06017223. No freeze was added.

On 3 Nov 2026 the public pages at `https://kaspadollar.com/` were read, including how it works, the roadmap, and `https://kaspadollar.com/whitepaper`. The whitepaper page is the sentence "Publishing on 8 November 2026" and a countdown. The integer checks of their bands, their worked liquidation, their vote gate, and a fee beside an unsplit subsidy are in the model. Thirty-four tests passed. No third devnet was started. This desk is the only miner on the private nets, so a median written here would not measure a quarter or a half of anyone else's hashrate. Their covenants are not on the site. The roadmap places the protocol build after the fundraiser closes on 1 January 2027, and the later months do not name a year. `peg.sil` was left at its own mint ratio.

The path that stays inside the constraints is the voluntary lock, the full KAS reward, and no freeze. The coinbase split stays on the list because the bytes were run at two sizes, a mature free output was spent, a fee stayed in that free output, and the lock was rejected. Both stay open as studies. Neither is a claim.

## Read in this order

| File | What it is |
| --- | --- |
| [ISSUES.md](ISSUES.md) | Each hard question, and whether the code answers it |
| [STUDY.md](STUDY.md) | The 1 Nov 2026 study, including why home ASICs are not part of the test |
| [DOORS.md](DOORS.md) | Ordering versus the issuer's key. Every door kept. Decentralization is the measure |
| [contracts/vault.sil](contracts/vault.sil) | The 27 Oct vault. Unchanged rules: one lineage, owner mint, liquidation |
| [contracts/peg.sil](contracts/peg.sil) | Holder redeem at the stored quote. An outstanding note keeps that quote |
| [contracts/peg-2026-11-02.sil](contracts/peg-2026-11-02.sil) | The 2 Nov source covenant A committed. It still reprices a held note |
| [model/issues.mjs](model/issues.mjs) | The integer checks for the questions a script cannot see |
| [DESIGN.md](DESIGN.md) | Covenant rules, specs, and what the debugger showed |
| [LIMITS.md](LIMITS.md) | What is still not a stablecoin |
| [ECONOMICS.md](ECONOMICS.md) | How this differs from the square's receipts |
| [PROPOSALS.md](PROPOSALS.md) | Sentences for the square. This repo does not patch that tree |
| [RESULTS.md](RESULTS.md) | What was and was not submitted. Public TN10 paid ordinary tKAS. The private devnet paid KAS and a locked face, rejected that lock, then redeemed two `peg.sil` notes |

## Run

Issues model, no node and no key:

```
node --test model/issues.test.mjs model/doors.test.mjs
```

Compile the peg contract. The JSON artifact is gitignored, same as `vault.json`.

```
silverc contracts/peg.sil --constructor-args contracts/peg.args.json -o contracts/peg.json
```

The 27 Oct debugger runs, when `cli-debugger` is on the machine:

```
cli-debugger contracts/ratio.sil --run-all
cli-debugger contracts/vault.sil --run-all
```

`node script/tn10.mjs health` and `node script/tn10.mjs run` belong to the 27 Oct driver. They talk to Testnet-10. They do not submit `peg.sil`.

`node script/devnet-peg.mjs` is the 2 Nov desk driver. It talks only to `ws://127.0.0.1:17610` and mines only through `grpc://127.0.0.1:16610`. It refuses a public network argument. `--quote` reads the recorded second redeem. `--late` signs one mint, waits out that window, and submits the same bytes. `--live` reads the recorded reprice of covenant A and compiles `contracts/peg-2026-11-02.sil`. `--held` compiles `contracts/peg.sil`, opens a new vault, and rejects a refresh that would change the outstanding quote. `--next`, after that redeem, lets the key price the following note and reads the child coinbase. The keys and the oracle scalar stay out of git.

## The 27 Oct lab

TN10 learning lab. A covenant locks test Kaspa and lets its owner mint and burn a test token named tUSD-TEST. The token is worthless. This is not a stablecoin, not a product, and not money.

The covenant is SilverScript. The local compiler artifact reports `compiler_version` 0.1.0. Tests run in `cli-debugger`. The chain driver uses the Kaspa wasm module named by `KASPA_WASM` and the compiler named by `SILVERC`.

```
cli-debugger contracts/ratio.sil --run-all
cli-debugger contracts/vault.sil --run-all
node script/tn10.mjs health
node script/tn10.mjs run
```

`node script/tn10.mjs run` creates fresh testnet-10 keys under `.local/`, asks a public faucet for tKAS, and writes txids to `results/`. Those directories are gitignored. The driver prints addresses and txids. It does not print private keys.

Read `DESIGN.md` for the covenant rules, `ECONOMICS.md` and `PROPOSALS.md` for the square, `LIMITS.md` for what this cannot be, and `RESULTS.md` for what the node accepted.
