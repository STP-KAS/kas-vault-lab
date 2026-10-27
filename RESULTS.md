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
