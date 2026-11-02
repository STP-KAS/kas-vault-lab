# kas-vault-lab

Intentions are good; thought process is questionable.

Experimental only. This is a study. We are not claiming a stablecoin, a product, or money. This is not Kaspa Dollar, and it is not an endorsement of a mined dollar.

## What we are doing

We are testing a unit that can sit on Kaspa. The unit should be as hard to rewrite as the chain that orders it. Nobody should be able to freeze it. The miners who secure the chain should keep being paid in KAS. The tests stay on this desk: integer checks, a covenant that has not been broadcast, a short public testnet sample, and a private devnet whose coinbase pays KAS and locks the rest.

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

The private devnet has no peers, no DNS seeds, and no UPnP. It is not public TN10 and it is not mainnet. Home ASICs were not pointed at it. They hash for KAS. They do not lock, mint, or redeem.

## The ideas, still open

These are different promises. None of them has been chosen as a product.

- A receipt returns the same sompi. The holder keeps KAS volatility.
- A person locks KAS they already hold. Each lock is its own UTXO. The miner is paid the full KAS reward. Redeem needs a quote. That quote is unsolved. `peg.sil` is this shape, and it has not been broadcast.
- A coinbase can lock part of the subsidy and store a face. The first private devnet ran this at half, so both outputs were large enough to see. Half is a lab size. After maturity the free KAS spent like ordinary KAS, and the node rejected the lock. A second private devnet ran the same rule at five percent: free 41.8 KAS, lock 2.2 KAS, face 146666666. Five percent is still a haircut. It does not survive a deeper price drop than the half, because the crash line is the collateral ratio. The face is not a coin a wallet can send. This is not a public rule.
- A shared pot of many keys can refuse one signature. Every holder then waits. That is a freeze. It is not built.
- A company can mint against reserves and redeem the reserve asset, and can keep a freeze at its own door. That door is not the proof of work. It is not built here.
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

## What is still open

The quote. A stale mint window. Finality. Two covenant lineages that are not one currency. `peg.sil` does not liquidate, and it has no transaction id. It compiled again on 2 Nov 2026 with silverc 0.1.0. `cli-debugger` is still not on this machine, so that contract has no debugger count. The devnet lock still cannot pay. Five percent of the subsidy was run. It is the same door as the half. At the tail of the integer, a subsidy of 29 sompi with a five percent slice locks 1 sompi and mints a face of 0. Kaspa's own subsidy already ends, after 426 month entries, and the v2.1.0 test expects 0 after 36 yearly steps. This study does not lengthen that table. A never-ending mined face would be a second monetary policy.

The path that stays inside the constraints is the voluntary lock, the full KAS reward, and no freeze. The coinbase split stays on the list because the bytes were run at two sizes, a mature free output was spent, a fee stayed in that free output, and the lock was rejected. Both stay open as studies. Neither is a claim.

## Read in this order

| File | What it is |
| --- | --- |
| [ISSUES.md](ISSUES.md) | Each hard question, and whether the code answers it |
| [STUDY.md](STUDY.md) | The 1 Nov 2026 study, including why home ASICs are not part of the test |
| [DOORS.md](DOORS.md) | Ordering versus the issuer's key. Every door kept. Decentralization is the measure |
| [contracts/vault.sil](contracts/vault.sil) | The 27 Oct vault. Unchanged rules: one lineage, owner mint, liquidation |
| [contracts/peg.sil](contracts/peg.sil) | Holder redeem at the stored quote. Mint still needs a fresh signature |
| [model/issues.mjs](model/issues.mjs) | The integer checks for the questions a script cannot see |
| [DESIGN.md](DESIGN.md) | Covenant rules, specs, and what the debugger showed |
| [LIMITS.md](LIMITS.md) | What is still not a stablecoin |
| [ECONOMICS.md](ECONOMICS.md) | How this differs from the square's receipts |
| [PROPOSALS.md](PROPOSALS.md) | Sentences for the square. This repo does not patch that tree |
| [RESULTS.md](RESULTS.md) | What was and was not submitted. No peg txid. Public TN10 paid ordinary tKAS. The private devnet paid KAS and a locked face, then spent the mature KAS and rejected the lock |

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
