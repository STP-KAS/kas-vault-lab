# Doors

1 Nov 2026, continued. The earlier files stay as they are. This page asks a second question in the same lab: what a unit on Kaspa is for, if the aim is decentralization, miners who secure the chain, and applications that want to settle here. It is not a product. It is not an endorsement of Tether, of Kaspa Dollar, or of a mined coin. Making money is not the aim.

The word used below is Kaspa. A unit does not have to be a dollar. A dollar is one numeraire. The doors are the same for any numeraire.

## Two powers

Ordering is who may include a payment in a block. On Kaspa that is any miner. The coinbase pays them sompi. There is no sequencer company in that path. A rollup that collects payments and later posts a digest has a sequencer again, even if the digest lands on Kaspa. The miners then secure a receipt of someone else's order. They do not order the payments.

The door is who may create the unit, destroy it, freeze it, or name its price. That power is not mining. A hashrate majority that votes the price can mint an undercollateralized note inside valid blocks. A hashrate majority that is the only minter is a set of pools. Both were refused in `STUDY.md`.

Applications do not come to Kaspa because the chain becomes a sequencer. It already orders transactions. They come when the unit they invoice in can move as a Kaspa transaction. The unit is the reason to settle here. The miners are already the ordering.

## What Tether keeps, on any chain

USDT on Ethereum and on Tron is a token contract with an owner key. Public write-ups of those contracts describe `addBlackList`, `removeBlackList`, and `destroyBlackFunds`. The key can stop an address from sending the token. A further call can delete a frozen balance. The chain that includes the transaction does not hold that key. Ethereum does not freeze ETH this way. Tron does not freeze TRX this way. The freeze is inside the issuer's contract. Self-custody of the key does not bypass it.

Moving that contract's logic into a Kaspa covenant does not remove the key. Miners will include a valid freeze transaction the same way they include any other valid transaction. Inclusion is not success. If the script says a frozen note cannot be spent, the spend fails after a miner has included it. `model/doors.mjs` records that split. Miners cannot delete the key unless the script never had the path. Censoring the issuer's transactions would turn miners into a second compliance desk. That is not their job, and it is not decentralization.

A pool that pays a bonus token from its own books is the same shape at a smaller size. The ordering of KAS is still the chain. The bonus is the pool's ledger.

## The doors, side by side

`model/doors.test.mjs` checks the labels. "Fits" means four things at once: miners order it, no sequencer sits in front, a circulating note cannot be frozen, and the subsidy is not cut. A fit can still have an issuer at the mint door, or a quote key. Those are named on the object. They are not hidden inside the word fit.

| Door | Who orders | Circulating note | What is still a key | Miner pay | Priced for an invoice | In this repo |
| --- | --- | --- | --- | --- | --- | --- |
| Receipt | Miners | Bearer. The sompi are fixed | None | KAS fee | No. The face moves with KAS | The square, not this covenant |
| Vault study | Miners | Bearer. Redeem at the stored quote | The quote signer | KAS fee. Surplus stays in the lock | Only while the quote is honest | `peg.sil` |
| Subsidy split | Miners, after a hard fork | Bearer if no freeze is added | The new consensus rule | Less than the KAS reward | Only if collateral covers it | Refused as a public rule. The model shows the haircut. A private devnet ran the bytes. `RESULTS.md` |
| Committee pot | Miners, if they order the deposit | Not bearer. Too few signatures and the pot does not move | The signer set | Less KAS, if the reward was diverted into the pot | No | Refused. One pot for many holders is a freeze |
| Freeze token | Miners, if it is a Kaspa covenant | Not bearer. A key can stop a spend and can destroy a balance | The issuer | KAS fee, and volume may be large | Yes, until a freeze | Not built |
| Door-only issuer | Miners | Bearer once it is in circulation | The issuer, at mint and redeem only | KAS fee | Yes, if the issuer honors redeem | Not built. This is the practice below |
| Rollup | A sequencer, then a digest on Kaspa | Whatever the sequencer's chain says | The sequencer and the issuer | The data fee, not the payments | Yes | Refused as an ordering design |

A receipt is the most decentralized and the least useful as an invoice. A freeze token is the most familiar dollar and the least bearer. A subsidy split looks like the miners issue the unit. The arithmetic says they are paid less KAS to do it. The vault is the decentralized collateral door this lab can actually express, and the quote key remains. The door-only issuer is the decentralized practice available to a company that already holds bank reserves.

None of these is "the best" in the abstract. They answer different jobs. They can sit beside each other only if a freeze in one cannot reach the others, and cannot reach KAS.

A later pass added the committee pot and pointed the subsidy-split row at the private devnet. The row stays refused as a public rule. The pot is refused because a shared signature is a shared freeze. The vault row is unchanged. A six-thread stage on that same devnet crossed coinbase maturity. The free KAS was spent. The node rejected the lock. `RESULTS.md` has the ids. A second private devnet ran the same split at five percent. The row does not change. Five percent is a smaller haircut and the same promise. The vault is still the door that leaves the subsidy whole.

## What a Tether-like issuer can do here

The issuer can put ordering on Kaspa completely. That part is already decentralized, fast at ten blocks a second, and paid in sompi. The Toccata fee floor is a node policy, 100 sompi times mass, not a consensus ban on a zero-fee transaction. A covenant spend is heavier than a plain payment. This repo does not convert that into a dollar figure.

The issuer cannot put the reserve on the miners and remain a reserve issuer. The dollars, if they are dollars in a bank, stay with the company. Miners do not become the bank by finding blocks. A proof that a published reserve matches supply, checked in a covenant, removes a bridge committee. It does not remove the bank. KIP-16 is a place a proof could be checked. This repo does not contain that circuit.

If the goal is decentralization, the issuer's script has five restraints:

1. Transfers of a note already in circulation have no blacklist, no pause, and no destroy. Compliance, if the company still has it, sits at the door where notes are minted and redeemed. A frozen door stops new issuance. It does not seize a note that has left.
2. The transfer script is sealed. The issuer cannot replace it with a freeze later. The 27 Oct vault already uses a seal for a smaller reason. The same idea applies.
3. There is no sequencer. The issuer broadcasts transactions like anyone else. Miners include them.
4. The miner is paid in KAS. The subsidy is left whole. Fee volume from real use is the miner benefit. A second forced coin is not.
5. Anyone who holds KAS may front the sompi fee and be repaid in the note, in the same payment. That person is a relayer, not a sequencer. If only one company offers it, the fee market has a clerk. The script should allow any relayer, so the clerk is not required.

`paymaster` in the model is that fifth restraint. The user spends notes. The relayer spends KAS. The miner receives KAS. The note's redeem rule is what keeps the note's price still. The relayer's spread is a separate trade.

A company that keeps `addBlackList` and `destroyBlackFunds` in the transfer path has chosen the freeze door. Kaspa will sequence it faithfully. That is not a bug in the miners. Users should be told the key exists. Law that demands a freeze is a demand for that key. The chain cannot satisfy the demand and also make the note bearer.

## Miners and applications together

Miners are included by ordering every payment and by being paid in the coin their machines already find. They are not included by being the only address allowed to mint. Pools would become that address. They are not included by taking a haircut on the subsidy so the protocol can print a second unit.

Applications are included when the unit they price in is a Kaspa spend, the spend cannot be frozen under them, and a person who holds only the unit can pay a relayer for the sompi fee. Finality is still the long window. A shop that treats first acceptance as cash has taken reorg risk. That limit is unchanged.

Low fees follow from the sompi floor and from open relaying. They do not follow from a sequencer promising a price. Speed of inclusion is the block rate. Speed of economic finality is not.

## What this page refuses

It does not rank a door as the winner and delete the others. The receipt, the vault, the door-only issuer, and the freeze token are four different promises. The interesting one for a company that is centralized today is the door-only note on Kaspa: miners order, the circulating note is bearer, the company is honest only at its own door, and the script is sealed so the company cannot grow a freeze later. The interesting one for a note with no company is the vault, and its quote key has to stay on the label. The freeze token is the one that already works as a dollar elsewhere. It can be sequenced here. It does not become decentralized by the change of chain.

On 2 Nov 2026 the vault door was exercised on the private devnet. Two holders redeemed. The quote key then changed the stored price with `refreshSolo`, and the next redeem paid the new price. That keeps the label honest: the vault can redeem, and the key is still on it. The coinbase split was not the path that redeemed. The door-only issuer was not built. The freeze was not built. The pages that follow do not pick one of these as the product.

Later the same day the same vault accepted a mint whose lock time was still inside the signed window, in a block timestamped after that window. Ordering worked. The miner included a valid transaction. The script's view of time is the lock time the signer wrote, so the late block was valid too. The quote key is still on the label. No door was closed by that result, and none was deleted.
