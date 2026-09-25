# Whole-product beta preparation

## What will change
- Run a release gate across the Marketplace, Oasis, PLAY, Passport, rankings, Studio, wallet, and sign-in journeys on desktop and mobile.
- Fix concrete broken interactions, layout problems, loading failures, console errors, and confusing dead ends found during testing.
- Tighten first-use guidance so a new tester can enter the Oasis, find a BITMAP, start PLAY, and establish identity without guessing.
- Run fresh application and dependency security checks; fix release-blocking issues that can be safely corrected without changing intended public data.
- Add concise beta release notes and visibly update the product status from alpha to beta.
- Re-test the main journeys, confirm the latest build, then request publication to the existing public site.

## Release gate
- No unresolved build or runtime errors in tested journeys.
- No broken primary navigation or missing destination pages.
- Desktop and phone layouts remain usable without horizontal overflow.
- Empty, loading, disconnected-wallet, and unsigned-in states provide a clear next action.
- Security findings previously approved as intentional public access remain untouched.
- Any unresolved high-risk dependency or security blocker is reported before publication.

## Technical details
- Preserve the existing terminal/cypherpunk design, semantic tokens, multilingual layer, on-chain-only data rule, and BITMAP terminology.
- Prefer focused fixes over broad redesigns or feature additions.
- Validate with targeted tests, type checks, preview diagnostics, and browser-driven journey checks.
