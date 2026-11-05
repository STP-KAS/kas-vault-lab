# Findings

This is a study. We are not claiming a stablecoin, a product, or money. This is not Kaspa Dollar.

This page is a short extract of the position, the fixed promise, and the public pages as they were read on 3 Nov 2026. The long notes were not rewritten. The transaction ids stay in `RESULTS.md`. The pages were not read again on 5 Nov 2026.

## What position.sil enforces on a step

`contracts/position.sil` has one quote. While `debt` is above 0, `step` and `stepNote` may replace it. `withinCap` requires `price * 4 >= quote * 3` and `price * 3 <= quote * 4`. That is three quarters through four thirds of the quote stored on that input. A doubling fails. A halving fails. The next step is capped against the quote the previous step stored, because `emit` writes the new quote.

The step's lock time is a DAA count. `daaLock` sets it to `OpTxInputDaaScore(0) + hourWait - 1` and refuses the maximum sequence. `hourWait` was 8 on the devnet. That is a desk wait. It is not an hour. The holder does not sign the step. The key signs the new quote together with the old quote and the covenant id. There is no entry that stores a quote from the key alone. Mint still requires the owner, and mint still uses the millisecond window.

The first covenant stepped from 300000000 to 400000000. Redeem `5cd061fb74e50b0fb32948bfe62527a28dfd30b7749e0d8c1e3405da188c3f34` paid 80000000 sompi. `fairSompi(20, 400000000)` is 80000000. The second covenant stepped from 400000000 to 533333333, which is `floor(400000000 * 4 / 3)`. Redeem `b50c6cc4e52d7d67df3e8fd02f0ea8ce9f02d69ba6757a1ddeaae75adb742553` paid 106666667 sompi. A doubling and a reused lock were rejected. The node text was that the script ran and verification failed.

`liqBps` is 20000 and `bonusBps` is 500. `policy` checks them. No entry spends them. The fee is another coin. The miner is paid the full KAS reward. This is not a coinbase rule.

The participation gate is not in the script. `positionWindow` in `model/position.mjs` is true only when half of the votes is at least half of hashrate. `positionWindow(10000)` is true. `positionWindow(9000)` and `positionWindow(5000)` are false. That check was not mined. This desk is the only miner on the private devnet.

## What promise.sil enforces on a fixed count

`contracts/promise.sil` stores one promise. There is no quote, no step, and no oracle. `add` increases the lock and calls `same`, so the promise is unchanged. `withdraw` pays the locker only what leaves at least the promise. `claim` pays output 1 the promise and output 0 the surplus, then leaves no covenant output. The script requires `locked > promise` and `surplus > 0`. Pay plus surplus equals the lock. The fee is another coin. The bearer signs the claim. The locker signs add and withdraw.

On the half-split devnet the lock was 200000000 sompi and the promise was 100000000. Adding 50000000 kept covenant `e751f84ff6995cd9bfa185031ce4644c7ec48c6e6e0217cff6a2ab87978d351e`. A withdraw of 150000001 was rejected. A withdraw of 50000000 was included. A claim that paid 50000000 was rejected. Claim `c91cca61e197b4d8f481f4f03e8c7a9162450530556c85b673a29769be513b7c` paid the bearer 100000000 and returned 100000000. The covenant was gone. Each fee was 5000000 sompi and the next free coinbase half carried it. The locked half stayed 2200000000.

`model/promise.mjs` still returns a surplus of 0 when the lock equals the promise. `chainClaimAllows` is false for that case. The equal lock was not broadcast. On 5 Nov 2026 the model command passed 52 tests. The new test is that split. The 51 passes recorded on the morning of 4 Nov are unchanged. The promise moves when KAS moves. It was not asked to stay near a dollar.

## What the public pages still claim

This is the 3 Nov 2026 reading of the Kaspa Dollar pages. It is not a new reading.

Their vault opens at 2.5 times or above. From 2.0 to 2.5 the owner does not mint and does not withdraw. Below 2.0 anyone may partially liquidate back toward 2.0. Below 1.0 part of the note is unbacked. The block reward stays whole. A fee sits beside it, and the amount is not published. The covenants are unpublished. The whitepaper page showed "Publishing on 8 November 2026" and had no paper body.

The price is a median of coinbase payloads. A window has a price when at least half of its blocks voted. At that thinnest window, half of the votes is a quarter of hashrate. Their pictures and their heading both support that floor. The position's model refuses a price until half of the votes is at least half of hashrate. One missing vote then leaves no price. Their page still prices the thinner window.

The mint price may fall at once, may rise by at most 10 percent an hour, and does not sit above the median. The liquidation price is also the redeem price. One bullet says that decrease is uncapped and the rise is at most 25 percent an hour. The chart, the four conditions, and the fall-limit section say the liquidation price falls by at most 25 percent an hour and jumps up. Both sentences were on the page. The five times do not name a clock. `peg.sil` was not changed to their 2.5 and 2.0 bands.

## Open holes

- The key can still move an outstanding quote by one capped step. The holder does not sign that step.
- On `peg.sil`, `refreshSolo` still stores a quote when the debt is 0. An outstanding note keeps the mint quote.
- Mint still compares the millisecond window the signer wrote. A window can be included after it should have closed. The script does not read the including block's timestamp.
- The step uses a DAA lock. The mint uses a timestamp. A lock time is one of those two domains. The threshold is 500000000000.
- The participation floor is a model check. It was not mined.
- The public pages still contain both the uncapped-decrease bullet and the 25 percent an hour sentences.
- `position.sil` stores liquidation fields and does not spend them. `peg.sil` does not liquidate. The 27 Oct `vault.sil` is a different instrument and was not part of these runs.
- The promise script requires a surplus above zero. The model still allows zero. That equal case was not broadcast.
- Finality depth was not waited. A failed script comes back as one sentence.

## The compiler, 5 Nov 2026

The broadcasts were compiled with the desk binary `C:\Users\Remco\tools\silverc\silverc.exe`. Its SHA-256 is `2104b9792d9e6333afddc2f4300f502d3010ead052094696e66af1dfa947ac8e`. That is the Windows asset from SilverScript `v1-rc1`, published 30 Aug 2026. The sources say `pragma silverscript ^0.1.0`. The artifact field is `compiler_version` `0.1.0`.

The Windows asset from the `v1.0.0` release, published 9 Sep 2026, has SHA-256 `ce1e0ef5f1f415f371d3d2426e788597a388635da8cbe93e72e95a4f754b29af`. It compiled `contracts/promise.sil`, `contracts/position.sil`, and `contracts/peg.sil` from the same sources and the same constructor arguments. Each bytecode matched the desk binary, including a position constructor with quote 400000000. The artifact field stayed `0.1.0`. The four commits from `v1-rc1` to `v1.0.0` add resource checks and a version label. They did not change the bytes these three files emit.

The comparison used placeholder constructor bytes for the promise and the position. Those hashes are not the redeems the node ran. The recorded lengths still match: the promise is 990 bytes and the position is 9108. The desk binary was not replaced. No covenant was opened.

## Left undone

No new covenant was written. `position.sil`, `promise.sil`, and `peg.sil` were not edited. The second-step cap and the participation gate were already tests in `model/position.test.mjs`, so they were not copied into a new contract. Liquidation was not added. A miner median was not added. A freeze was not added. The Kaspa Dollar pages were not fetched again. The long notes were not rewritten. No transaction was broadcast. The private devnet was not restarted.

## A bearer handed the same count, 5 Nov 2026

The section above is the extract. This section is the later measurement.

`contracts/promise.sil` was not edited. It still has no entry that changes the bearer. `contracts/promise-pass.sil` is a different file. It has `pass` and `claim`. It has no add and no withdraw. The desk compiler emitted 669 bytes. The same length came back for the next bearer and for a promise of 200000000.

On the half-split devnet the lock was 200000000 sompi and the promise was 100000000. Virtual DAA went from 1296 to 1300. The past median on this read was `1793578216327`. The script does not read it. Covenant `f772aab3e9064fc46bdc4972bcfae0d3ddc7dd8f7510a6f29e7a49de1d498138`. Open `ec3fc3134065c16fb7b4c36c39afa96dc57550db2eca386ef539278cb00e41c6` is in header DAA 1296. Its output script is the first bearer. A pass that paid a redeem compiled for a promise of 200000000 was rejected. That id, `1f6441e8d600989d0d87e95bdf7f60307ce3772a7abd5ba7c10816a20606bd0c`, is not in the chain. The locker signature was rejected. The included pass is `c82ff68ee8e66c4c459d26e5792fae7b4cbd2e612d600af6de1e4ce01003f272`, header DAA 1297. The output script is the next bearer. The covenant id is the same. Those two signatures share one transaction id because a version-1 id does not cover the signature script. The first bearer's claim was rejected. The included claim is `a4717649bd49b02f001bf0ff0e7a24bfff196d62d722a920eaf5b7b75e4843ac`, header DAA 1298. Output 0 paid the locker 100000000. Output 1 paid the next bearer 100000000. The covenant is gone. The next bearer is the address that mines this devnet. There is no fourth key. The pay is an ordinary output. Each fee was 5000000 sompi, and the next free coinbase half carried it. The locked half stayed 2200000000 and still carries `STP1`. The model command passed 52 tests. The model was not changed. Finality was not waited.

This names who may later claim a fixed count. The count stayed. It does not sell KAS, and it does not name a dollar. `promise.sil` still cannot change its bearer.
