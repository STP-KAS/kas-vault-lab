# Economics

tUSD-TEST does not exist on the 1984 square. A search of the square's `*.mjs` files for `tUSD`, `tusd-test`, and `TUSD` found no matches. KUSDT and OLAF are already on that square. The rail id `poc` is POCencept.

Quotes below are from the square files at these commits. The repo HEAD that contained them was `ce8141ef316268efad7ffa991ea5e80c9bd9fdd5`.

- `money.mjs` and `olaf-pool.mjs`: `7d06ab42e4ef1d30e298a459add5af5683a3b6bb` (2026-10-13T21:45:16+02:00)
- `olaf-note.mjs`: `b37b8350fd5dd08979aea0ccfbd2cc5ce6f31dc3` (2026-10-22T23:56:26+02:00)
- `kusd.mjs`: `ee272966a024bfe0799d978be0c173e9c3b8402f` (2026-10-23T16:10:37+02:00)
- `client.mjs`: the lines cited are in that tree; the fee module commits are listed with them
- `congestion-fee.mjs`: `0dc143467c833046d8d37dc1e62421cb6750b64f` (2026-10-15T14:48:36+02:00)
- `faucet/fee-rate.mjs`: `723013edc31408498c77a8a6834802c679606a2b` (2026-10-09T14:41:25+02:00)

The kaspa master file `STP-REPOS.md` at `8b1553073d2bd7a9de2d478ebb074c6a34885d05` says, in the BitCoffee review row, "TN10, unaudited, not a dollar. SilverScript `3ed9733`. Peg unproven." The nearby row says "KUSD is not the asset. Not a dollar."

Each block is marked **fact** or **reasoning**.

## What the square says

**Fact.** `money.mjs` sets `RAILS` to `kas`, `poc`, and `kusdt`. The comment says OLAF is a shielded dollar note beside that list, not a member of it. `railName` maps `kas` to tKAS, `poc` to POCencept, `kusdt` to KUSDT, and `olaf` to OLAF. The word SquarePeg does not occur in `money.mjs`.

**Fact.** `olaf-note.mjs` defines the pay line: "1.00 OLAF is one dollar of tKAS at the quote when the note was made. A square lock of POCencept or KUSDT can redeem. The KCC-20 tokens are separate. This note cannot." Later lines say a later quote does not reprice the note, and "You cannot redeem OLAF the way you redeem POCencept or KUSDT." They also say the square freeze is on the KUSDT lock only, POCencept has no freeze output, the KUSDT frozen supply was not minted, and OLAF does not pass through SquarePeg.

**Fact.** `olaf-pool.mjs` says the pool keeps the commitment, the ciphertext, and, once spent, the nullifier. The spend key never belongs in the pool. The header says "This is not a zero-knowledge proof and not a settlement covenant."

**Fact.** `client.mjs` says "KCC-20 is Final. The POCencept and KUSDT covenants are separate from this SquarePeg lock." The poc blurb is "Tag only, no freeze. Redeem returns the locked part." The kusdt blurb is "Freeze blocks the KUSDT tag. Locked tKAS still redeems." Freeze posts to `/api/1984/freeze`. The frozen redeem line is "KUSDT is frozen. This redeem still returns the locked tKAS." The welcome copy says "The faucet is closed. Mine your own tKAS."

**Fact.** `kusd.mjs` is a square ledger. `mintKusd` locks tKAS at the quote at mint. `redeemKusd` burns KUSD and names the tKAS to pay back, and a later quote is not used. `sendKusd` moves the claim and its sompi share. The coins stay until redeem. One redeem throws at a cap of 10,000 tKAS. The file says Testnet-10 only.

**Fact.** `vault.mjs` is a classroom note. Its header says "No covenant is deployed."

**Fact.** `fee-rate.mjs` sets the ordinary TN10 rate at 100 sompi per gram and `PAGE_FEE_MULTIPLE` at 87. `congestion-fee.mjs` sets `ABSOLUTE_FEE_SOMPI` to 2,000,000,000 (20 tKAS) and says the square still pays 87 times the ordinary rate. `client.mjs` tells the reader the miner fee on a tKAS swap is 87 times the standard Testnet 10 rate and is extra KAS.

## Peg

**Fact.** OLAF, the square KUSD, and the SquarePeg locks all fix sompi at the quote used when the position was opened. The files say a later quote does not reprice them.

**Reasoning.** A receipt of sompi at an old quote is not a peg that survives a move in the KAS price. If KAS falls, the same sompi are a smaller dollar face. If KAS rises, they are a larger one. The face is historical. The coin amount is what the script, or the square ledger, returns.

**Reasoning.** This lab does not make that receipt. Minting tUSD-TEST requires collateral at a fixed ratio of a signed price, and burning it is how the owner reduces debt and then withdraws. That is solvency of one vault. It does not defend a dollar price for a holder who does not own the vault. A holder redemption against the system, in the style of a redemption by any note holder, is the peg defense that does not need a business. As of this paragraph, `vault.sil` does not implement it. `PROPOSALS.md` asks for that distinction on the square. The covenant itself stays the per-vault instrument the task asked for.

## Holder redeem, 1 Nov 2026

**Fact.** `contracts/peg.sil` adds that redeem for one lineage. The payout is the stored quote, not a fresh signature. The surplus stays on the vault. The square files named above are not edited. The note is still not a dollar, because the quote is a lab key and the two contracts do not share a float. `STUDY.md` is the longer reasoning. `ISSUES.md` lists what is still open.

## Collateral, mint, burn, redeem

**Fact.** The lab ratio is 200% at mint and withdraw, 150% for liquidation, and a 5% bonus cap. Dust is 0.2 tKAS. The formulas and the seizure split are in `DESIGN.md`. They round up. The debugger has executed them.

**Fact.** Mint requires the vault value to cover the mint ratio at the signed price. The carrier sompi on the note are not added to collateral. Repay burns the note and subtracts its cents from debt. It does not require a price. The carrier returns as ordinary change, not as collateral.

**Fact.** On the square, POCencept and KUSDT locks redeem the locked tKAS. OLAF's own text says the note cannot. KUSD on the square burns the claim and pays the sompi named at mint.

**Reasoning.** Calling any of those a redeem into dollars overstates the code. The thing paid back is tKAS, in an amount chosen when the position was opened, except for this lab, which pays nothing to a note holder until liquidation and then pays sompi from that vault only.

## Reserves

**Fact.** The square's OLAF text says the old public supply was deleted and new OLAF exists only as a note backed by tKAS paid in after that. There is no chain payout from that desk. The backing tKAS is not sent back to a wallet.

**Fact.** This lab has no reserve account, no treasury, and no mint desk. The only sompi behind a note are the sompi locked in its own vault output.

**Reasoning.** A reserve that is "the vault itself" cannot honor a run on every note at the dollar face. It can honor the vault's own debt, up to the sompi that are actually locked, and only on the path the script allows.

## Freeze

**Fact.** On the square, freezing KUSDT blocks the tag and still returns locked tKAS on redeem. POCencept has no freeze output. OLAF does not pass through that freeze.

**Fact.** This covenant has no freeze entry. The owner key can move the vault through the entries that require `checkSig`. The oracle key can sign a price. Neither key is a freeze switch. There is no admin entry that confiscates a healthy vault.

**Reasoning.** A missing freeze is not the same as censorship resistance. The oracle can sign a price that makes a vault liquidatable. That is a trust in the signer, and `LIMITS.md` states it. It is not a compliance freeze of a token balance.

## Liquidation and stress

**Fact.** Liquidation requires the note amount to equal the debt, a price signature, and collateral strictly under the 150% need. The seizure cap is the fair value plus 5%, and it never drains the vault below dust.

A KAS drop is the crash price in the driver: the same 3 tKAS and 1.00 tUSD that were healthy at 100,000,000 sompi per tUSD are under water at 250,000,000. The script does not look at a market. It looks at the signed integer.

A bank run, in the sense of every holder redeeming at once against a shared pool, has no shared pool here. Each vault is its own lineage. One vault's note cannot be burned against another vault.

A stale price is bounded by the signed window and by `OpTxLockTime`, as `DESIGN.md` describes. The residual is real: once median time is past an old expiry, a later transaction can set its lock time to that old expiry and still be final. The node will not reject that shape.

Congestion on the square is a fee policy: 87 times the ordinary 100 sompi per gram, with a stop at 20 tKAS, and the fee is extra KAS. This lab pays the fee from a separate input. It uses the node's fee estimate times mass, with a floor, and it does not multiply by 87. A crowded mempool can still price the fee above what a small faucet coin can pay. The collateral output is not the fee.

## OLAF privacy

**Fact.** The pool header lists a commitment, a ciphertext, and a nullifier. It says the construction is not a zero-knowledge proof and not a settlement covenant.

**Fact.** Michael Sutton, `@michaelsuttonil`, wrote on 11 Oct 2026: "that is not implied from KCC-20, since it’s merely a standard. it should be possible to build privacy features over current Kaspa L1 capabilities but they inherently require usage of zk opcodes which out of KCC-20’s scope."

https://x.com/michaelsuttonil/status/2109253446788317528

**Reasoning.** OLAF can hide the note secret from the public pool and can publish a nullifier when a note is spent. It cannot hide the tKAS that funded the square, and it cannot give the note a consensus covenant. A shop that checks a witness learns the witness. The header already tells the till not to store one. Privacy here is application state. It is not KIP-17 script privacy, and Sutton's sentence says the missing piece for L1 privacy is a zk opcode, which is outside KCC-20.

## Optional OLAF redeem

**Fact.** `olaf-note.mjs` says the note cannot redeem, and that spending a note burns that dollar without sending the backing tKAS back.

**Reasoning.** An optional redeem would be a new rule: who may claim, which quote is used, and what happens to the sompi. Adding it without a written rule would mix OLAF with the SquarePeg redeem. The proposal list says to keep the current sentence until that rule exists. This lab does not add an OLAF redeem.

## What Kaspa core enables now, and later

**Fact.** Now, on TN10, KIP-17 and KIP-20 are the script and covenant-id rules this contract uses: introspection, `checkMsgSig`, `OpTxLockTime`, and version-1 bindings. KCC-20 Final is a convention on top of those rules. The node will run a covenant that does not follow the convention. It will not make that covenant a KCC-20 token.

**Fact.** This desk found no core price oracle. The signed price is application data. rusty-kaspa pull 1152, the covenant-id UTXO index, was still open on 26 Oct 2026: `merged` false, head `6a68b2917b7c022185d3975ea9c8178247aacae0`, `updated_at` 2026-10-26T14:05:01Z. It is not required here. The driver reads `covenantId` from `getUtxosByAddresses`. The vprogs release list length was 0 on that date, and `master` was `f9b84a863a7c7c20586a9cf947550475e894f72e` (2026-07-28T11:24:41Z). This lab does not call vprogs.

https://github.com/kaspanet/rusty-kaspa/pull/1152

**Reasoning.** Later, a core oracle, a zk opcode, or a shared covenant family with real KCC-20 transfer could change the design. None of those is assumed. A social post about a decentralized Kaspa dollar is not a spec. The 26 Oct 2026 post by `@Rumbo_A_La_Cima` describes the idea in Spanish and does not define a collateral rule. No Kaspa Commons design post was found for this file.

https://x.com/Rumbo_A_La_Cima/status/2114800683136540713

## Two ways to fund a note, 1 Nov 2026

**Fact.** The devnet coinbase paid 2200000000 sompi as KAS and locked 2200000000 sompi, with face 1466666666, out of a 4400000000 sompi subsidy. `redeemMined` in the model, at price 1, returns 1466666666 of the lock and leaves 733333334. The finder who redeems at once holds 3666666666 sompi, against an unsplit 4400000000. Fees were zero in that example. The devnet lock cannot be spent.

**Fact.** `faceShare(4, 6, ...)` gives the finder 4/6 of the new face when every block pays the same subsidy. `supplyOf("coinbase", 0, ...)` is 0. `supplyOf("lock", 0, 2200000000, ...)` is 2200000000. The lock path does not read the subsidy. The coinbase path stops producing a face when the subsidy does.

**Fact.** `potMoves(19999, 20000)` is false. `potMoves(1, 1)` is true.

**Reasoning.** Miners sell what they are paid. If they are paid the note, the note's first market is the miners' sell orders, and the buyers are whoever wants the redeem right. That is a distribution method. It is also a concentration method. Hash replaces the Tether desk as the minter, and the largest pools become the largest first holders. Their sell can move the price of the note and, after redeem, the price of KAS. The script can stop them from taking another holder's lock. It cannot stop them from selling their own.

**Reasoning.** If the miner is paid only KAS, the security budget stays the Kaspa schedule, including the year it reaches zero and fees are what remains. People who want a note lock KAS they bought or mined. Issuance then follows willingness to lock, at the ratio, and it stops when they stop. A large miner who wants a large note has to buy KAS and lock it, or buy the note from someone who did. That is the same market every other holder faces.

**Reasoning.** The buffer in the 1.5 ratio is the 733333334 sompi that an immediate redeem does not return. It is the cost of surviving a drop in the quote, up to the gap `survivesGap` already checks. It is not income. Calling it a second reward double-counts a sompi that the holder cannot take.

**Reasoning.** A treasury key, one key or twenty thousand, that must sign before the sompi move, is the Tether desk written as a script. The economics of Tether that this lab can use without that desk are only the two rules above: mint against new collateral, and redeem the collateral asset at the published terms. The attestations, the bank, and the blacklist are the desk. They stay in `DOORS.md` as the door-only issuer, which is allowed to exist and is labeled as a company.

## A smaller slice, 2 Nov 2026

**Fact.** Five percent of 4400000000 sompi is 220000000 locked and 4180000000 free, with face 146666666 at price 1 and ratio 1.5. The second devnet paid that output 29 times. `redeemMined` returns 146666666 of the lock and leaves 73333334. The finder who also keeps the free output holds 4326666666 sompi. The half-split finder, in the same function, holds 3666666666. Both are below 4400000000.

**Fact.** At price 2, `forcedMinerValue` is 8800000000 with no slice, 8653333334 at five percent, and 7333333334 at half. The haircut scales with the slice. It does not change who receives the face. `faceShare` of 4 equal blocks in 6 is 4/6 at either slice.

**Fact.** `survivesGap(3, 2, 15000)` is true. `survivesGap(3, 1, 15000)` is false. `survivesGap(2, 1, 20000)` is true and `survivesGap(2, 1, 15000)` is false. The same five percent slice at ratio 20000 has face 110000000. An immediate redeem then holds 4290000000 sompi, because more of the lock is surplus. The crash tolerance got wider. The miner's immediate KAS got smaller. The locked sompi did not. The slice sets the lock. The ratio sets the face.

**Fact.** A fee of 200000 sompi at the half constants adds 200000 to the free output and leaves the face at 1466666666. The half chain paid that fee in the next block: immature KAS rose by 22.002 and the face rose by one face. A subsidy of 29 at five percent diverts 1 sompi with face 0. A subsidy of 30 has face 1.

**Reasoning.** Taking a little of the block reward does not make a different economy from taking half. It changes the amount. The miner is still the first holder of the face, in proportion to blocks found. The buyer who wants the redeem still depends on a spend rule this lock does not have, and on a quote this constant does not check. The clean result is the fee. Moving KAS did not feed the face. The tail result is the warning. A face defined as a fraction of the subsidy goes to zero while KAS is still being paid, and the sompi it diverted at that point are not paid back. A voluntary lock does not have that tail, because it does not divert the subsidy. Its size is whatever someone locks, and it stops when they stop.

## What a redeem paid, 2 Nov 2026

**Fact.** Two voluntary locks of 300000000 sompi each redeemed at price 100000000. Each holder received 100000000 sompi. Each vault kept 200000000. The carrier of 20000000 went back to the holder. The miner fee, 6913900 sompi on each redeem, came from another output. The subsidy on that devnet was not split by these transactions. The block reward still went to the address that mined the including block.

**Fact.** `refreshSolo` then stored price 200000000 on the first vault. The sompi in the vault stayed 200000000. A 50-cent mint at the 2.0 ratio used that whole 2 KAS as the required collateral. The redeem paid 100000000 sompi again and left 100000000. The face changed. The kas did not. The signature that changed the price was the oracle key. The vault owner did not sign that transaction.

**Reasoning.** Mint against new collateral, and pay the stored terms back, both happened. The terms were whatever the lab key wrote. A holder who bought the first note at 1 KAS per 1.00 would have been facing a different number if the key had refreshed before the redeem. The second mint shows the arithmetic in sompi: half the cents, twice the price, the same kas. That is a working redeem and a movable price. It is the Tether desk's price power without Tether's blacklist. The coinbase door is unchanged. Its lock still cannot be redeemed, and its miner is still paid less KAS than the full subsidy.

## A late block still paid the signed price, 2 Nov 2026

**Fact.** Covenant A held 100000000 sompi at stored quote 200000000, and the debt was 0. A mint of 25 cents at price 100000000 was signed inside a 45 second window and included 2515 milliseconds after that window's expiry. The node accepted it. `atRatio` of that mint is 50000000, so the 1 KAS still covered the 2.0 line. The redeem paid `fairSompi(25, 100000000)`, which is 25000000 sompi, and left 75000000. The fee on the mint was 8000000 sompi. The fee on the redeem was 9557300 sompi. Both fees came from other outputs. The ids are in `RESULTS.md`.

**Reasoning.** The clock of the block did not change the payout. The payout was the price in the signature, and debt 0 let that signature replace the stored quote. A shop that had been using the 200000000 quote was then redeeming against 100000000, in a block whose own timestamp was already outside the window the oracle had signed. The sompi moved because the script allows it. The miner was paid a fee and the block reward, in KAS, from outside the lock.

## A held note was repriced, 2 Nov 2026

**Fact.** Twenty cents were minted at price 100000000 against 75000000 sompi. `fairSompi` at that price is 20000000. The lab key stored 400000000 while the note was outstanding. `fairSompi` became 80000000, which is more than the vault. A redeem that offered 40000000 was rejected. The key then stored 200000000. The holder redeemed 40000000 and left 35000000. The fees were 4000000, 8871700, 4000000, and 3871600 sompi, each from a coin outside the lock.

**Reasoning.** The holder of the note did not agree to the new price. The script does not ask them. The arithmetic they redeem is the quote at redeem time. A shop that took the note at 0.2 KAS per 0.20 was paid 0.4 KAS, and for a few seconds the vault could not pay at all. That is the key's power over a note already in someone else's hands. The miner still found the blocks and was paid in KAS.

## An outstanding note kept its quote, 3 Nov 2026

**Fact.** A new vault locked 100000000 sompi. Twenty cents were minted at price 100000000. `fairSompi` at that price is 20000000. The lab key asked to store 400000000 while the note was outstanding. `fairSompi` at that price is 80000000, which fits, and 20000000 would have remained. The node rejected the refresh. The holder redeemed 20000000 and left 80000000. The fees were 4004100, 3573400, 2012200, and 3878000 sompi, each from a coin outside the lock. The ids are in `RESULTS.md`.

**Reasoning.** The shop that took this note at 0.2 KAS per 0.20 was paid 0.2 KAS. The key signed a different number and the script refused to store it. That is one vault, opened after the rule changed. It does not rewrite the note covenant A already paid at 0.4 KAS. It also does not fix the next mint. When debt is 0, the same key can still set the quote the following note will redeem. The miner was paid in KAS, from outside the lock.

## The following note paid the same kas, 3 Nov 2026

**Fact.** The vault then held 80000000 sompi at quote 100000000, and the debt was 0. `refreshSolo` stored 200000000. No owner signature. A mint of 10 cents at that price has `fairSompi` 20000000 and `atRatio` 40000000. The redeem paid 20000000 and left 60000000. The fees were 4562000, 2012000, and 5222300 sompi, each from a coin outside the lock. The ids are in `RESULTS.md`.

**Fact.** The child of the redeem block paid the miner 2205222300 sompi and locked 2200000000. The free output is half of the 4400000000 month-0 subsidy plus the 5222300 redeem fee. The block that included the redeem paid 2202012000, which is the same half plus the 2012000 mint fee. Official Kaspa pays those fees inside the one unsplit subsidy output. On 3 Nov 2026 the public block reward was 2.06017223 KAS.

**Reasoning.** A shop that took 10 cents after this refresh was paid the same 0.2 KAS a shop would have been paid for 20 cents at the old quote. The key chose that. The miner who found the paying block received about half of a devnet subsidy, plus the fee, and the locked half did not move. The holder's kas came from the vault. Paying the miner less did not supply the price.

## Their bands, read on 3 Nov 2026

**Fact.** Kaspa Dollar's pages price a new note at 2.5 dollars of KAS per note, keep a band from 2.0 to 2.5 where the owner neither mints nor withdraws, and call a vault unbacked below 1.0. From the minimum open, a 60 percent fall in KAS reaches that line. From the 2.0 line, a further 50 percent fall reaches it. Their worked case, 1,000,000 KAS at 36,600 dollars, mints 14,640 notes. After a 25 percent fall the position is 27,450 against 14,640. An unnamed 5 percent penalty restores 2.0 on the unrounded numbers: repay 18,300,000/9,500 of the debt and seize collateral between 2,022 and 2,023 dollars. They printed 1,926 repaid, 2,023 seized, 96 dollars lost, and 25,427 left against 12,714. The unrounded penalty is about 96.32. The printed pair differs by 97, and 25,427 is one dollar under twice 12,714. They say a shortfall is not spread to other vaults and that no new asset is minted to cover it. They say a vote does not change the block reward, and that miners are paid a fixed KAS amount from an oracle fee whose size is not published.

**Reasoning.** The band is a statement about how far the collateral price can move before one position is short. It is not itself a price. The fee beside the full subsidy is the pay shape this study already kept for miners, and the amount is still blank. A loss that stays on the short vault is the same refusal of seigniorage already written above. A redeem that lets the holder pick any vault is a different power from redeeming one's own note: equal dollars removed from a backed vault raise its ratio, and the same removal from a short vault lowers it. The shop still needs someone to name the dollar value of the KAS. On these pages that someone is the median of the miner votes. The median is still a vote.

## Their hours, 3 Nov 2026

**Fact.** The same pages limit how fast that median may move a price. Mint may rise 10 percent an hour and may fall at once, and it stays at or below the median. Liquidation, which is also their redeem price, falls 25 percent an hour on the chart and in the fall-limit section, and one bullet leaves the fall uncapped. A missing price for 30 minutes stops mint, withdraw, liquidate, and redeem, and leaves add, repay, and close running. A missing price for 30 days settles that vault at the last price, ends its minting, redeems with no fee, and returns the KAS above the debt to the owner. The vote window is ten minutes and is marked preliminary. None of the five names a clock.

**Reasoning.** A shop that trusts "a false low price takes hours" is trusting the fall cap. One step of 25 percent against the price from an hour earlier keeps that sentence, and so does subtracting 25 points an hour. Repeating the 25 percent at every ten-minute sample does not, and the uncapped bullet does not. The median clamp stops a capped mint from printing a price above the vote, and stops a capped liquidation from printing a price below it. The halt is a period when the note cannot be redeemed. Settlement is what opens redeem again, at the last price, with the fee removed. The amount of the oracle fee is still unpublished, and the block reward on their page is still whole. The DAA wait measured on this desk moved 20000000 sompi from one covenant output to the next. It did not price anything.

## The same integers, 5 Nov 2026

**Fact.** The position driver opens at 25000 basis points, with a stored liquidation line of 20000 and a bonus of 500. `policy` checks those two fields. No entry spends them. The peg driver remains 20000, 15000, and 500. The numbers were not copied across. The bands and the hours above are the 3 Nov reading. They were not read again.

**Fact.** A handoff of 100000000 sompi from a lock of 200000000 does not change the count. The model of that handoff is `model/promise-pass.mjs`. A claim where the lock equals the promise still returns a surplus of 0 from `claimPays`, and the handoff model refuses that claim. It was not broadcast. The command passed 56 tests. The earlier counts stay in their own notes.

## A second income, named on 6 Nov 2026

**Fact.** The posts are in `STUDY.md`. BIP 100 changes a block-size limit. It does not pay a second income. The fee beside the subsidy is the 3 Nov reading, and the amount is still blank. `bip100Next` does not pay anyone. The block reward in this study stays the full KAS reward. The command on 6 Nov passed 57 tests. The 56 stays in the section above.
