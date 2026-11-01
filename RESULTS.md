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
