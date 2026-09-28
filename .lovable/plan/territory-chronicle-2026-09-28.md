# Territory Chronicle

## Goal
Give every BITMAP a durable, evidence-backed Chronicle showing what was built there, how many people visited, and which Extenders were installed. Connect owned BITMAP chronicles back into Passport.

## What will change
- Add a Territory Chronicle panel to each BITMAP page with:
  - build publication/update records
  - Extender install/deployment records
  - aggregate total and unique visitor counts
  - a chronological event feed using real stored timestamps only
- Keep visitor privacy intact: show counts, not visitor identities.
- Add a Passport section listing the signed-in holder’s BITMAPs with Chronicle totals and direct links to each BITMAP’s Chronicle.
- Use clear empty, loading, and unavailable states so missing records are never presented as zero-confidence history.

## Data and security
- Read existing public build pages, active deployment history, and public visitor aggregates.
- Add a narrowly scoped public Chronicle query only if the current policies cannot expose historical install records safely.
- Do not invent or backfill events. Existing timestamps define the visible record; future changes appear automatically through the same sources.
- Preserve row-level security and expose no wallet-linked visitor details.

## Verification
- Check a BITMAP with a published build/deployment and one without activity.
- Check Passport while signed in and confirm owned BITMAP links open the correct Chronicle anchor.
- Verify desktop and mobile layouts, navigation, loading states, and error-free preview output.
