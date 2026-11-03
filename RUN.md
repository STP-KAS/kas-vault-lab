# Desk commands

These commands are for this desk. They are not a public network, and they are not an invitation to run a miner.

## Model

No node and no key:

```
node --test model/issues.test.mjs model/doors.test.mjs model/position.test.mjs
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

`node script/devnet-peg.mjs` is the 2 Nov desk driver. It talks only to `ws://127.0.0.1:17610` and mines only through `grpc://127.0.0.1:16610`. It refuses a public network argument. `--quote` reads the recorded second redeem. `--late` signs one mint, waits out that window, and submits the same bytes. `--live` reads the recorded reprice of covenant A and compiles `contracts/peg-2026-11-02.sil`. `--held` compiles `contracts/peg.sil`, opens a new vault, and rejects a refresh that would change the outstanding quote. `--next`, after that redeem, lets the key price the following note and reads the child coinbase. The keys and the oracle scalar stay out of git.

`node script/devnet-clock.mjs --again` reads the second DAA spend. It talks to the same half-split port and refuses a public network argument. A later `--again` prints the recorded row. It does not fund another clock, and it does not spend `peg.sil`.

`node script/devnet-position.mjs` talks to the same half-split port and refuses any other network. While its phase file says redeemed, it prints the recorded redeem and returns. `node script/devnet-position.mjs --compound` uses a second phase file. While that file says redeemed, it prints that redeem and returns. It does not open a third covenant, and it does not spend `peg.sil` or the clocks. The fee floor is 5000000 sompi. The picker asks for a coin that can cover 100000000 sompi, because a climbed fee of 10000000 does not fit in the 5735600 coin. A fee climb builds a new covenant binding on every attempt. A body at 2000000 was under the node's transient-mass minimum for this contract.

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
