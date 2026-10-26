# Limits

tUSD-TEST is a test token on TN10. It has no issuer reserve, no dollar account, and no redemption into anything but the sompi this one vault already holds. The script can be solvent at a signed price and still not be a stablecoin.

## Oracle

The price is a signature from a key this lab generated. The node checks the signature and the lock-time window. It does not check a market. A signer who publishes a low price can make a healthy vault liquidatable. A signer who publishes a high price can block a liquidation that a real market would allow. There is no committee, no median, and no delay beyond the one-hour window.

## The stale-price hole

The script requires the transaction lock time to sit inside the signed window, and the window is at most one hour in unix milliseconds. Consensus does something weaker. A time lock time is valid once median time is past it. A transaction whose lock time was inside the window can be mined later. A transaction can also set its lock time to an old expiry, after median time is already past that expiry, and still be final. The debugger rejects a lock time that is already above the expiry carried in the same transaction. It cannot reject the delayed-mining case. This lab does not claim that case is closed.

Unix seconds are the wrong unit on this consensus. `LOCK_TIME_THRESHOLD` in rusty-kaspa `a41a333` is 500,000,000,000. Below that, the lock time is a DAA score. A 2026 unix-second value is below the threshold. The driver uses milliseconds and refuses to build a window that would be read as DAA.

## Peg

Minting at 200% and burning to withdraw keeps one vault overcollateralized at the signed price. It does not keep a token at one dollar when KAS moves and the signer has not published a new price. It does not let a stranger redeem. Two vaults do not share a float. A run on "the stablecoin" is not a state this script has.

The square's OLAF, KUSD, and SquarePeg locks are receipts of sompi at an old quote. They have the same peg limit, for a different reason: the sompi are fixed, so the dollar face moves. `ECONOMICS.md` separates those receipts from this vault.

## Governance

There is no admin key that can change the ratio, the oracle, or the debt. The parameters are constructor state. Replacing them means spending to a successor the current script rejects, which the node will not mine. That is also a limit: a mistake in the oracle key or the ratios is permanent for that lineage. Seal exists so a sloppy genesis cannot mint. It is not a government.

There is no freeze. There is no blacklist. The oracle trust above is the power a signer actually has.

## KCC-20

The field prefix matches Final KCC-20, and this vault's cents are conserved between its debt and its one note. The program rejects borrow schemes `0x01` to `0x03` and every owner scheme except `0x00`. It has no standard transfer entry. KCC-20 says a conforming program must support the enabled borrow schemes. This one does not. A wallet that only speaks KCC-20 will not move the note.

## What a passing TN10 test does not show

A transaction id shows that one node accepted one shape, or rejected it. It does not show that every backend in the public pool would agree. The REST health `p2pId` changed between reads on 26 Oct 2026. `RESULTS.md` lists the id that answered each sample.

A local debugger pass shows the script's `require` lines. It does not show mempool policy, fee, or median time. The owner signature and the real oracle signature are checked on TN10 for the cases that need them.

No mainnet coin moves. The keys under `.local/` are testnet keys. The fixture scalar 1 is not a wallet.
