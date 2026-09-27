# Official trait collections and holder status

## Build
- Add a public `/traits` catalogue sourced from the complete Bitmap.Community glossary. Each trait will show its official definition, verification status, indexed inscription count, marketplace usage, and links into a dedicated trait view.
- Add `/traits/$trait` detail pages with paginated real indexed BITMAP inscriptions, live listings, verified sale data already available to BITMAPWIN, and direct links to each BITMAP and inscription. Traits that cannot yet be proven from the local on-chain fields will remain visible but clearly show `INDEX DATA REQUIRED` instead of invented matches.
- Link the trait catalogue from Collections and the Marketplace glossary; preserve the existing official-trait filter for traits that are currently verifiable.

## Trait extender pool
- Build an `OFFICIAL TRAITS` PLAY visual pool from the real inscription IDs of indexed BITMAPs whose traits are verifiable. Selecting it distributes those inscriptions deterministically across living cards, following the existing JIGGLYPUFF pool behavior.
- Keep the pool on-chain-only: no placeholder or synthetic inscription IDs.

## Holder ribbon and trading badge
- Add an authenticated claim/check that proves the verified wallet controls at least one indexed BITMAP carrying a supported official trait, using current on-chain ownership rather than a browser claim.
- Reuse the shared membership ribbon for successful holders and persist a renewable, time-limited proof so public profile ribbons remain trustworthy after ownership changes.
- Add a distinct `TRAIT HOLDER` badge to marketplace cards/listings owned by a currently verified trait holder, backed by public-safe badge data rather than client storage.
- Extend the Membership panel with an official-trait holder claim and clear success/no-match/unavailable states.

## Data and security
- Add the minimum holder-proof fields/table needed to distinguish JIGGLYPUFF, donation, and official-trait membership sources, with explicit grants and row-level policies.
- Perform ownership checks and privileged badge writes server-side; expose only public badge status and trait labels.

## Verification
- Check catalogue, trait detail, Marketplace, Membership, Profile, and PLAY extender flows on desktop and mobile.
- Confirm empty/unavailable states never imply unsupported traits are verified, and confirm the preview build and relevant runtime checks pass.
