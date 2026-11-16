# BW-STACKS-1 · BITMAP soft-stake for sBTC (draft)

Status: draft. Contract not deployed or audited. No UI ships until it is.

## What is proven where
- **Bitcoin L1 (chain fact):** the BITMAP inscription sits unspent at the holder's Taproot address. It never moves.
- **BIP-322 (holder proof):** holder signs `bindingMessage()` (src/lib/stacks-softstake.ts) linking `bc1p…` to a Stacks address. Valid 10 minutes.
- **Oracle (app trust):** BitmapWin checks live custody + holder epoch + slab grade, then signs `(height, stx owner, weight, issued burn height)`. Stacks cannot read Ordinals, so this signer is the trust anchor.
- **Clarity (contract fact):** `contracts/bitmap-sbtc-stake.clar` accrues sBTC per weight only while the attestation is ≤144 blocks old. Holder must re-attest daily; stale stakes can be evicted by anyone. Selling the BITMAP means the oracle stops attesting, so rewards stop within a day.

## Rewards
Only sBTC actually deposited through `fund` is paid (revenue share, sponsor). No emissions, no promised yield.

## Weight
`floor((1 + min(daysHeld, 1460)) × grade / 5)`, ungraded = grade 5.

## Open before launch
Oracle key custody, audit, testnet deploy, legal review of revenue sharing.
