# Verified Sovereign Passport

## Goal
Turn `/passport` into the definitive identity record for the signed-in holder, using only verified wallet proof, indexed BITMAP ownership, and persisted BitmapWin activity.

## Build
- Make wallet verification explicit and authoritative throughout the Passport; a connected but unsigned wallet will never appear verified.
- Present the sovereign artifact with evidence status, verified address fingerprint, BITMAP holdings, stamps, capabilities, and provenance totals.
- Keep the advanced evidence layout while clarifying loading, unavailable, empty, and unverified states so missing data is never shown as zero proof.
- Populate estate and history sections from existing live records: indexed land, builds, visits, published blueprints, deployments, trades, leases, and Oasis activity.
- Preserve inspectable evidence links to BITMAP pages, the Oasis, Studio, club seals, and the World Stream.

## Technical details
- Reuse the authenticated Passport and estate server functions; no mock rows or inferred blockchain claims.
- Harden wallet selection to use verified `wallet_links` records only and surface partial query failures without exposing raw errors.
- Keep the existing Passport visual system, mobile behavior, multilingual conventions, and unique route metadata.
- Verify signed-out and signed-in rendering, wallet status, page overflow, browser errors, and the current build signal.
