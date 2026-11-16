# BW-STACKS-1-TREASURY — Multi-sig treasury funding rules (draft)

Status: draft. Nothing here is live. Mainnet rewards stay disabled; /soft-stake remains testnet-only.
Companion specs: BW-STACKS-1.md (vault), BW-STACKS-1-ORACLE.md (keys, watchdog), BW-STACKS-1-BRIDGE.md (sBTC peg).

## 1. Flow

```text
Bitcoin L1 treasury (2-of-3 Taproot multisig)
   │ peg-in deposit via the official sBTC bridge (recipient = Stacks treasury)
   ▼
sBTC signer network mints 1:1 SIP-010 sBTC
   ▼
Stacks treasury (2-of-3 multisig principal)
   │ capped `fund` call, one per reward epoch
   ▼
Rewards vault contract → holders claim
```

## 2. Signers

| Key | Holder | Storage | Used for |
|---|---|---|---|
| A | Core signer | Offline hardware wallet | L1 + Stacks treasury |
| B | Second signer, different location | Offline hardware wallet | L1 + Stacks treasury |
| C | Recovery | Sealed hardware wallet; also a timelocked recovery leaf on L1 | Replacing a lost key only |

- Threshold 2-of-3 on both chains. No treasury key ever touches the BitmapWin servers.
- The server holds only the oracle key (custody attestations) and the pause-only key. Neither can move treasury funds.
- Signer changes need a fresh multisig, a 2-of-3 move of all funds, and a public note listing old/new addresses.

## 3. Funding rules

1. **Epoch tranches.** Fund once per reward epoch, never a lump sum for several epochs.
2. **Caps.** Per-call and pool-balance caps are set before launch and published; a tranche above the cap is not signed.
3. **Reserve stays cold.** The vault only holds the current epoch's tranche plus unclaimed rewards; everything else stays in the L1 treasury.
4. **Paper trail.** Every tranche is published with: L1 deposit txid, sBTC mint txid, Stacks `fund` txid, amount, epoch.
5. **Two-person check.** The second signer independently checks amount, recipient and epoch from the explorer before co-signing.
6. **No funding while paused.** The contract already refuses `fund` while paused; signers also stop until an incident is closed.

## 4. Runbook (per epoch)

1. Draft the L1 peg-in (amount, bridge deposit address and recipient read live from the bridge, never hardcoded). Sign 2-of-3, broadcast.
2. Wait for the bridge mint; confirm the sBTC balance on the Stacks treasury.
3. Build `fund(amount)` from the treasury; sign 2-of-3, broadcast.
4. Watchdog reconciles: new balance must equal previous expected + amount, from the treasury principal.
5. Publish the paper-trail entry.

## 5. Watchdog extensions for mainnet

- `fund` from any principal other than the Stacks treasury: flagged (on mainnet, suspicious until the contract restricts it).
- A tranche above the published cap: suspicious → pause.
- Existing rules continue: pool mismatch, non-payout outflow, wrong claim recipient, unlogged attestation, unreviewed admin call.

## 6. Contract funding guard (draft contract, simulated)

contracts/bitmap-sbtc-stake.clar now enforces:

- [x] `fund` only from the `funder` principal (the Stacks treasury multisig), set by admin via `set-funding`. Others get u401.
- [x] Caps per call, per reward period, and on the reward-pool balance (u411), matching §3. The period length is set by the admin in `set-funding` (must be > 0). All caps start at 0, so funding is off until the admin sets them.
- [x] The pool cap checks `pool-held` (funded minus paid out) after the new tranche; payouts free room again. Lifetime funding is still reported (`funded-total`) but not capped.
- [x] `print` event with amount, period, running total and epoch on each `fund`.
- [x] Tokens sent outside `fund` are never shared out and never count toward caps.
- [x] Simulator: wrong funder, pause-only key and strangers refused; each cap passes at exactly its limit and refuses one sat more; period allowance resets in the next period; payouts reopen pool room; refused calls move nothing.
- [ ] The deployed testnet pilot (bw-stake-pilot-v1) predates this guard; a new version must be deployed to use it.
- [ ] External audit covers the above.

## 7. Launch checklist

- [ ] L1 and Stacks multisigs created; addresses published.
- [ ] Caps decided and published.
- [ ] Contract guard (§6) deployed and audited.
- [ ] Watchdog knows the treasury principal and caps.
- [ ] One small dry-run tranche end-to-end on testnet, then mainnet.
- [ ] Explicit reviewed switch to enable mainnet rewards.
