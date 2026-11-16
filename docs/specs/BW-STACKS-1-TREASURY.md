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
- [x] Deployed on testnet as `ST2P0SD4JPHFKJ42DDH2VQVS59P7XJFYC4K8NHGWR.bw-stake-pilot-v2` (2026-11-16, burn 39283); treasury stand-in is the 2-of-3 testnet multisig `SN38Y8C9FJ7J624BJJK7ZY5HBN790X6646M3XB25X` (keys derived from the testnet admin seed, so not independent signers).
- [x] On-chain drill (drill limits: 50,000 per call, 2-block periods, 60,000 per period, 100,000 pool):
  stranger `fund` u401 (0x21d3f0d3…), pause-only key `unpause` u401 (0x0c1d9b75…) and `set-funding` u401 (0x5be8a033…);
  50,001 u411 (0x62c6406f…); 50,000 ok (0xeb05edab…); +10,000 ok, period full at 60,000 (0x0a24cb41…); +1 u411 (0xd3fa3fb1…);
  unsolicited 5,000 transfer ok, pool-held stayed 60,000 while the balance read 65,000 (0xa0f000ea…);
  next period: 40,001 u411 on pool cap (0x8a277d0c…); 40,000 ok, pool-held exactly 100,000 (0x9ab48ceb…); +1 u411 though the period had room (0x172e84d0…).
- [x] Pilot limits then set to 50,000 per call, 144-block periods, 100,000 per period, 250,000 pool (0x85423cee…). The watchdog reconciled the result with no suspicious findings.
- [ ] External audit covers the above.

## 7. Launch checklist

- [ ] L1 and Stacks multisigs created; addresses published.
- [ ] Caps decided and published.
- [ ] Contract guard (§6) deployed and audited.
- [ ] Watchdog knows the treasury principal and caps.
- [ ] One small dry-run tranche end-to-end on testnet, then mainnet.
- [ ] Explicit reviewed switch to enable mainnet rewards.
