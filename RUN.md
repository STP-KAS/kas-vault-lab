# Desk commands

These commands are for this desk. They are not a public network, and they are not an invitation to run a miner.

## Model

No node and no key:

```
node --test model/issues.test.mjs model/doors.test.mjs model/position.test.mjs model/promise.test.mjs model/promise-pass.test.mjs
```

The handoff note recorded 52 passes before `model/promise-pass.test.mjs` existed. The morning of 4 Nov recorded 51. The handoff-integers note recorded 56. On 6 Nov 2026 the same command passed 57 tests. That count is in [The oracle he named](STUDY.md#the-oracle-he-named-6-nov-2026). Later the same day the same command passed 58 tests. That count is in [The brake and the haircut](STUDY.md#the-brake-and-the-haircut-6-nov-2026). A later run the same day passed 59 tests. That count is in [Home ASICs, asked on 6 Nov 2026](STUDY.md#home-asics-asked-on-6-nov-2026).

The desk compiler is `C:\Users\Remco\tools\silverc\silverc.exe`. Its SHA-256 is `2104b9792d9e6333afddc2f4300f502d3010ead052094696e66af1dfa947ac8e`, the Windows asset from SilverScript `v1-rc1` (30 Aug 2026). The sources say `pragma silverscript ^0.1.0`. The artifact field is `compiler_version` `0.1.0`. On 5 Nov 2026 the Windows asset from the `v1.0.0` release, SHA-256 `ce1e0ef5f1f415f371d3d2426e788597a388635da8cbe93e72e95a4f754b29af`, compiled `contracts/promise.sil`, `contracts/position.sil`, and `contracts/peg.sil` to the same bytecode. The drivers still call the desk binary. The v1.0.0 binary was not copied over it. `node script/devnet-promise.mjs --compile` prints the promise bytecode length and does not submit.

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

`node script/devnet-peg.mjs` is the 2 Nov desk driver. It talks only to `ws://127.0.0.1:17610` and mines only through `grpc://127.0.0.1:16610`. It refuses a public network argument. `--quote` reads the recorded second redeem. `--late` signs one mint, waits out that window, and submits the same bytes. `--live` reads the recorded reprice of covenant A and compiles `contracts/peg-2026-11-02.sil`. `--held` compiles `contracts/peg.sil`, opens a new vault, and rejects a refresh that would change the outstanding quote. `--next`, after that redeem, lets the key price the following note and reads the child coinbase. The keys and the oracle scalar stay out of git.

`node script/devnet-clock.mjs --again` reads the second DAA spend. It talks to the same half-split port and refuses a public network argument. A later `--again` prints the recorded row. It does not fund another clock, and it does not spend `peg.sil`.

`node script/devnet-position.mjs` talks to the same half-split port and refuses any other network. While its phase file says redeemed, it prints the recorded redeem and returns. `node script/devnet-position.mjs --compound` uses a second phase file. While that file says redeemed, it prints that redeem and returns. It does not open a third covenant, and it does not spend `peg.sil` or the clocks. The fee floor is 5000000 sompi. The picker asks for a coin that can cover 100000000 sompi, because a climbed fee of 10000000 does not fit in the 5735600 coin. A fee climb builds a new covenant binding on every attempt. A body at 2000000 was under the node's transient-mass minimum for this contract.

`node script/devnet-promise.mjs` talks to the same half-split port and refuses any other network. While its phase file says claimed, it prints the recorded claim and returns. It does not open another promise, and it does not spend `peg.sil`, `position.sil`, or the clocks. `--compile` prints the bytecode length and does not submit. The fee floor is 5000000 sompi.

`node script/devnet-promise-pass.mjs` talks to the same half-split port and refuses any other network. It compiles `contracts/promise-pass.sil`. While its own phase file says claimed, it prints the recorded claim and returns. It does not open another handoff, and it does not spend `promise.sil`, `peg.sil`, `position.sil`, or the clocks. `--compile` prints the bytecode length and does not submit. The fee floor is 5000000 sompi. The new bearer is the address that mines this devnet.

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
