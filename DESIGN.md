# Design

tUSD-TEST is a TN10 vault covenant. One sealed vault locks sompi and may mint one note. The note's amount, in cents, is the vault's debt. Burning the note reduces that debt. If a signed price makes the vault strictly under the liquidation ratio, the note owner can seize sompi up to a capped bonus and clear the debt.

The lab token uses the Final KCC-20 field order and conserves its own cents one-for-one inside a single vault. It is not a conforming KCC-20 program. It is not a drop-in for the Argent `public_mint` reference.

Each statement is marked **fact** or **reasoning**.

## Language

**Fact.** The covenant is SilverScript, file `contracts/vault.sil`, pragma `silverscript ^0.1.0`. A local `silverc` compile writes `compiler_version` `0.1.0`. The same source runs in `cli-debugger`.

**Reasoning.** SilverScript is the implementation language because that compiler and the local script VM are on this desk. The Argent reference was read so the issuance path is not mistaken for a collateral check. No Argent binary was required to compile this contract.

**Fact.** `public_mint.ag` at `argent-lang/kcc20-reference` commit `27f8403fee55863125b044c73b2c9449d997a6ca` (2026-10-21, "Add .gitattributes (#5)") is 123 lines. A search of that file for `collateral` returns no hits. The `mint` entry requires `amount > 0`, `amount <= mint_amount`, `amount <= remaining`, an extension commitment match, a valid owner scheme, a valid borrow scheme, `minter.value == self.value`, and `unrestricted(recipient.value)`. There is no burn entry.

https://github.com/argent-lang/kcc20-reference/blob/27f8403fee55863125b044c73b2c9449d997a6ca/contracts/public_mint.ag

**Fact.** This repo does not use the older `kcc20.sil` examples. The KCC-20 reference named by the Final spec is the Argent repository above.

## Specs

**Fact.** KIP-17 is Active at kips commit `e4ae2332117b5cb68bd6188e065ef885b6d17939`, updated 2026-05-31. `OpTxLockTime` (`0xb5`) returns the transaction lock time. The DAA opcode in that file is `OpTxInputDaaScore(idx)` (`0xc0`), the DAA of the block that created the spent UTXO. That file does not name an opcode for the current DAA or the spending block's DAA.

https://github.com/kaspanet/kips/blob/e4ae2332117b5cb68bd6188e065ef885b6d17939/kip-0017.md

**Fact.** KIP-20 is Active at the same commit, updated 2026-05-28. A continuation output is a covenant-bound output whose authorizing input already spends a UTXO with the same `covenant_id`. Section 4.2: if `utxo(authorizing_input).covenant_id == Some(covenant_id)` the output is a continuation; otherwise it is a genesis output. Version must be at least 1 for bindings.

https://github.com/kaspanet/kips/blob/e4ae2332117b5cb68bd6188e065ef885b6d17939/kip-0020.md

**Fact.** KCC-20 is Final at kccs commit `9dec4a0421326a99c70d07f0aa11d11bc894ab9b` (2026-10-21). It requires KCC-1, KCC-2, and KIP-20. The state fields, in order, are `amount`, `owner`, `owner_scheme`, `borrow_scheme`, `borrow_guard`, `extension_commitment`. A conforming program must support borrow schemes `0x00` through `0x03`. Section 4 allows extra entrypoints. The standard transfer conserves amount and preserves the extension commitment. Borrow schemes other than `0x00` are part of conformance, not an optional extra.

https://github.com/kaspanet/kccs/blob/9dec4a0421326a99c70d07f0aa11d11bc894ab9b/kcc-0020.md

**Fact.** kccs commit `1ed87aef59faff8354061aee30f734a3b8b2c3d2` (2026-10-21T14:50:48Z, "KCC-1: advance to Final (#39)") has KCC-1 and KCC-2 at Status Final. The KCC-20 text quoted here is the file at `9dec4a04`.

## State

The constructor order is the KCC-20 prefix, then the lab fields:

`initAmount`, `initOwner`, `initOwnerScheme`, `initBorrowScheme`, `initBorrowGuard`, `initExtension`, `initKind`, `initDebt`, `initOracle`, `initRatioBps`, `initLiqBps`, `initBonusBps`, `initSealed`.

`kind` 1 is the vault. Its collateral is the output value in sompi. `debt` is cents. `amount` is 0.

`kind` 2 is the note. `amount` is cents. `debt` is 0. The note output's sompi is the carrier, 20,000,000 sompi (0.2 tKAS), and that carrier is not collateral.

`policy` requires `ratioBps > liqBps`, `liqBps > 10000`, `bonusBps` from 0 to 2000, every ratio at most 50,000, `10000 + bonusBps` at most 50,000, a non-zero oracle, owner scheme `0x00`, borrow scheme `0x00`, and a 32-byte zero borrow guard. The fixed parameters for the driver are 20,000 bps (200%), 15,000 bps (150%), and 500 bps (5%).

**Fact.** Rejecting borrow schemes `0x01`, `0x02`, and `0x03` means this program does not meet the KCC-20 sentence "A conforming KCC-20 program MUST recognize the disabled scheme and support all three enabled borrow schemes." There is no `transfer` entry and no `transfer_delegator` entry. Do not treat a vault note as a KCC-20 token a stock wallet can move.

**Fact.** `validateOutputState` checks the successor script. It does not check the sompi amount. Every entry that cares about value reads `tx.outputs[i].value`. A fresh `silverc` compile of the next constructor arguments is what the successor script must be. The driver does not splice bytecode.

## Lineage

**Fact.** Genesis is a version-1 transaction. `populateGenesisCovenants` binds the vault output to the funding input. Later spends read `covenantId` from the UTXO and set `CovenantBinding` on each continuation. KIP-20 makes a forged covenant id uncreatable at consensus. The script still checks the script and the binding.

**Reasoning.** Open itself is a P2PK spend. The vault script does not run on that input, so a genesis output can be created with any constructor state. The seal entry is the gate: `debt == 0`, `amount == 0`, `kind == 1`, `sealed == 0`, and `policy`, then `sealed` becomes 1. Every other vault entry requires `sealed == 1`. Mint also re-checks `policy`, so a genesis that skipped seal with a weak ratio still cannot mint. The debugger rejects an unsealed mint.

**Fact.** The note is a continuation of the same covenant id. A second vault is a second genesis and a second id. Notes from vault A and vault B are not one fungible currency. KCC-20 fungibility, inside one id, also requires equal extension commitments. This lab keeps one extension per vault and does not merge lineages.

## Shapes

Indexes are fixed. They are not arguments.

- Seal, deposit, withdraw: input 0 is the vault. Output 0 is the vault continuation authorized by input 0. Exactly one covenant input and one covenant output. A fee input and a change output carry no covenant id.
- Mint: input 0 is the vault, and `debt` must be 0. Output 0 is the vault with the new debt. Output 1 is the note. Both are authorized by input 0. The note value is the carrier. The vault value is unchanged, so the carrier cannot be stuffed into collateral. One note exists until it is burned. A second mint fails because `debt != 0`, which is a different failure from the ratio check. The "mint above ratio" test has to run while `debt` is still 0.
- Transfer, repay, and liquidate: inputs are the vault, then the note, then the fee. Transfer keeps both outputs. Repay and liquidate keep one covenant output, authorized by the vault input. The note authorizes nothing.
- Liquidation output 1 is a P2PK of the note owner, with no covenant id. The pubkey is read from the note state. It is not an argument the caller can swap.

Deposit and `vaultRepay` and `vaultMove` do not ask for an owner signature. Note-side entries check the owner signature last. Mint, withdraw, and liquidate check the oracle signature. Repay does not.

**Reasoning.** "Withdraw while in debt" in this lab means a withdraw that would leave the vault under the mint ratio. A smaller withdraw is allowed when the sompi left still meet the mint ratio and the dust floor. That is a solvency check. It is not a ban on every withdraw while debt remains.

## Numbers

`price` is sompi per 1.00 tUSD. `debt` and `amount` are cents.

`fair = (cents * price + 99) / 100`

`need = (fair * ratioBps + 9999) / 10000`

Both divide in integers and round up. Caps: `MAX_DEBT` 1,000,000, `MAX_PRICE` 10,000,000,000, `MAX_RATIO` 50,000. The products fit in a signed 64-bit integer: cents times price is at most 10^16, and fair times ratio stays under 2^63.

Checked vectors, also in `contracts/ratio.sil`:

- debt 100, price 100,000,000, ratio 20,000 needs 200,000,000 sompi. One sompi less fails.
- debt 1 at the same price and ratio needs 2,000,000.
- debt 1, price 1, ratio 50,000 needs 5.
- liquidation at 15,000 bps on the first vector needs 150,000,000.
- the 5% bonus on that fair value is 105,000,000.

Dust and the carrier are both 20,000,000 sompi.

Seizure requires `cap >= dust` and `collateral >= 2 * dust`. If `collateral >= cap + dust`, the liquidator receives `cap` and the vault keeps the rest. Otherwise the liquidator receives `collateral - dust` and the vault keeps dust. The liquidator never receives more than `cap`, and the vault is never left below dust. The whole collateral is not given away. Liquidation is full only: `note.amount == debt`. Underwater is strict: collateral `<` the liquidation need.

The TN10 crash used by the driver, after a healthy mint: collateral 300,000,000, debt 100, mint price 100,000,000. Crash price 250,000,000. Fair value 250,000,000. Liquidation need 375,000,000. Cap at 10,500 bps is 262,500,000. Collateral is at least cap plus dust, so the seizure is 262,500,000 and the vault keeps 37,500,000.

## Price

**Fact.** Kaspa core, as read for this lab, has no price oracle. The signer is a key generated for the run and kept out of git. The debugger fixture uses private scalar 1. That scalar is a public test vector. It is not funded.

The message is `OpNum2Bin(price, 8) || OpNum2Bin(notBefore, 8) || OpNum2Bin(expiry, 8)`, little-endian. `checkMsgSig` verifies a 64-byte BIP340 signature over `blake3(message)`. The 32-byte digest is the message. It is not hashed again, and it is not a BIP340 tagged SHA-256. The owner signature is a 65-byte transaction signature, so the outputs are bound. The oracle signs the price message, not the transaction.

**Fact.** In rusty-kaspa commit `a41a333b08848f41bf737b72592e463a6011b8ac`, `LOCK_TIME_THRESHOLD` is 500,000,000,000. A lock time below that is a DAA score. A lock time at or above it is compared with median time. Header timestamps in that tree are milliseconds (`difficulty.rs` divides a timestamp delta by 1000 to get seconds). Unix seconds in 2026 are about 1.79e9, which is below the threshold, so a seconds lock time is a DAA lock time. Unix milliseconds are about 1.79e12, which is above the threshold, so they are time lock times.

https://github.com/kaspanet/rusty-kaspa/blob/a41a333b08848f41bf737b72592e463a6011b8ac/consensus/core/src/constants.rs

The script requires `lockTime >= notBefore`, `lockTime <= expiry`, and `expiry - notBefore <= 3,600,000`. That is one hour. The debugger has shown a lock time past expiry fail at `require(lockTime <= expiry)` after the successor checks. It has also shown a fixture signature accepted by `checkMsgSig`, with the following owner `checkSig` rejecting a dummy signature (`invalid hash type`).

**Fact.** Consensus finality is median time `>` lock time, or DAA `>` lock time. A transaction can be mined after the signed window if its lock time was set inside the window. Setting the lock time back to an old expiry, once median time is already past that expiry, is still allowed by consensus. `LIMITS.md` records that residual. This contract does not close it.

**Fact.** TN10's virtual DAA on 26 Oct 2026 was about 6.07e8 on the resolver used by the driver, and the REST health blue score was about 5.96e8. Both are far below 500,000,000,000, so a DAA lock time of "now" is still a legal DAA value. The price window uses milliseconds anyway, because a wall-clock expiry is the check the oracle signs.

## What the debugger has shown

`contracts/ratio.test.json`: 23 cases, all passed, including the rounding, the caps, the shortfall boundary (strictly under 150% passes `short`, exactly 150% fails it), and the seizure branches.

`contracts/vault.test.json`: 15 cases, all passed. Passing cases with no signature show the successor and the economics. Failing cases stop at the intended `require`: unsealed mint, mint above the ratio, stale lock time, a withdraw that breaks the ratio, forged debt on deposit, a bad oracle signature, a healthy vault presented for liquidation. The fixture oracle signature reaches the owner `checkSig` and fails there.

Positive mint, seal, withdraw, and liquidate still need a real transaction signature. Those are accepted or rejected on TN10, and `RESULTS.md` records which.
