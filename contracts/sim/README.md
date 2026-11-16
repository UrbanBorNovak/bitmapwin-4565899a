# BW-STACKS-1 simulator

Runs ../bitmap-sbtc-stake.clar in the Clarinet simnet against a mock sBTC token.
Uses public devnet test mnemonics only.

```sh
cd contracts/sim && npm i @hirosystems/clarinet-sdk @stacks/transactions
sed "s#'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token#.mock-sbtc#g" ../bitmap-sbtc-stake.clar > contracts/stake.clar
node sim.mjs
```
