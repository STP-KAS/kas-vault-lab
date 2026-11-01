# Results

No TN10 transaction was broadcast. There is no vault txid, no mint txid, no repay txid, no withdraw txid, no liquidation txid, and no rejection from a node. The driver stopped while asking for test coins.

tUSD-TEST was not created on chain. It is not a stablecoin, and the script is not a conforming KCC-20. `DESIGN.md` states the field order and the missing borrow schemes.

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

**Reasoning.** These threads are the only hash on this devnet, so the blocks they found are the chain. A public node that does not run this patch will not accept the blocks. The face uses a constant, not a market and not a vote of the miners. The locked sompi cannot be spent by the script as written. STP here is a number stored beside the lock, not a coin a stock wallet can send. `peg.sil` was not broadcast. There is still no peg txid.

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
