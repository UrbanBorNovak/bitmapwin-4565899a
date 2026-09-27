# Introduce BITMAP Archaeology

## Goal
Turn the existing official trait catalogue into a community-led research layer. Each trait can surface up to three featured BITMAP discoveries, while keeping on-chain facts, community interpretation, and marketplace activity visibly separate.

## Experience
- Rename the catalogue framing from a plain trait index to **BITMAP Archaeology · Official Trait Index** without changing the official trait definitions.
- Add a compact archaeology introduction explaining that a BITMAP is studied through its block facts, inscription claim, provenance, and community field notes.
- Give every trait page an **Archaeological Record** section with three featured nominations.
- Each record shows the BITMAP, nomination thesis, evidence links, contributor attribution, verification state, and the existing route into the BITMAP record.
- Add a signed-in **Nominate a BITMAP** flow on every trait page. Signed-out visitors see a sign-in action instead.
- Keep listings and verified sales in their existing marketplace section; archaeological significance will never imply financial value.

## Community nomination model
- A nomination identifies one official trait and one indexed BITMAP, with a short research note and at least one evidence URL.
- The backend verifies that the BITMAP exists and, for currently supported traits, that its block height actually satisfies that trait before accepting the submission.
- New submissions begin as **Under Review**. Public trait pages show accepted records; contributors can also see their own pending or rejected submissions.
- Store a short review note and timestamps so decisions remain auditable.
- Limit one nomination per contributor, trait, and BITMAP; validate lengths and URLs; never expose account IDs publicly.
- Feature no more than three accepted discoveries per trait, ranked by review order. Empty categories honestly invite the first nomination instead of showing invented examples.

## Evidence language
Use three explicit labels:
- **CHAIN VERIFIED** — deterministic Bitcoin, inscription, or indexed trait fact.
- **COMMUNITY FIELD NOTE** — attributed interpretation supplied by a contributor.
- **UNDER REVIEW** — submitted evidence that has not been accepted.

Official-source and inscription links remain available. Unsupported official traits may receive research nominations, but they stay unverified and cannot receive **CHAIN VERIFIED** status until the required index data exists.

## Data and access
- Add an archaeology nominations table with trait, BITMAP height, inscription ID, thesis, evidence URL, contributor display identity, review status/note, featured position, and timestamps.
- Grant signed-in users submission and own-record access; grant public read access only to accepted records; retain privileged review access for service operations.
- Add safe public reads and authenticated submission reads/writes, with row-level rules and server-side validation.
- Add generated database typing for the new records.

## Technical details
- Extend the trait catalogue and trait detail pages rather than creating a separate top-level destination.
- Add focused archaeology data/query modules and a reusable record/nominator component.
- Record the evidence-tier and feature-limit decisions in `AGENTS.md`.
- Keep all new copy in the existing translation-ready patterns and preserve the terminal/cypherpunk visual system.

## Verification
- Confirm valid supported-trait nominations are accepted for review and mismatched traits are rejected.
- Confirm anonymous users cannot submit, users can see their own pending records, and the public sees accepted records only.
- Test empty, pending, accepted, rejected, and three-record-limit states.
- Check the catalogue and trait detail pages at desktop and mobile widths, including long evidence links and field notes.
- Verify route metadata, type safety, app health, and no horizontal overflow.
