# BW-STACKS-1 simulator

Runs ../bitmap-sbtc-stake.clar in the Clarinet simnet against a mock sBTC token.
Uses public devnet test mnemonics only.

```sh
cd contracts/sim && npm i @hirosystems/clarinet-sdk @stacks/transactions
sed "s#'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token#.mock-sbtc#g" ../bitmap-sbtc-stake.clar > contracts/stake.clar
node sim.mjs
```

## Testnet pilot deployment (done 2026-11-16)
- `ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc` - test token, anyone may mint ≤1,000,000 per call.
- `ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-stake-pilot-v1` - first vault (no funding guard). Retired; the app no longer uses it.
- `ST2P0SD4JPHFKJ42DDH2VQVS59P7XJFYC4K8NHGWR.bw-stake-pilot-v2` - current vault with treasury-only funding and per-call / reward-period / pool caps. Deployed by the admin. Treasury = 2-of-3 testnet multisig `SN38Y8C9FJ7J624BJJK7ZY5HBN790X6646M3XB25X`. `ops-v2/` holds the deploy and on-chain drill scripts (keys come from env secrets only).
- Oracle key epoch 1 = the public key served by `/api/public/stake-pilot`. Admin = the project's derived admin address; pauser = a separate pause-only key (both shown by the same endpoint). The admin is not on the pauser list. The deployer key was throwaway and holds no role.
- `deploy-testnet.mjs` reproduces it (`DEPLOYER_KEY_FILE=... node deploy-testnet.mjs deploy|config`). Mainnet is never a target.
