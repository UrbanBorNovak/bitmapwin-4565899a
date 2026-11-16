# BW-STACKS-1-BRIDGE · sBTC bridge notes for the mainnet rollout

Status: draft notes. Nothing here is live. Mainnet rewards stay disabled until this rollout is reviewed and approved.
Reference: official sBTC web bridge, https://github.com/stacks-sbtc/sbtc-bridge (docs: https://docs.stacks.co/concepts/sbtc).

## Scope

- `/soft-stake` stays a testnet-only pilot focused on claiming test tokens.
- BitmapWin does not run, fork or proxy the bridge. Holders use the official bridge or their wallet.
- The BITMAP never moves. The oracle signs only custody attestations and never holds or controls pool sBTC.

## Flow

```text
Bitcoin L1 (BTC)
  treasury BTC --deposit--> sBTC signers --mint--> sBTC on Stacks
                                                     |
                          fund-pool (contract call)  v
                                    bw-stake (mainnet vault)
                                                     |
                          claim (holder, attested weight)
                                                     v
                                    holder Stacks wallet (sBTC)
                                                     |
                          withdraw via official bridge / wallet
                                                     v
                                    holder Bitcoin address (BTC)
```

## 1. Funding the pool (BTC -> sBTC)

1. Treasury makes an sBTC deposit on Bitcoin L1 using the official bridge (deposit to the signer aggregate key, Stacks recipient in the deposit data).
2. Signers confirm the deposit and mint sBTC to the treasury Stacks address.
3. Treasury calls `fund-pool` on the vault. Rewards are paid only from sBTC actually in the pool; no pre-mined or promised rewards.
4. Each funding is recorded with its Bitcoin txid, Stacks txid and amount, and must be checkable on public explorers.

Open: mint directly to the vault vs. treasury address first. Default: treasury first, then `fund-pool`, so the vault only ever receives through its own entry point.

## 2. Holder exit (sBTC -> BTC)

- After a successful claim, the claim card links to the official bridge withdraw page. No in-app peg-out at launch.
- Copy states plainly: withdrawals are handled by the sBTC signer network, not BitmapWin; a minimum amount and Bitcoin fees apply; settlement takes several Bitcoin confirmations.
- Never show an amount below the bridge's current withdraw minimum as "withdrawable".

## 3. Values read live, never hardcoded

Read from the official bridge configuration / Emily API at rollout time:

| Value | Source |
|---|---|
| sBTC token contract (mainnet deployer) | bridge config `SBTC_CONTRACT_DEPLOYER` |
| Withdraw minimum (sats) | `WITHDRAW_MIN_AMOUNT_SATS` |
| Deposit / withdraw limits | Emily limits endpoint |
| Signer aggregate key | bridge `get-aggregate-key` |
| Reclaim lock time | `RECLAIM_LOCK_TIME` |

## 4. Safety rules

- Watchdog (already on testnet) extends to mainnet: also compares vault sBTC balance with recorded fundings minus claims; any mismatch pauses the vault.
- Separate pause-only key before mainnet (testnet still uses the admin wallet).
- Oracle key in non-exportable KMS on mainnet (see BW-STACKS-1-ORACLE.md).
- Contract audit and Clarinet tests against the real mainnet sBTC token before launch.
- Mainnet switch is an explicit config change, reviewed by the team; the UI keeps "Mainnet rewards off" until then.

## 5. Rollout checklist

- [ ] Testnet: real wallet sign + claim with a real BITMAP holder
- [ ] Pause-only key deployed and drilled
- [ ] Watchdog balance reconciliation added
- [ ] Vault audited against mainnet sBTC token
- [ ] First treasury funding done and published with txids
- [ ] Claim card links to official bridge withdraw page
- [ ] Mainnet enabled by reviewed config change
