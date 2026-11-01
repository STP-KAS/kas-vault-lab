# Issues

Study questions from 1 Nov 2026. The 27 Oct files are still in the tree. `peg.sil` and `model/issues.mjs` are the additions. Nothing here is a mainnet rule.

| Issue | Where it stands |
| --- | --- |
| A second coin in the coinbase | Not built. The coinbase pays sompi. Putting another asset there is a hard fork. The model shows the subsidy split pays less than KAS. |
| Electricity as the reserve | Not possible here. Issuance month is DAA divided by blocks per second. Hashrate is not an input. A kilowatt-hour is not a redeemable output of kHeavyHash. |
| Holder redeem, so a swap does not reprice the note | In `peg.sil`. Burning the note pays `fairSompi(debt, quote)` to the note owner. Surplus stays in the vault. `vault.sil` still has no stranger redeem. |
| Stale quote: stop mint, leave redeem open | Half. Redeem does not take a new oracle signature. Mint and refresh do. The script still cannot read the spending block's DAA. A mint signed inside the window can be mined later. `LIMITS.md` already recorded that hole. |
| Miner fee taken from the lock | Refused. Redeem requires the vault to drop by exactly the payout, and the carrier to be returned in full. The fee is whatever sompi a non-covenant input adds. |
| One global vault on a 10-block-per-second DAG | Refused as a design. The model keeps two spends of one UTXO to a single acceptance, and two positions to two acceptances. Each lineage is its own id, as `DESIGN.md` already said. |
| Who is paid when the including block goes red | Not scriptable. The model records the coinbase rule: a blue pays the finder, a red's reward pays the merger. A same-block "pay the miner who included this" output cannot name that person. |
| Miner-only mint | Not built. The lock can be anyone's matured KAS. Gating the mint on a coinbase script would hand it to pools. |
| Home IceRiver ASICs and their pools | Not used. They find KAS and the pool pays KAS. They cannot mint, redeem, or hold the quote. A pool rebate in some other token is the pool's own ledger. `STUDY.md` records why the machines stay on their current work. |
| Seigniorage, rebase, or a separate chain | Not built. They do not fix the peg. |
| Oracle | Open. The signer is still a key. A hashrate vote on the price is not used. A ZK proof of a published price is not in this repo. |
| The note cannot pay the miner by itself | Open as a shop fact. The carrier is 0.2 tKAS and is returned to the holder. It is not spent as the fee. A note with an empty sleeve still needs sompi beside it. |
| Finality | Open. Acceptance is not the finality depth. This repo does not tell a shop to treat an unfinalized redeem as cash. |
| Crash through the ratio | Open. At 1.5x, the model marks a gap larger than one third as insolvent. Liquidation of that case remains the 27 Oct entries in `vault.sil`. `peg.sil` does not liquidate. |
| Two lineages, one currency | Open. Notes from two ids are not one float. A holder redeems against the vault that issued the note. |
| One note per vault | Kept. Redeem is full. A partial note would be a second output and a new invariant. |
| Ordering versus the issuer's door | Written in `DOORS.md`. Miners order. A key that freezes a circulating note is still a key after the note is a Kaspa covenant. Inclusion is not success. The model checks that. |
| A Tether-like issuer on Kaspa | Possible as sequencing. The decentralized practice is a sealed script, no freeze on notes already in circulation, mint and redeem only at the company's door, miners paid in KAS, any relayer allowed to front the sompi. The bank stays the bank. Not built as a contract. |
| Open relayer so a holder of only the note can pay | In the model. The relayer spends KAS, the miner receives that KAS, the user spends notes. The relayer is not a sequencer. A covenant for it is not in `peg.sil`. |
| One winner among the doors | Not chosen. Receipt, vault, door-only issuer, and freeze token are different promises. A freeze in one must not reach the others or reach KAS. |
| Fifty-five percent of TN10, then a hard fork, so a second coin shows in the wallet | Not done. Two one-thread miners ran about half a minute on public TN10 and were stopped. The public API shows ordinary sompi coinbases for both addresses. A larger share on this kaspad still pays sompi. No kaspad patch. No new wallet. The two block hashes are in `RESULTS.md`. |
