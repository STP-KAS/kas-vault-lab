# kas-vault-lab

Experimental only. Not Kaspa Dollar. Not a product. Not money. Not an endorsement of a mined dollar.

A covenant can lock test Kaspa and account a worthless note. Hashrate secures that record. The note is backed by the locked sompi, and only while a quote says those sompi cover the debt. Electricity is not a balance anyone can redeem.

## Read in this order

| File | What it is |
| --- | --- |
| [ISSUES.md](ISSUES.md) | Each hard question, and whether the code answers it |
| [STUDY.md](STUDY.md) | The 1 Nov 2026 study, including why home ASICs are not part of the test |
| [DOORS.md](DOORS.md) | Ordering versus the issuer's key. Every door kept. Decentralization is the measure |
| [contracts/vault.sil](contracts/vault.sil) | The 27 Oct vault. Unchanged rules: one lineage, owner mint, liquidation |
| [contracts/peg.sil](contracts/peg.sil) | Holder redeem at the stored quote. Mint still needs a fresh signature |
| [model/issues.mjs](model/issues.mjs) | The integer checks for the questions a script cannot see |
| [DESIGN.md](DESIGN.md) | Covenant rules, specs, and what the debugger showed |
| [LIMITS.md](LIMITS.md) | What is still not a stablecoin |
| [ECONOMICS.md](ECONOMICS.md) | How this differs from the square's receipts |
| [PROPOSALS.md](PROPOSALS.md) | Sentences for the square. This repo does not patch that tree |
| [RESULTS.md](RESULTS.md) | What was and was not submitted. No peg txid. A short CPU sample mined ordinary tKAS. A later private devnet paid KAS and a locked STP face |

## Run

Issues model, no node and no key:

```
node --test model/issues.test.mjs model/doors.test.mjs
```

Compile the peg contract. The JSON artifact is gitignored, same as `vault.json`.

```
silverc contracts/peg.sil --constructor-args contracts/peg.args.json -o contracts/peg.json
```

The 27 Oct debugger runs, when `cli-debugger` is on the machine:

```
cli-debugger contracts/ratio.sil --run-all
cli-debugger contracts/vault.sil --run-all
```

`node script/tn10.mjs health` and `node script/tn10.mjs run` belong to the 27 Oct driver. They talk to Testnet-10. They do not submit `peg.sil`.

## The 27 Oct lab

TN10 learning lab. A covenant locks test Kaspa and lets its owner mint and burn a test token named tUSD-TEST. The token is worthless. This is not a stablecoin, not a product, and not money.

The covenant is SilverScript. The local compiler artifact reports `compiler_version` 0.1.0. Tests run in `cli-debugger`. The chain driver uses the Kaspa wasm module named by `KASPA_WASM` and the compiler named by `SILVERC`.

```
cli-debugger contracts/ratio.sil --run-all
cli-debugger contracts/vault.sil --run-all
node script/tn10.mjs health
node script/tn10.mjs run
```

`node script/tn10.mjs run` creates fresh testnet-10 keys under `.local/`, asks a public faucet for tKAS, and writes txids to `results/`. Those directories are gitignored. The driver prints addresses and txids. It does not print private keys.

Read `DESIGN.md` for the covenant rules, `ECONOMICS.md` and `PROPOSALS.md` for the square, `LIMITS.md` for what this cannot be, and `RESULTS.md` for what the node accepted.
