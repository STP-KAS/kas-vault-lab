# Results

The 27 Oct 2026 driver stopped while asking for test coins. That day has no vault txid. Later headings in this file record the 1 Nov public sample, the private devnets, the `peg.sil` redeems, and the DAA wait. tUSD-TEST was not created on chain. It is not a stablecoin, and the script is not a conforming KCC-20. `DESIGN.md` states the field order and the missing borrow schemes.

## What was asked

**Fact.** The driver uses a fresh testnet-10 key that stays out of git. The address it asked the faucets to pay is `kaspatest:qpc8psspahf6qsclygy8l8g9s79mv0fe84a4t5lufguv9gd9gqjxj25x79qhc`. No private key is in this file.

**Fact.** Each run sampled `https://api-tn10.kaspa.org/info/health` before any payment request, then connected to a public resolver. The REST `blueScore` and the RPC `virtualDaaScore` are different fields. Both are listed when both were read. Two `p2pId` values answered. This is not a one-backend pool.

| UTC | Europe/Berlin | REST p2pId | server version | synced | utxo index | REST server blue score | REST database blue score | RPC virtual DAA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26T20:38:53.093Z | 26/10/2026, 21:38:53 CET | `884e1eafb58a237aac39d098746a0106e5dd58e000646c2aee7a50971c99167f` | 2.1.0 | true | true | 595506637 | 595506609 | 607135416 |
| 2026-10-26T20:39:19.461Z | 26/10/2026, 21:39:19 CET | `41d9296cd9daaa38c33fcfd74167b7288865a8d15630766ee6d9e3a301396bc8` | 2.1.0 | true | true | 595506838 | 595506790 | 607135897 |
| 2026-10-26T20:42:09.134Z | 26/10/2026, 21:42:09 CET | `884e1eafb58a237aac39d098746a0106e5dd58e000646c2aee7a50971c99167f` | 2.1.0 | true | true | 595508403 | 595508383 | 607137199 |
| 2026-10-26T20:49:45.993Z | 26/10/2026, 21:49:45 CET | `884e1eafb58a237aac39d098746a0106e5dd58e000646c2aee7a50971c99167f` | 2.1.0 | true | true | 595512956 | 595512915 | 607141798 |
| 2026-10-26T21:22:49.626Z | 26/10/2026, 22:22:49 CET | `884e1eafb58a237aac39d098746a0106e5dd58e000646c2aee7a50971c99167f` | 2.1.0 | true | true | 595530496 | 595530416 | not read |

The 21:22:49Z row is a REST read after the driver had already exited. It has no RPC virtual DAA.

## Faucets

**Fact.** `GET https://faucet-tn10.kaspanet.io/` was recorded four times. Each response was HTTP 403 and the body contained Cloudflare's "Just a moment..." page. Times:

- 2026-10-26T20:38:54.026Z, 26/10/2026, 21:38:54 CET
- 2026-10-26T20:39:40.171Z, 26/10/2026, 21:39:40 CET
- 2026-10-26T20:42:09.949Z, 26/10/2026, 21:42:09 CET
- 2026-10-26T20:49:46.905Z, 26/10/2026, 21:49:46 CET

No coin arrived from that host.

**Fact.** Earlier the same evening, `POST https://kaspa-demo-faucet.parker2017.workers.dev/api/faucet` returned the error text "Another test wallet is being funded. Please try again in a moment." Those calls did not return a transaction id.

**Fact.** The last driver run then read `GET https://kaspa-demo-faucet.parker2017.workers.dev/api/status` ninety times and did not post a claim. Every status was HTTP 200, `pending` 1, `enabled` true, `claims` 81, `remainingClaims` 918. The first of those reads was 2026-10-26T20:49:47.432Z (26/10/2026, 21:49:47 CET). The last was 2026-10-26T21:20:26.336Z (26/10/2026, 22:20:26 CET). The process then exited 1. Its message was "faucet did not answer", which was the sentence the driver starts with when no claim body has replaced it. No demo transaction id was returned.

**Fact.** A status read after that exit, at 2026-10-26T21:22:49.626Z (26/10/2026, 22:22:49 CET), was still `network` testnet-10, `enabled` true, `connected` true, `claims` 81, `pending` 1, `remainingClaims` 918, `amount` "1000000000".

**Reasoning.** The demo worker will not start a second claim while `pending` is set, and this observation never saw `pending` leave 1. Waiting longer in this session would not have created a vault transaction. The chain steps were not run because both faucet paths failed to pay the test address.

## Local debugger

**Fact.** After that wait, the local `cli-debugger` was run on the contract sources in this repo.

`contracts/ratio.sil --run-all`: 23 tests, 23 passed, 0 failed.

`contracts/vault.sil --run-all`: 15 tests, 15 passed, 0 failed.

Three vault tests expect the script to accept: `deposit_adds_collateral`, `repay_clears_debt`, `move_changes_note_owner`. The other twelve expect a reject, and the runner counts a matching reject as a pass. That is the local VM. It does not show mempool policy, a real owner sighash, fee, or median time. `LIMITS.md` keeps the stale-price hole open. These passes do not close it, and they are not TN10 rejections.

## What is absent

There is no expected-versus-observed line for a broadcast, because nothing was submitted. A later run can resume from the same test key once a faucet pays it. Until a node returns a txid, this file must not grow one.

That paragraph is the 27 Oct state. The headings below it name transaction ids from the private devnet and from the 1 Nov TN10 sample.

## Checked again on 27 Oct 2026

**Fact.** At 2026-10-27T18:17:42.372Z (27/10/2026, 19:17:42 CET) the same two payment paths were still closed. `GET https://api-tn10.kaspa.org/info/health` was HTTP 200 from `p2pId` `41d9296cd9daaa38c33fcfd74167b7288865a8d15630766ee6d9e3a301396bc8`, server version 2.1.0, synced, UTXO index on, server blue score 596282364, database blue score 596282302. No RPC virtual DAA was read with that sample. `GET https://faucet-tn10.kaspanet.io/` was HTTP 403 and the body contained "Just a moment...". Demo status was HTTP 200, `network` testnet-10, `enabled` true, `connected` true, `claims` 81, `pending` 1, `remainingClaims` 918, `amount` "1000000000". No transaction was submitted.

## Peg contract, 1 Nov 2026

**Fact.** `contracts/peg.sil` compiled with silverc `compiler_version` `0.1.0`. `node --test model/issues.test.mjs` passed 9 tests. No resolver was contacted. No faucet was asked. No transaction was built for the peg contract. There is no peg txid.

## Desk sample, 1 Nov 2026

**Fact.** The test this study can run on today's nodes is a holder redeem of `peg.sil`, by more than one locker, with the coinbase left alone. That spend was not run. It needs keys. A stock Kaspa wallet would still show only sompi after it.

**Fact.** A public TN10 node was already running on this desk: kaspad 2.1.0, `--testnet --netsuffix=10`, RPC on localhost. From 2026-11-01T20:51:30Z two `kaspa-miner` processes, one thread each, user agent `0.2.6/door-sample`, mined against that node. One used the public Grok Build address `kaspatest:qp4jge54eztxewf8r53rtjdvxakmatsu6tjd0nn9sjhgvzxknsfvjvmwurqhd`. The other used the public Grok Bot address `kaspatest:qzffl5xy9np46gkttyuftqnv2w04pr8g3wsp7c3vv8se3txtelx6q7c0v0ldx`. The logs record 37 successful submits from Build and 45 from Bot. Each thread reported 2.13 to 2.14 MH/s. The last log line is 2026-11-01T20:51:58Z. A later process check found no `kaspa-miner`. The node was left running. Home ASICs were not used. No private key was loaded. No new wallet was created.

**Fact.** `https://api-tn10.kaspa.org` has both blocks. Build block `031d9b0b6918d2f29e2cf706699ab2318c4355dd804325139202000c6ac31890` (blue score 600681169) is an empty-input coinbase. `extra.minerAddress` is the Build address and `minerInfo` is `2.1.0/0.2.6/door-sample`. Every output is a pubkey script. Bot block `6015a8cc457346522b1504c52d28cc8bd91299fb185fec1aa101df06f378284e` (blue score 600681153) is the same shape, with the Bot address in the payload. One of its outputs pays the Build address 291352351 sompi, which is a later block settling an earlier block's script. No output is a covenant.

**Fact.** Compared with a read of the same API earlier that evening, before these miners started, the Build address was higher by 10813139657 sompi and the Bot address by 13123698665 sompi. Those increases sit near 37 and 45 times the 291352351 sompi subsidy printed on the plain coinbase outputs, with a remainder on the scale of fees. The third public address did not change. The wallet still has one asset.

**Fact.** After the sample, `/info/hashrate` was about `1.343e-5`. Read as terahash per second, that is about 13.4 MH/s. `/info/blockdag` named `kaspa-testnet-10` and a difficulty near 671481. Two threads at about 4.3 MH/s are on the order of thirty percent of that hashrate reading for the half minute they ran. They were stopped there. The rest of the CPU was not started.

**Reasoning.** A larger share of public TN10 would still be sompi, because this kaspad builds the coinbase the network already expects. A different coinbase needs different node software, and nodes that keep the old rule would reject it. That split was not started. There is still no peg txid.

## Private devnet, 1 Nov 2026

**Fact.** The TN10 kaspad was left running. A separate binary, rusty-kaspa `v2.1.0` commit `01b532e8` plus a local devnet-only coinbase patch, was started with its own data directory. RPC and peer ports were bound to localhost. DNS seeding was off. UPnP was off. No peer was added. The patch was not pushed. The TN10 binary was not replaced.

**Fact.** The devnet rule locks half the subsidy and pays the other half, plus fees, as KAS. The STP face is `subsidy * 5000 / 15000` with the price constant 1. On this devnet the paid reward was 4400000000 sompi, so each accepted reward was 2200000000 sompi of KAS and 2200000000 locked sompi, with face 1466666666. The lock is the `STP1` script in `STUDY.md`. It ends in `OP_FALSE`.

**Fact.** Three new addresses, one CPU thread each, submitted to that node. One address submitted a first block, then each address submitted 8. Every submit in those logs returned success. The miners exited. The node reported `blocks=25` and `virtual_daa=25`. The addresses were `kaspadev:qp6zjhkx4z4j9tnqjttsg9ylhwwnmn2snu4re6pynxyyzwlpmf7uwsgjlwp8l`, `kaspadev:qpnayvcujj42uh8ct0kz6npqrh9rekudmre22cw473l8aguqq7wxcaeg0ju52`, and `kaspadev:qqjpnvtfkdc0zp84ph9xhk64mt530kamdd9v4wszuxfuvrks6j3qu5hct3g6f`. No private key is in this repo.

**Fact.** The UTXO index, after those submits, showed immature KAS of 19800000000, 15400000000, and 17600000000 sompi. The accepted coinbases that created those outputs also carry STP faces of 13199999994, 10266666662, and 11733333328. That is 9, 7, and 8 rewards. 24 rewards are in the UTXO set. The remaining block has not been paid by a later block. Maturity is 1000 DAA, so none of this is spendable yet. Block `f04f163ddf87bdb0b63c760b85102f358af533b8b09d4dbde57f0ab44c3ecd93` (DAA 1) is one of those accepted coinbases: locked sompi 2200000000, face 1466666666.

**Reasoning.** These threads are the only hash on this devnet, so the blocks they found are the chain. A public node that does not run this patch will not accept the blocks. The face uses a constant, not a market and not a vote of the miners. The locked sompi cannot be spent by the script as written. STP here is a number stored beside the lock, not a coin a stock wallet can send. `peg.sil` was not broadcast in this run. The later redeem ids are in the 2 Nov section below.

## Schedule and holdings, 1 Nov 2026

**Fact.** This pass did not start a second devnet, did not restart the miners, and did not rebuild the node. The 25-block run already paid the same split. The questions in this pass are who receives a mined face, when that face stops, where diverted sompi can sit, and what a long proof-of-work record does and does not price. Those checks are in the model.

**Fact.** `node --test model/issues.test.mjs model/doors.test.mjs` is the run for this pass. It checks 6575 days from 31 Oct 2008 to 1 Nov 2026, and 6511 days from 3 Jan 2009 to that date. At the devnet constants, `redeemMined` returns 3666666666 sompi to a finder who redeems at once, against a 4400000000 sompi subsidy, and leaves 733333334 sompi as surplus. `faceShare` of 4 equal blocks in 6 is 4/6 of the new face. `supplyOf("coinbase", 0, ...)` is 0. `supplyOf("lock", 0, 2200000000, ...)` is 2200000000. `potMoves(19999, 20000)` is false. `potMoves(1, 1)` is true.

**Fact.** `peg.sil` was not broadcast. The public TN10 node was not stopped. The private devnet was not given a peer. No private key was loaded.

**Reasoning.** Another sample of the same coinbase would repeat the haircut. It would not say whether a shared pot can refuse a holder, or whether issuance on the coinbase path continues after the subsidy is 0. The model answers those two. `STUDY.md` records why the voluntary lock, the full KAS reward, and no freeze are the combination that stays inside the constraints, and why the coinbase split stays a measured private-devnet result. This is a study. It does not claim a stablecoin.

The sentence above stopped short. Maturity and a spend had not been run. The next section runs them.

## Six threads, then a spend, 1 Nov 2026

**Fact.** The same private devnet was still up. Public TN10 was still up. No peer was added. The node was not rebuilt. Six CPU processes, two on each of the three addresses already in `RESULTS.md`, each stopped itself after 200 `Success` reports. The logged rates were about 0.53 MH/s. The error logs were empty. Before this stage the node reported `blocks=25` and `virtual_daa=25`. After the six processes exited it reported `blocks=1196` and `virtual_daa=1196`. This note does not explain the gap between 1200 success reports and 1171 new blocks.

**Fact.** The address index then showed mature KAS of 1386, 1364, and 1452, and immature KAS of 7524, 7568, and 6974. The reader's STP faces were 938.66666624 mature and 5001.33333106 immature for the first address, 938.66666624 and 5030.66666438 for the second, and 982.66666622 and 4634.66666456 for the third. 1386 KAS is 63 rewards of 22 KAS. 938.66666624 is 64 faces. The reader dates an STP face from the coinbase header. The node dates the spendable output from the UTXO entry. Those two clocks are not the same block.

**Fact.** A spend of the oldest mature free output, 2200000000 sompi, with a fee of 10000 sompi, was rejected: transaction `e97c0d2018e4ce2b4c2101e164588d4adb4b3bd1033ceed37398e10e936cc78f` had 10000 fees, under the required 162400 for compute mass 1624. The same output with a fee of 200000 sompi was accepted as `0fb957c5f8a39be1809b4d4774f1e5dac9a727aadcb4526a09a4edf5da6a19f9`. The UTXO entry's DAA was 4. One further CPU block was mined so the mempool transaction could confirm. The node then reported `blocks=1197` and `virtual_daa=1197`.

**Fact.** After that block, the first address had mature KAS 1364 and immature KAS 7524. The second had mature KAS 1385.998 and immature KAS 7590. The third had mature KAS 1452 and immature KAS 6996. 1385.998 is 1364 plus 21.998. The 0.002 KAS is the 200000 sompi fee. The second and third addresses each gained 22 immature KAS from the confirming block's coinbase. The first address did not.

**Fact.** A spend of the STP output in the coinbase whose header DAA is 1, locked sompi 2200000000, face 1466666666, was rejected: transaction `2aa83f1084914bd99934f81cd504606d75ef0987da352ef6759d272ecd35b80c`, `failed to verify the signature script: stack contains 4 unexpected items`. The same transaction was submitted again after the free output had confirmed. The node returned the same rejection. The spend program is local to the unpushed fork. It was not published. No private key is in this repo.

**Fact.** The reader's mature STP face for the first address fell from 938.66666624 to 923.99999958, which is one face. The reader counts an STP output only while that coinbase still has an output in the address index. Spending the free output removed the coinbase from that index. The node's second rejection is the evidence the lock was still present. `peg.sil` was not broadcast.

**Reasoning.** The free half, once mature, is ordinary KAS. The locked half is not a coin. Crossing 1000 DAA did not create a price, a redeem, or a transferable face. It did answer the question the 25-block run had to leave open. Six threads on three addresses are still one operator. They are not many independent lockers.

## The block field, a fee, and five percent, 2 Nov 2026

**Fact.** The same half-split devnet was read again on localhost. Public TN10 was still up. No peer was added between them. The half-split binary was not rebuilt. Before any new block, `virtual_daa`, `header_count`, and the RPC block count were all 1197, with one tip. A walk of `get_blocks` returned 1198 unique hashes. The 1 Nov console log of the process that mined this chain records 1226 accepted submits and no orphan line: 25, then 1200, then 1. The RPC block count is `estimate_block_count`. The comment on that function says it is virtual DAA minus the retention-root DAA, and that the estimate does not include non-DAA blocks. The walk starts at genesis and follows the selected chain, then adds the sink anticone. 1198 is genesis plus 1197. The 29 submits outside those 1197 are the six-thread remainder, 1200 success reports minus the 1171 DAA steps from 25 to 1196.

**Fact.** One spend of an immature free output was rejected. The output DAA was 1176, the amount was 2200000000 sompi, and virtual DAA was 1197, so 979 blocks of the 1000-block maturity were still missing. Transaction `120f1f1d432819e9cad15d53e48ef2abee52cbfbfa946408ddb0a9070d776c37` was rejected: `transaction input #0 tried to spend coinbase outpoint (4bffffc5259b8b47d16733b2ad1caf46731ff768107161965abe1ef6815fdec3, 0) with daa score of 1176 while the merging block daa score is 1197 and the coinbase maturity period of 1000 hasn't passed yet`. It was not accepted into a block.

**Fact.** One CPU block was then mined. Virtual DAA, the header count, and the RPC block count became 1198. The walk became 1199. The sink was `71c7e888e3801db3ef9706ec076cf61596430ba86e939a82d862651b23d76e46`. The accepted locks were 1197 outputs. Every one was `locked_sompi=2200000000` and `face=1466666666`. There was no second pair. A reward that added two subsidies before the division would have been a different face. The third address's immature KAS rose from 6996 to 7018.002, and its immature face rose from 4649.33333122 to 4663.99999788. That is 22.002 KAS and one face of 14.66666666. The 0.002 KAS is the 200000 sompi fee from the mature spend in the previous block. The new block's coinbase pays the previous block. The fee landed entirely in the free output. The face did not grow.

**Fact.** `node --test model/issues.test.mjs model/doors.test.mjs` passed 28 tests. At a subsidy of 4400000000, alpha 500, price 1, and ratio 15000, `splitReward` returns free 4180000000, diverted 220000000, and face 146666666. `redeemMined` then returns 4326666666 sompi to a finder who redeems at once, against the full 4400000000, and leaves 73333334 as surplus. The same slice at ratio 20000 has face 110000000, surplus 110000000, and 4290000000 sompi after an immediate redeem. `survivesGap(3, 2, 15000)` is true and `survivesGap(3, 1, 15000)` is false. `survivesGap(2, 1, 20000)` is true. `forcedMinerValue` at price 2 is 8800000000 with no slice, 8653333334 at five percent, and 7333333334 at half. A fee of 200000 at the half constants raises the free output by 200000 and leaves the face at 1466666666. A subsidy of 29 at five percent has diverted 1 and face 0. A subsidy of 30 has face 1. A subsidy of 2 at half has face 0. A subsidy of 3 at half has face 1. `faceShare` of 4 blocks in 6 is 4/6 of the face at both slices. `supplyOf("lock", ...)` does not read the subsidy. `supplyOf("coinbase", ...)` at alpha 0 is 0.

**Fact.** A second devnet was started from the same source with the devnet constant set to 500 for that build only. The constant in the source was then put back to 5000. The half-split binary was not replaced. The new process listens on `127.0.0.1:16710` and `127.0.0.1:16711`, with its own data directory, no DNS seeds, and no UPnP. Its log shows `kaspad v2.1.0-4c8f9a2` and localhost gRPC connections. It does not show a peer. Three new addresses were used: `kaspadev:qpnzez92ymm8mecckdwkrt6h9u5ue8dpmn37axrlf45st53vlpj6cyp0q5ptr`, `kaspadev:qzjxfc4vjfd3l0shg7yxu2a3v2je6xdwud4ak9jwgxaxxf2hg2ykqy5et2prs`, and `kaspadev:qzsp07d4tg0vkjhqgergpuzt8epk2czsdp4lxtx457kyxk2klhltscm5tykht`. One thread mined 6 blocks, then three threads mined 8 each. All 30 submits were `Success`. The miners stopped. Virtual DAA was 30, the walk was 31, and the log counted 30 accepted submits. The accepted locks were 29 outputs. Every one was `locked_sompi=220000000` and `face=146666666`. Immature KAS was 585.2, 292.6, and 334.4, which is 14, 7, and 8 rewards of 41.8 KAS. The faces were 20.53333324, 10.26666662, and 11.73333328, which is 14, 7, and 8 faces of 1.46666666. The sink was `56cab74abdef65b78a34375c6797922e6656a793b84258a10f90542f3913bd59`. No combined face appeared. This overlap did not pay two subsidies through one lock. All of it was immature. No private key is in this repo.

**Fact.** `contracts/peg.sil` was compiled again with silverc 0.1.0. The JSON artifact is gitignored. It was not broadcast. `cli-debugger` was not on the machine. Public TN10 was not given a peg transaction. Neither devnet was given a peer.

**Reasoning.** The 29 submits were not a hidden mint. The locks that exist are one per paid block. Five percent is a measured coinbase, and it is the same machine as the half: the miner is paid less KAS, the face follows the blocks a miner found, and the note still does not spend. A smaller slice does not make a large holder smaller in share, and it does not survive a crash that the ratio cannot survive. The fee test is the part of this pass that came out clean for the miner: the 200000 sompi were not diverted. The voluntary lock is still the shape that leaves that subsidy whole. This is a study. It does not claim a stablecoin.

## A redeemable note, 2 Nov 2026

**Fact.** `peg.sil` was submitted to the half-split devnet only. The driver was `script/devnet-peg.mjs`. It connected to `ws://127.0.0.1:17610` with borsh and mined with `stp-mine` through `grpc://127.0.0.1:16610`, one block at a time, to the third address. Public TN10 was left up. The five percent devnet was left up. No resolver, no faucet, and no peer was used. The node reported server 2.1.0 and network `devnet`. Virtual DAA was 1198 before the first peg transaction and 1209 after the last. The sink was `c5e7db72f4fed2eefcc45c276e48c5dc88a902064c6f23e86971822973824f41`. The model tests were still 28 pass. No private key is in this repo.

**Fact.** The collateral was 300000000 sompi, 3 KAS. The carrier was 20000000 sompi. The ratio was 20000, the liquidation line 15000, and the bonus 500. The first stored price was 100000000 sompi per 1.00 of the note. `fairSompi(100, 100000000)` is 100000000 sompi, which is 1 KAS. The surplus after that redeem is 200000000 sompi. The oracle public key was `7411bd79d98cdc094b930750b983e3d857b5c53a4dadfa779c4a93fe7f2d9f83`. It was generated for this run. The scalar stays in `.local/` and is gitignored. The compiled redeem script was 9353 bytes. `cli-debugger` was still absent.

**Fact.** Address one, `kaspadev:qp6zjhkx4z4j9tnqjttsg9ylhwwnmn2snu4re6pynxyyzwlpmf7uwsgjlwp8l`, locked vault A and minted the note to address two, `kaspadev:qpnayvcujj42uh8ct0kz6npqrh9rekudmre22cw473l8aguqq7wxcaeg0ju52`. Address two locked vault B and minted the note to address one. The two covenant ids were `e40a6989ec65243ee67361d334c7131776f1cea34f3913edf3d76bb74d62f44a` and `37419615c748e6d670d1790586f7b80c7000ed110b7b7cb01f7270c89c192cf3`.

**Fact.** Accepted transactions, in order:

| Step | Transaction | Fee sompi | What the chain held afterward |
| --- | --- | --- | --- |
| Open A | `89d2ef04dd78be123289c44de74d6b9ef619d8c1291a2ae32c882c5c3117d676` | 2000000 | 300000000 sompi on covenant A |
| Seal A | `1cb0fdb87de831610be4a43f7a8ccb0091233acbd965e56fc8c32d7bd375bb00` | 2000000 | The same 300000000, sealed |
| Mint A, 100 cents to address two | `dc62a9baf7652d4b202a7e2f3c3d5da97de3bbebfd20e93dc04e6843b0efc887` | 4000000 | Vault still 300000000. Note carrier 20000000 |
| Open B | `85309cee4c3ec66a92542d7cec189f40a7a46ffff918b90470c4763cf517d6be` | 2000000 | 300000000 sompi on covenant B |
| Seal B | `c033c81235992143c6d9f9203be193cf5dbc38a7677830584417c87be735c6ce` | 2000000 | The same 300000000, sealed |
| Mint B, 100 cents to address one | `75c460150dd4d7e44e6db3c30956a306ca01e8da5420a3f4958bd1382d6bebba` | 4000000 | Vault still 300000000. Note carrier 20000000 |
| Redeem A, holder is address two | `111ad44f538660a589ad04d8baa3e13ab99667e8d6f997eb8e5a20b54a7dbd6b` | 6913900 | Surplus 200000000. Pay 100000000. Carrier 20000000 returned |
| Redeem B, holder is address one | `cc103e870b948460fc85206f5820ee1ceea6fd5dfbc282a5554c1da7c9881413` | 6913900 | Surplus 200000000. Pay 100000000. Carrier 20000000 returned |

**Fact.** The fee on each of those transactions came from a separate mature output. On redeem A the fee coin was 1871800000 sompi and the change was 1864886100, which is the 6913900 fee. The covenant inputs were 300000000 plus the 20000000 carrier. The covenant outputs were 200000000 surplus, 100000000 pay, and 20000000 carrier. Those three sum to the two covenant inputs. The same balance holds for redeem B. The miner of the including block was address three, `kaspadev:qqjpnvtfkdc0zp84ph9xhk64mt530kamdd9v4wszuxfuvrks6j3qu5hct3g6f`. The miner was not paid from the lock.

**Fact.** Four transactions were rejected. The node text on each script failure was `failed to verify the signature script: script ran, but verification failed`. It did not name the `require`. The matching transaction that kept the rule was later accepted.

- `b60b011092cba28dbd24391cb5260f02a246c5e7c23f44658be82e640c1c758d` was the first stale mint, with input sequence 0. The node said `transaction input #0 is not finalized`. This devnet's median time was behind the wall clock, so a lock time of about three minutes ago was still in the future for the node.
- `a44e82ce8556ef7c34d156acc59889ba5f6c268e86b7a250380f0120753069e0` was the same expired window after every input sequence was set to the maximum. The script failed. The fresh window then minted.
- `fff9190767c9722f62983b0b3e6fbc03e450e40978ffa0bcec2f1b4ba1bad1e8` asked to mint 200 cents against 3 KAS. The 2.0 ratio needs 4 KAS for that face. The script failed. The 100-cent mint was accepted.
- `6fbdb4044f09dc4fc80fc72d93b2ab96a8beeb1ff8966c84b297a0c95bf3a510` paid 50000000 sompi instead of 100000000 and left 250000000. The script failed. The fair redeem was accepted.
- `17bcaab55fd0d6887aba4f35b0190534ecb49bffc28467cf967949609634b69a` spent vault A together with the note from vault B. The script failed. Each note then redeemed against its own vault.

**Fact.** After redeem A, covenant A still held 200000000 sompi and the stored price was still 100000000. `refreshSolo` was then accepted as `117bc473d37a122e67d5f0657c19cc8fb3833084ea970023a0c52d457c015da8`, fee 4264400 sompi, from the oracle signature alone. The vault value stayed 200000000. The stored price became 200000000. Mint `5b0f95790a89a9d760c2ac9d0f9b8e4739b0e2d93936967fe690e9b459a07db3` created a 50-cent note against that 2 KAS, fee 4000000. Redeem `49bc0d8a09eb556e5f2eb28dfa5572ae832321e8ecdc49705cb670f5516e86a3` paid 100000000 sompi to address two, left 100000000 sompi in the vault, and returned the 20000000 carrier. The fee was 7740800 sompi from a separate 20000000 output, whose change was 12259200. Fifty cents at the new price paid the same 1 KAS that one hundred cents had paid at the old price.

**Fact.** The `STP1` coinbase outputs were not spent in this pass. Their script still ends in the opcode that rejects. This redeem does not make those outputs payable.

**Reasoning.** A note that can be redeemed now exists on this private devnet, as two covenant lineages and then a third mint on the first lineage after the quote moved. The holder received the sompi the stored price named, the surplus stayed, and the fee was extra sompi. The same run shows why that is not a stablecoin. The price was a key generated on this desk. That key rewrote the price, without the vault owner's signature, and the payout followed. Nobody froze a transfer. Nobody proved a market. The coinbase lock is still the other door, and it still does not pay.

## A window mined after it closed, 2 Nov 2026

**Fact.** The same half-split devnet, still localhost only. Virtual DAA was 1209 before this pass and 1211 after it. The driver was `script/devnet-peg.mjs --late`. It compiled the mint, signed it, waited, and submitted those same bytes. It did not sign again after the wait. Public TN10 was left up. The five percent devnet was left up. No resolver, no faucet, and no peer was used. The node still reported server 2.1.0 and network `devnet`.

**Fact.** Covenant A held 100000000 sompi, debt 0, stored quote 200000000. The mint was 25 cents at price 100000000, to address two. `atRatio(25, 100000000, 20000)` is 50000000, which fits in the 100000000. `fairSompi(25, 100000000)` is 25000000. The signed window was 45000 milliseconds: notBefore `1793652874881`, lock time `1793652889881`, expiry `1793652919881`. The lock time is inside that window. The signature was made at `1793652879891`, which is 39990 milliseconds before the expiry. The journal clock on that signature is `2026-11-02T20:54:39.892Z`.

**Fact.** Those bytes were submitted at `1793652922365`, which is 2484 milliseconds after the expiry. The node accepted `9eb4a0d71e0b4d3aba458d05475a169f80183a8ab24e2af8443e05b04694c89f`. The including block is `1076583701234c34600ca5afef17e60576a52125b5c1fe64acb5457ae4300fa3`, virtual DAA 1210, header timestamp `1793652922396`. That timestamp is 2515 milliseconds after the expiry. The past median time at submit was `1793578216327`. The gap from that median to the block timestamp is 74706069 milliseconds, which is 20 hours, 45 minutes, and 6 seconds. Every input sequence was the maximum, so consensus treated the transaction as final without that median. The fee was 8000000 sompi, taken from the 76000000 sompi change of mint `5b0f95790a89a9d760c2ac9d0f9b8e4739b0e2d93936967fe690e9b459a07db3`, and the new change was 48000000. The vault output stayed 100000000. The note carrier was 20000000. The covenant id stayed `e40a6989ec65243ee67361d334c7131776f1cea34f3913edf3d76bb74d62f44a`. Compute budget was 29.

**Fact.** The holder redeemed. `5f8f095ab29439893e8013e172fd90284ece42c2353f32ad8ca963707d8a0545` paid 25000000 sompi to address two and left 75000000 in the vault. The 20000000 carrier came back to address two. The fee was 9557300 sompi from a separate 12259200 output, and the change was 2701900. The covenant inputs were 100000000 plus 20000000. The covenant outputs were 75000000, 25000000, and 20000000. Those sums match. The including block is `001908448c0ddf488534062405aaa902775b2db71226f019dbb4448b4ff09a49`, virtual DAA 1211, header timestamp `1793652923491`. The past median time was still `1793578216327`. The redeem's lock time was 0. Redeem does not ask for a new oracle signature. The miner of both blocks was address three.

**Fact.** The time opcodes in this devnet's script are `OpCheckLockTimeVerify`, `OpCheckSequenceVerify`, `OpTxLockTime`, and `OpTxInputDaaScore`. `OpTxInputDaaScore` is the DAA of the block that created the spent input. None of them returns the timestamp of the block that is including the spend. `priceMessage` compares `OpTxLockTime` with the signed notBefore and expiry.

**Reasoning.** The earlier stale mint failed because its own lock time was already outside the window. This mint's lock time was inside the window, and the block that carried it was outside. The node followed the script. The script cannot see the block clock. The median on this devnet was about twenty hours behind, and the maximum sequence did not consult it, so this pass also did not wait out Kaspa finality. The price was the lab key again. Debt was 0, so the mint stored 100000000 over the 200000000 that had been sitting in the vault. Twenty-five cents then paid 0.25 KAS. The window did not stop that write. The `STP1` coinbase outputs were not spent. This is a study. We are not claiming a stablecoin.

## A note repriced while it was held, 2 Nov 2026

**Fact.** The same half-split devnet, still localhost only. Virtual DAA was 1211 before this pass and 1215 after it. The sink is `34950303f464c1b3e80889606277b36ec3ad2bb152f19df48196613badfa8194`. The past median time was still `1793578216327`. The driver was `script/devnet-peg.mjs --live`. Public TN10 was left up. The five percent devnet was left up. No peer was added. Covenant A was still `e40a6989ec65243ee67361d334c7131776f1cea34f3913edf3d76bb74d62f44a`, holding 75000000 sompi, debt 0, stored quote 100000000.

**Fact.** Mint `1d701f05f5263f7ff27298584ec27f3c160f7c338850853378b02ffaadf79a63` created 20 cents for address two at price 100000000. The vault output stayed 75000000. The note carrier was 20000000. `atRatio(20, 100000000, 20000)` is 40000000, which fits. `fairSompi(20, 100000000)` is 20000000. The fee was 4000000 sompi from a 48000000 output, change 24000000. Compute budget was 29. The journal clock is `2026-11-02T21:13:24.812Z`.

**Fact.** The same refresh shape was then tried with a different key, public `b1ecd7b5f26cedba585bf7b57fb9acd63abec9360dac7e3378dd686d8235364e`. Transaction `547f883ea8dba02b37db0503011313507ea9277072cfa349b725246b9b3ae999` was rejected. The node said the script ran and verification failed. It did not name the rule. The lab key's copy of that shape was accepted.

**Fact.** Refresh `860628daa0cabf017a50561cee1db7d735de8524e8723a431bd6911d09d949e9` stored price 400000000. The inputs were the vault and the note. The entries were `refreshVault` and `refreshNote`. Neither entry takes the holder's signature or the vault owner's signature. Address two's key was not used. The vault value stayed 75000000. The note carrier stayed 20000000. The fee was 8871700 sompi from the 24000000 change of the mint, and the new change was 15128300. Compute budget was 20. `fairSompi(20, 400000000)` is 80000000. That is more than the 75000000 in the vault. The script's refresh does not check the ratio.

**Fact.** Redeem `1a57f75ba49dc5bd2f50c9aa773a93273d34b86227b79cf22b293a960a083964` offered 40000000 sompi and left 35000000. The script rejected it. The fair pay at the stored price was 80000000. The note stayed where it was.

**Fact.** Refresh `f1812d1db4a657155decf2c0fc10bfa61835a9d71cd0da0bbbcb21e334e189f2` stored price 200000000, again with no holder signature. The vault value stayed 75000000. The fee was 4000000 sompi from a separate 1865086100 output, change 1861086100. Compute budget was 20.

**Fact.** The holder then redeemed. `74fc74f78d03f4a1274b6f6c776f6965ca4142a24e03821d8093bd337be49e52` paid 40000000 sompi to address two and left 35000000. The carrier of 20000000 came back. The fee was 3871600 sompi from a separate 20000000 output, change 16128400. Compute budget was 16. The covenant inputs were 75000000 plus 20000000. The covenant outputs were 35000000, 40000000, and 20000000. Those sums match. The holder signed this redeem. The mint price would have paid 20000000. The stored price paid 40000000.

**Reasoning.** A note someone already holds is still priced by the lab key. The holder cannot refuse the refresh, because the script does not ask them. A second key cannot do it. The same key can write a price the collateral cannot pay, and the script will not accept a smaller redeem to save the position. The same key can write a payable price afterward, and the payout follows that later number. Twenty cents minted at 0.2 KAS were redeemed for 0.4 KAS. The miner was paid from other coins. The `STP1` outputs were not spent. This is a study. We are not claiming a stablecoin.

## An outstanding quote stayed, 3 Nov 2026

**Fact.** The same half-split devnet, still localhost only. Virtual DAA was 1215 before this pass and 1219 after it. The sink is `49d647a19076301baeeb2b37b1f209bcbb06bda06f47292fd6d1bd316a8f19ea`. The past median time was still `1793578216327`. The driver was `script/devnet-peg.mjs --held`. It compiled `contracts/peg.sil`. `--live` still compiles `contracts/peg-2026-11-02.sil`, which is the source covenant A committed. Public TN10 was left up. The five percent devnet was left up. No peer was added. Covenant A `e40a6989ec65243ee67361d334c7131776f1cea34f3913edf3d76bb74d62f44a` was not spent. The journal clock on the connect is `2026-11-03T06:49:48.106Z`.

**Fact.** The new covenant is `2a8ae16d3615e736fed52cae5a073750fc396ba700662d82ff0b1f19d4a6a8b1`. It is not covenant A and it is not covenant B `37419615c748e6d670d1790586f7b80c7000ed110b7b7cb01f7270c89c192cf3`. Open `5d1d665e971e8c6892d5ed670a0d6f06f2eb95f96377f736931646be7abddd8d` locked 100000000 sompi. The fee was 4004100 sompi from a 1861086100 output, and the change was 1757082000. Compute budget was 16. Seal `15025e7b95fe7f20442ca7d89e19f102b57351930f433957776939e1b0b7cbaa` kept that 100000000. The fee was 3573400 sompi, the change was 1753508600, and the budget was 16. For the open constructor, the new redeem script is 9369 bytes. The same constructor arguments compiled from the 2 Nov source are 9353 bytes.

**Fact.** Mint `e264d27a3e502ef566b17477dfc4f929b8a60760b0c1cb414ed566a8704283a2` created 20 cents for address two at price 100000000. The vault output stayed 100000000. The note carrier was 20000000. `atRatio(20, 100000000, 20000)` is 40000000, which fits. `fairSompi(20, 100000000)` is 20000000. The fee was 2012200 sompi and the change was 1731496400. Compute budget was 30. The covenant id did not change.

**Fact.** Refresh `ae6a8f528dff61e81e92bf1484243546b029b707152e672f9e6a6b133082eb4b` asked `refreshVault` and `refreshNote` to store 400000000. The lab key signed that price. Address two did not sign. `fairSompi(20, 400000000)` is 80000000. That fits in the 100000000, and the leftover would have been 20000000, which meets the dust minimum. The node rejected the transaction. It said the script ran and verification failed. It did not name the rule. The note stayed at price 100000000. The covenant id did not change.

**Fact.** The holder then redeemed. `7231117dc777cfbac794151cfa77d5a18c785acd305e24b685f68f7552e36322` paid 20000000 sompi to address two and left 80000000. The carrier of 20000000 came back. The fee was 3878000 sompi from a separate 40000000 output, and the change was 36122000. Compute budget was 16. The covenant inputs were 100000000 plus 20000000. The covenant outputs were 80000000, 20000000, and 20000000. Those sums match. The stored quote was still 100000000. Debt is 0. The covenant id did not change.

**Reasoning.** On this vault, holding the note held the quote. The key that moved covenant A could not move this one while the note was outstanding. The price it asked for was payable, so the rejection is the vault running out of sompi. Covenant A was not upgraded. The output commits the old script hash, and a source edit does not reach it. A later mint, or `refreshSolo` while debt is 0, can still store a new quote. The window, the median, and the generic error are the same as the night before. The `STP1` outputs were not spent. This is a study. We are not claiming a stablecoin.

## The next note paid the same sompi, 3 Nov 2026

**Fact.** The same half-split devnet, still localhost only. Virtual DAA was 1219 before this pass and 1223 after it. The sink at the start was still `49d647a19076301baeeb2b37b1f209bcbb06bda06f47292fd6d1bd316a8f19ea`. The sink at the end is `bc9a4c5cb1b3088825fdeb021f4ea77059c9881a3cd95495984bf0b1680e16c3`. The past median time was still `1793578216327`. The driver was `script/devnet-peg.mjs --next`. It compiled `contracts/peg.sil`. Public TN10 was left up. The five percent devnet was left up. No peer was added. Covenant A was not spent. The new covenant was still `2a8ae16d3615e736fed52cae5a073750fc396ba700662d82ff0b1f19d4a6a8b1`, holding 80000000 sompi, debt 0, stored quote 100000000. The journal clock on the refresh is `2026-11-03T08:28:45.745Z`.

**Fact.** `refreshSolo` `5ad0df61aacbe5bcae6c98c6cab14f86154e57cd41e6e6d1d95849752eeac758` stored price 200000000. The entry takes an oracle signature and no owner signature. The vault output stayed 80000000. The fee was 4562000 sompi from a 1731496400 output, and the change was 1726934400. Compute budget was 16. The covenant id did not change.

**Fact.** Mint `88461152f2a0d6762d775f5a23d8b7fa35f5d38fb67b498e72b3200e14b0f835` created 10 cents for address two at price 200000000. The vault output stayed 80000000. The note carrier was 20000000. `atRatio(10, 200000000, 20000)` is 40000000, which fits in the 80000000. `fairSompi(10, 200000000)` is 20000000. `fairSompi(20, 100000000)` is the same 20000000. The fee was 2012000 sompi and the change was 1704922400. Compute budget was 30. The fee coin also paid the carrier. 1726934400 minus 2012000 minus 20000000 is 1704922400. The covenant id did not change.

**Fact.** The holder then redeemed. `02275ccc1661a117114ea6be37479a7dda620a9c043eb382340b1371b68bcc4b` paid 20000000 sompi to address two and left 60000000. The carrier of 20000000 came back. The fee was 5222300 sompi from a separate 100000000 output, and the change was 94777700. Compute budget was 16. The covenant inputs were 80000000 plus 20000000. The covenant outputs were 60000000, 20000000, and 20000000. Those sums match. The stored quote was 200000000. Debt is 0. The covenant id did not change. The journal clock on the redeem is `2026-11-03T08:28:49.095Z`.

**Fact.** The block that included the redeem is `adf9d579a602c1576f31b315136f418fda4ccd6d3fd7bb91c98727df1e107c8b`. Its header DAA is 1221. It contains two transactions. Its coinbase paid 2202012000 free sompi and locked 2200000000. 2202012000 minus 2200000000 is 2012000, which is the mint fee, the fee of the block before this one. The next block is `bc9a4c5cb1b3088825fdeb021f4ea77059c9881a3cd95495984bf0b1680e16c3`. Its header DAA is 1222. It contains the coinbase only. It paid 2205222300 free sompi and locked 2200000000. 2205222300 minus 2200000000 is 5222300, which is the redeem fee. Each confirming block was one `stp-mine` success to address three, and the miner exited. The RPC virtual DAA after that child is 1223.

**Reasoning.** Ten cents at the new quote paid the same sompi as twenty cents at the old quote. The key wrote that quote after the first note was gone, and the holder of the first note had already been paid. The miner of the child block received the free half of the month-0 subsidy plus the redeem fee, and the locked half stayed 2200000000. The holder's 20000000 sompi left the vault. The `STP1` output of that coinbase was not the payment. This is a study. We are not claiming a stablecoin.

## A reading of Kaspa Dollar, 3 Nov 2026

**Fact.** No transaction was submitted for this pass. No devnet was started. The half-split node, the five percent node, and the public TN10 node were left as they were. The pages read were the homepage, how it works, the roadmap and funding page, and `https://kaspadollar.com/whitepaper`. The whitepaper page said "Publishing on 8 November 2026" and showed a countdown. The body was not there. No protocol repository was linked from those pages.

**Fact.** `node --test model/issues.test.mjs model/doors.test.mjs` passed 34 tests. The six added in this pass check the 60 percent fall from a 250 percent open and the 50 percent fall from a 200 percent open, the published liquidation dollars against an unnamed 5 percent penalty, the median and the 50 percent participation gate, a compound 25 percent hourly fall, an equal-dollar redeem on either side of 100 percent, and a fee of 5222300 sompi beside an unsplit subsidy of 4400000000. They do not execute a covenant. They do not move KAS.

**Reasoning.** The arithmetic on the page can be checked. The protocol cannot, because the covenants are not published. A chain with one miner cannot stand in for a hashrate bound. The earlier peg transactions were not submitted again. This is a study. We are not claiming a stablecoin.

## Five clocks, 3 Nov 2026

**Fact.** The same half-split devnet, still localhost only. Virtual DAA was 1223 at the first read of this pass. The sink then was `bc9a4c5cb1b3088825fdeb021f4ea77059c9881a3cd95495984bf0b1680e16c3`. The past median time on the reads in this pass stayed `1793578216327`. The last of those reads was at virtual DAA 1251, sink `80592fd3afbafdc962e4391fc449a9e12707617086eb48718284c38c500833bc`. After the second probe spend the virtual DAA was 1252. The driver was `script/devnet-clock.mjs`. It compiled with `silverc` 0.1.0. Public TN10 was left up. The five percent devnet was left up. No peer was added. `peg.sil` was not spent. Covenant A was not spent. The wait in the constructor was 8.

**Fact.** `node --test model/issues.test.mjs model/doors.test.mjs` passed 41 tests. Seven of them are the hour checks: the DAA products, the signer window, the header bound, the DAA off-by-one, the ten-minute reapplication, the one-hour anchor, and the halt and settlement ages. They do not execute a covenant.

**Fact.** One entry, written inline. Fund `93c44e6f6bba1d6ec993f816d7a385f9e1d1672b42964dc2828b456ae3249317` created 50000000 sompi at DAA 1224, lock 1231, covenant `c9f69e00e7f364b03d630608101e546412ad0133e5d0f0b8244380cddc268912`, address `kaspadev:ppmmw03wtxznwlzcm68z5vla8s2tcv6jhyes8qyuvtnackm439cs520kg84sl`. Maximum sequence `3305d68c4f7be5e6bb9205ff063337378fe79464f1134e88eab2e1f2fc304433` failed in the script. Sequence 0 at virtual DAA 1224, `38b3a335bc554f5d94136f982a0b67a96cb98967b5659cbaf09046a6c55947c0`, failed as not finalized. The same body after the wait failed in the script. A later submit, at virtual DAA 1242, was `fec74889a0c803ef383422f62636a717573b1343461a412fdae3773b602943ec`. The median on that read was `1793578216327` and the sink was `75bb73c8405bcc4ae09e87e94319800f0e292bfa53d6aee1750d87a32025b135`. It failed in the script. The output is unspent.

**Fact.** The same entry, written as functions. Fund `42a54fc7bdbd64cc2ca250b9ecdaa22f9e1ce4c529b31e9797060a858ed64ce1` created 50000000 sompi at DAA 1243, lock 1250, covenant `e924d632312520fefdd624d91dc0919e7611fc5b7735b2b69c700ee5e1ae53d4`, address `kaspadev:pruq52axasns4spjflq642uw0pkw5h0k55srwqlznd7sekph2z7wgadpy3xf2`. Maximum sequence `3b778571228e2734b166f620bec4a56f796d912dba13f6042b817c706f8bbb00` failed in the script. Sequence 0 at virtual DAA 1243, `94a142b6933b8d053efb4e54f28721a790c2439397f5a33b9804aaca313728e9`, failed as not finalized. The same body after the wait failed in the script. A new body, fee raised by 3000000 sompi, `0a11032ec95df4a8497d4236982509b688bead1b6be9c394f793c93880fe24a8`, failed in the script at virtual DAA 1251. The birth read from that UTXO was 1243. The output is unspent. The node text on each script failure is that the script ran and verification failed.

**Fact.** `cli-debugger` recompiled the function form and ran `prove` with lock time 7, sequence 0, and a dummy signature whose last byte is `0x01`. Every require before the signature passed. The failure was `pubkey invalid: malformed public key` at the `checkSig` line. The debugger's fixture DAA is 0. That run does not name the line the node rejected.

**Fact.** Five entries. Fund `b7eee4364e47ffb9fdda52c7778856f8e8bd935e69e06813c54c2af7eab8680e` created 20000000 sompi at DAA 1233, lock 1240, covenant `54efc6257af84b1863bf93c82bf90f6fe08bf1b039cd73e3a0a8684f37706229`. Entry `full` includes the shape, the DAA wait, the successor, and the owner signature. `937a4b4f31cbc0b1d1cce8a4c247570079a8af3299b4ab4864a4421ee4700ece` was accepted and included at block DAA 1242. The later entries were not needed. The successor was spent once more, without submitting the first transaction again. Virtual DAA was 1251 at that submit, so the lock 1249 was already behind it. `27035400fa7a1061ef81f251d38014de5ffe72d1a58760f36d09e975e35e6f6a` was accepted and included at block DAA 1252. The fee was 2000000 sompi. The covenant id stayed `54efc6257af84b1863bf93c82bf90f6fe08bf1b039cd73e3a0a8684f37706229`. The value stayed 20000000 sompi.

**Reasoning.** A DAA wait can be required by a script, and the same output can be required to wait again from its new birth. The count in this run is 8. Their pages name minutes, an hour, and 30 days, and they do not publish the DAA products. The one-entry script is still a rejected spend of 50000000 sompi, twice. This is a study. We are not claiming a stablecoin.

## A position, 3 Nov 2026

**Fact.** The same half-split devnet. The read-back was at virtual DAA 1265, block count 1265, header count 1265, past median time `1793578216327`, sink `8c8e5f077b921ee8d096f424d3e3f014b04882b51d31125b1e03648e924d104b`. The driver was `script/devnet-position.mjs`. It compiled `contracts/position.sil` with `silverc` 0.1.0. The bytecode is 9108 bytes. `peg.sil` was not spent. The clocks were not spent. Public TN10 and the five percent devnet were left up. No peer was added. `node --test model/issues.test.mjs model/doors.test.mjs model/position.test.mjs` passed 46 tests.

**Fact.** The open `ec83f191ddbf95797fbf311a3a642dee69b07ecb55d6dc806a0026054e07252b` is in header DAA 1252, block `5aba6735be2c923178ca64fe0de1576195273d45a7c96e37c95ccf1b65e60c6c`. Outputs 200000000 and 1360906100. Compute mass 2083. The next coinbase paid 2202010500 free and 2200000000 locked. The fee is 10500 sompi. Covenant `317c3d061fe6f992ee683d9793b096c3ade06b1eeb3e831e587d1c251aa62e9f`. The UTXO score is 1253.

**Fact.** The seal `05ea3597a63d0cabd735b9247f64a4a39e4f558ed3fd378da719ca537d10d7b7` is in header DAA 1253, block `5103bf7abad4ec4aaac5162f14be49b54f9fb59fdb77830442333a2581bbc866`. It spends both open outputs. Outputs 200000000 and 1340906100. Compute mass 18319. The next coinbase paid 2220000000 free and 2200000000 locked. The fee is 20000000 sompi. The covenant id is unchanged. The UTXO score is 1254. `8d30419e49c9ea4af80173e8d906be31b5f8a52308190e5ebfe8ffb99b41129b` and `67622c09189f46e196a37f43e82904778a03ed090599dd7d362b76a00a16a2d4` are not in the selected chain and not in the mempool.

**Fact.** The mint `76d60636c77be94e0711ce9a7dca275e5c89a19c144fb75009d83298b6ccb02d` is in header DAA 1254, block `7e56b3fef476a4115766ad1416d35ebd99d7a3993dc5624e3e5d6767b4023c6b`. Lock time 1793739106732. Block time 1793739106769. Outputs 200000000, 20000000, and 1318906100. Compute mass 15895. The next coinbase paid 2202000000 free and 2200000000 locked. The fee is 2000000 sompi. Both covenant outputs keep the same id. The UTXO score is 1255. The quote is 300000000.

**Fact.** Header DAA 1256 through 1262 are coinbase only. The doubling `7d9a3d6d1c6b3235b580596049ab3c351b97b5f4fd3e85a0753efd4744b4e1a2`, the earlier body `b353c6ddfdf8959d65d7bfa485ee07366f8ed7ee16758852ac0eb87ad42b0abb`, the earlier four-thirds body `acb5ba20ac25db42175e799fa5f663640afc3a17742662031e73bb4a2802de0b`, the generic reject `e8a40216817ad49f3232bdf2fffcf0c49221bd64344f1cf84c6c6fb6e797aca0`, and the fee reject `fd74b8433ccd63d2ea3d5b5e7f2f687eaab34f4293b2ba4560f1dc5be9397e5e` are not in the chain and not in the mempool. The node required 3784000 sompi for the last of those, against a fee of 2000000 and transient mass 37840.

**Fact.** The step `e9649e1bab8f00be3ff51ce4a8f55983a7a5f4f349f9cf8937614f9adca09803` is in header DAA 1263, block `6b0751aa534c0d459518b101493bfc12ec317fb292d7585a56ca8529a610c933`. Lock time 1262. Block time 1793741822554. Outputs 200000000, 20000000, and 10735600. Compute mass 29020. The fee input is output 1 of `117bc473d37a122e67d5f0657c19cc8fb3833084ea970023a0c52d457c015da8`. The next coinbase paid 2205000000 free and 2200000000 locked. The fee is 5000000 sompi. The covenant id is unchanged. The UTXO score is 1264. The quote is 400000000.

**Fact.** The redeem `5cd061fb74e50b0fb32948bfe62527a28dfd30b7749e0d8c1e3405da188c3f34` is in header DAA 1264, the sink. Outputs 120000000, 80000000, 20000000, and 5735600. Compute mass 29313. The fee is 5000000 sompi and has no child coinbase yet. The vault output keeps the covenant id. The pay and the carrier do not. The journal clock on the step is `2026-11-03T21:37:02.786Z`. The journal clock on the redeem is `2026-11-03T21:37:04.974Z`.

**Reasoning.** One lock of 2 KAS, one quote, one step from 300000000 to 400000000, and a redeem of 0.8 KAS that left 1.2 KAS. The miner of the step's child received the free half of the subsidy plus 5000000 sompi. The locked half stayed 2200000000. The holder was paid from the vault. This is a study. We are not claiming a stablecoin.

## A second step, 3 Nov 2026

**Fact.** The same half-split devnet, a second phase file, covenant `9bb39a219850846fbacf8413c4ec97a1be4c6f9555da74a216a0b463709ec803`. The first phase file stayed redeemed. `position.sil` and `peg.sil` were not edited. The clocks were not spent. The read-back was at virtual DAA 1288, block count 1288, header count 1288, past median time `1793578216327`, sink `8ba66065ef67d40356efbaa388ec9d2dac9f9c0805f64b2d086196434f74739c`. `node --test model/issues.test.mjs model/doors.test.mjs model/position.test.mjs` passed 47 tests.

**Fact.** The open `cfdea3d248a88a162942c3d09dec26c67b5582e963f6662c79f35dd0d6c6e9cb` is in header DAA 1265, block `6ec4986056fbcabed6271680f2c3edb357be44a7c4c2f5419c059d75a1379fe3`. Outputs 200000000 and 1113906100. Compute mass 2083. UTXO score 1266. The coinbase of that block paid 2205000000 free and 2200000000 locked, which is the child payment of the first redeem's 5000000 sompi fee.

**Fact.** The seal `113df69895147d6fcce1a20115657b7d8a83f695093435417114f6f0771ef5b6` is in header DAA 1266, block `65fe3daef5a2ea20eab8aa6073864a56942401e7dc6439b34e2d5d530a47e187`. Outputs 200000000 and 1108906100. Compute mass 15319. UTXO score 1267. The next coinbase paid 2205000000 free and 2200000000 locked. The fee is 5000000 sompi.

**Fact.** The mint `aa33c02d415634f1a8d91acc3274d7d7d96fe4db4a66c0ff3f49ea5b67876068` is in header DAA 1267, block `70b71f7c87be70b063252e032b1b9eecae49282b69b8229e0acc93c379fb21a6`. Outputs 200000000, 20000000, and 1083906100. Compute mass 15895. UTXO score 1268. The quote is 300000000. The next coinbase paid 2205000000 free and 2200000000 locked. The fee is 5000000 sompi.

**Fact.** `52528b27aa5243d18bf3865a267fa20bd787b047c59ad47fe8ba68180a3d663b`, `aff84e6e797c9111a6aaaee8443e803bf04b8c63cf5ec4cbf60ca4d5d053eeaa`, `a46e81bf5ad2d94d942af56f0b91e40621534d051929bf8e33f23e1b0787ac3b`, `a04bfe9aa82f57523475b7f90310c0bda0556ffbede2cda5795910080e070165`, `1cc79b3537a5894ac70f47b584c8d8760de60bfa886c2e9e432fecf128af7d98`, `97df211a137811a77d8ea2d5efe0bb721dcc05fd12446544e70229ee25169a5e`, and `799f2ee3684e38733e2a76d6316d862a22a62bd14ca35a8f3cc4ad3efd1aa02d` are not in the selected chain. The first three of those rejections, and `a04bfe9a`, came back as the generic script sentence. `1cc79b35`, `97df211a`, and `799f2ee3` are second builds of wasm coins the first build had already touched. They are not the cap and they are not the lock.

**Fact.** The step `166e84bb0afb226453ad639dda868373e04c6319b36edd0586fa9d77b8fe1ae4` is in header DAA 1276, block `e3f6dc15735db44322ad466f63877c8affa643358ef21aee1e17612b46782ab8`. Lock time 1275. UTXO score 1277. Quote 400000000. Compute mass 29020. The next coinbase, header DAA 1277, paid 2205000000 free and 2200000000 locked. The fee is 5000000 sompi. The covenant id is unchanged.

**Fact.** The second step `c35867ab20f5190d9d2b274e11ce4bf39bd36faaaca59b91280a9041d00dec30` is in header DAA 1285, block `eee6647f8f5be9d7754c61a73085ba6c1018662ecc25b7941d3430ab929767c1`. Lock time 1284. UTXO score 1286. Quote 533333333. Compute mass 29020. Outputs 200000000 and 20000000 keep the covenant, and the change is 1078906100. The next coinbase paid 2205000000 free and 2200000000 locked. The fee is 5000000 sompi.

**Fact.** The redeem `b50c6cc4e52d7d67df3e8fd02f0ea8ce9f02d69ba6757a1ddeaae75adb742553` is in header DAA 1286, block `df381c626598df7514c9984ae8d90aeab3ed01d865ddb5630f1488e0c910da10`. UTXO score 1287. Outputs 93333333, 106666667, 20000000, and 1070513100. Compute mass 29313. The vault output keeps the covenant id. The child, header DAA 1287, block `8ba66065ef67d40356efbaa388ec9d2dac9f9c0805f64b2d086196434f74739c`, paid 2208393000 free and 2200000000 locked. The fee is 8393000 sompi. The journal clock is `2026-11-03T22:44:13.216Z`.

**Reasoning.** One lock of 2 KAS, a step from 300000000 to 400000000, a second step to 533333333, and a redeem of 106666667 sompi that left 93333333. The miner of the redeem's child received the free half of the subsidy plus 8393000 sompi. The locked half stayed 2200000000. The holder was paid from the vault. This is a study. We are not claiming a stablecoin.

## A fixed promise, paid, 4 Nov 2026

**Fact.** The same half-split devnet. The read at the start was virtual DAA 1291, sink `5633d5a6fe6cfb0b678b9647250f07cf8595644c2357c1f7401fdf60bfd4a17b`. The read after the claim's child was virtual DAA 1296, sink `e80a40a002032a273f83f0b9fa80416a3a33b0de100748a99697374e7a24b202`. The driver was `script/devnet-promise.mjs`. It compiled `contracts/promise.sil` with `silverc` 0.1.0. The bytecode is 990 bytes. A redeem compiled for a promise of 200000000 is also 990 bytes. `peg.sil` was not spent. `position.sil` was not spent. The clocks were not spent. Public TN10 and the five percent devnet were left up. No peer was added. The model tests were not run again. The morning count remains 51.

**Fact.** The open `6fb2458103bb64f260c2825d762f963b3efc5b2f3ac1e9be5f445c92b54fad87` is in header DAA 1291, block `45452736cf9c3a67cb8499989f221e5ec90479967e8d06947ff0504ddc37df35`. The UTXO score is 1292. The output is 200000000 sompi. The promise stored in the constructor is 100000000. The fee is 5000000 sompi. Covenant `e751f84ff6995cd9bfa185031ce4644c7ec48c6e6e0217cff6a2ab87978d351e`. That block's coinbase paid 2200000000 free and 2200000000 locked. Header DAA 1290 is coinbase only, so this coinbase is not paying a fee from the promise.

**Fact.** `11d669992ff40d6a6abe24c324d26b002d4ffc5214b43c5123bbb18883853a84` kept the covenant id and paid to a redeem compiled for a promise of 200000000. The node rejected it: the script ran, and verification failed. It is not in the parent walk from header DAA 1284 through 1295.

**Fact.** The add `c679d14a672e39b7e3ed07ae00eb0ce701531d885054c217750e157479f10be1` is in header DAA 1292, block `bc3a73789d1335179a3ef32eae2c1e7431a54b7384b9b484c08a43b85f757b93`. The UTXO score is 1293. The lock is 250000000. The covenant id is unchanged. The fee is 5000000 sompi. The coinbase of that block paid 2205000000 free and 2200000000 locked. The extra 5000000 is the open's fee. The locked output still carries `STP1`.

**Fact.** `8ed259f1cd4f8d9867be05d178d0b44a887106b4fa2da49f235fb43b2c03ffdb` asked to take 150000001. The remainder would have been 99999999. The node rejected it with the same generic sentence. It is not in that parent walk.

**Fact.** The withdraw `0bf61a92b1f5e3a2ac50988da3bf7a9629394922a03a974e5e7f969f86df4e77` is in header DAA 1293, block `f499a0189e603fb6a07cb5742b7950b2e1a463062396080e438547d66b78281a`. The UTXO score is 1294. The continued output is 200000000 and keeps the covenant id. Output 1 paid the locker 50000000. The fee is 5000000 sompi. The coinbase of that block paid 2205000000 free and 2200000000 locked. The extra 5000000 is the add's fee.

**Fact.** `5c7cdc0e7f0beda2067065ec6e6e86581fce3a4ecc0892e86aa263d0f09fc205` offered the bearer 50000000 and the locker 150000000. The node rejected it with the same generic sentence. It is not in that parent walk.

**Fact.** The claim `c91cca61e197b4d8f481f4f03e8c7a9162450530556c85b673a29769be513b7c` is in header DAA 1294, block `833f615988efae2120873fe5331ac8258f26f3f3682587d46a4a26cc5dbaf422`. Output 0 paid the locker 100000000. Output 1 paid the bearer 100000000. The fee is 5000000 sompi. The covenant output is gone. The child, header DAA 1295, block `e80a40a002032a273f83f0b9fa80416a3a33b0de100748a99697374e7a24b202`, is coinbase only and paid 2205000000 free and 2200000000 locked. The extra 5000000 is the claim's fee. The locked output still carries `STP1`. The journal clock on the open is `2026-11-04T08:02:52.824Z`. The journal clock on the claim is `2026-11-04T08:02:56.799Z`. Finality depth was not waited.

**Reasoning.** One lock of 2 KAS, a promise of 1 KAS chosen once, an add that did not change the promise, a withdraw of the cushion, and a claim that paid the bearer exactly that promise. The miner of each child received the free half of the subsidy plus 5000000 sompi. The locked half stayed 2200000000. A surplus of zero was not broadcast. This is a study. We are not claiming a stablecoin.

## The bearer handed the promise, 5 Nov 2026

**Fact.** The same half-split devnet. The read at the start was virtual DAA 1296, sink `e80a40a002032a273f83f0b9fa80416a3a33b0de100748a99697374e7a24b202`. The read after the claim's child was virtual DAA 1300, sink `d01fd57020c627bb09ce33cfcabee13e0d7a405f8f439632d05549fbf610140d`. The past median time on this read was `1793578216327`. The driver was `script/devnet-promise-pass.mjs`. It compiled `contracts/promise-pass.sil` with `silverc` 0.1.0. The bytecode is 669 bytes for the first bearer, for the next bearer, and for a promise of 200000000. `promise.sil` was not edited. `peg.sil` was not spent. `position.sil` was not spent. The clocks were not spent. Public TN10 and the five percent devnet were left up. No peer was added. The model command passed 52 tests. The model was not changed.

**Fact.** The open `ec3fc3134065c16fb7b4c36c39afa96dc57550db2eca386ef539278cb00e41c6` is in header DAA 1296, block `62541b44f7cab02b7e1a6fdcd4c2737665036478b8f6bc78318a4f818ec0bea3`. The UTXO score is 1297. The output is 200000000 sompi. The promise stored in the constructor is 100000000. The output script matches the redeem compiled for the first bearer. The fee is 5000000 sompi. Covenant `f772aab3e9064fc46bdc4972bcfae0d3ddc7dd8f7510a6f29e7a49de1d498138`. That block's coinbase paid 2200000000 free and 2200000000 locked. Header DAA 1295 is coinbase only, so this coinbase is not paying a fee from this handoff. The mass field was 20430. The verbose compute mass was 2083.

**Fact.** `1f6441e8d600989d0d87e95bdf7f60307ce3772a7abd5ba7c10816a20606bd0c` kept the covenant id and paid to a redeem compiled for a promise of 200000000. The node rejected it: the script ran, and verification failed. It is not in the parent walk from the new sink back through header DAA 1295.

**Fact.** The pass `c82ff68ee8e66c4c459d26e5792fae7b4cbd2e612d600af6de1e4ce01003f272` is in header DAA 1297, block `ea1940dbf49b76bcf08df664f1531a78472d92a1e0d981426be15dbef9181191`. The UTXO score is 1298. The lock is 200000000. The covenant id is unchanged. The output script matches the redeem compiled for the next bearer. The fee is 5000000 sompi. The coinbase of that block paid 2205000000 free and 2200000000 locked. The extra 5000000 is the open's fee. The locked output still carries `STP1`. The mass field was 526. The verbose compute mass was 6913. The same id was rejected first, when the locker signed it. A version-1 transaction id does not cover the signature script. The included output is the next bearer's script. The first bearer script is not funded.

**Fact.** The claim `a4717649bd49b02f001bf0ff0e7a24bfff196d62d722a920eaf5b7b75e4843ac` is in header DAA 1298, block `84c886dce14bdf3b1e01cd0197f1f0ca94c1ababcc99b17f9b6c29931e656f53`. The coinbase of that block paid 2205000000 free and 2200000000 locked. The extra 5000000 is the pass fee. The UTXO score of the payments is 1299. Output 0 paid the locker 100000000. Output 1 paid the next bearer 100000000. The next bearer is the address that mined these blocks. The payment is an ordinary output. The fee is 5000000 sompi. The covenant output is gone. The mass field was 10380. The verbose compute mass was 7247. The same id was rejected first, when the first bearer signed the claim. The child, header DAA 1299, block `d01fd57020c627bb09ce33cfcabee13e0d7a405f8f439632d05549fbf610140d`, is coinbase only and paid 2205000000 free and 2200000000 locked. The extra 5000000 is the claim's fee. The locked output still carries `STP1`. The journal clock on the open is `2026-11-05T09:10:25.092Z`. The journal clock on the claim is `2026-11-05T09:10:26.064Z`. Finality depth was not waited.

**Reasoning.** One lock of 2 KAS, a promise of 1 KAS chosen once, a handoff of that same count, and a claim that paid the next bearer exactly that promise. The miner of each child received the free half of the subsidy plus 5000000 sompi. The locked half stayed 2200000000. The new bearer and the miner are the same address. This is a study. We are not claiming a stablecoin.
