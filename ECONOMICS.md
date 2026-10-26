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

**Reasoning.** This lab does not make that receipt. Minting tUSD-TEST requires collateral at a fixed ratio of a signed price, and burning it is how the owner reduces debt and then withdraws. That is solvency of one vault. It does not defend a dollar price for a holder who does not own the vault. A holder redemption against the system, in the style of a redemption by any note holder, is the peg defense that does not need a business. This lab does not implement it. `PROPOSALS.md` asks for that distinction on the square. The covenant itself stays the per-vault instrument the task asked for.

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
