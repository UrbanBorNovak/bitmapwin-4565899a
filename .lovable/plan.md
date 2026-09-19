# BitmapWin — Passport, Stream, and Provenance Loop

Build the product around one continuous loop:

```text
DISCOVER → EXPLORE → PARTICIPATE → LEAVE PROVENANCE
    → RECEIVE STAMP → UNLOCK → BUILD → CREATE HISTORY → RETURN
```

The Marketplace remains where assets move. The Oasis remains where actions happen. The Passport becomes the portable record of those actions. The Stream makes verified history visible and gives people a reason to return.

## What will change

### 1. Make the loop visible across the product
- Replace the narrow OASIS → EXTEND → DEPLOY rail with a reusable loop navigator that shows the current stage and the next meaningful action.
- Put compact versions on Home, Explore, the Oasis entry, BITMAP pages, Passport, Stream, My World, and build/create surfaces.
- Reframe the home page around live world activity and the full loop—not marketplace statistics alone—while preserving all existing routes and functionality.
- Reorganize navigation so **Discover**, **Oasis**, **Stream**, **Passport**, **Build**, and **Market** are clear first-class destinations. Existing tools remain available in the grouped menus.

### 2. Add a real Passport
- Add `/passport` as the signed-in player’s history home, with:
  - identity and verified wallet;
  - participation summary;
  - earned stamps with evidence links;
  - unlocked build capabilities;
  - recent personal provenance;
  - the next possible action based on actual missing history.
- Add a compact public Passport section to `/profile/$address`, showing public stamps and verified history without exposing private account data.
- Add Passport summaries to the dashboard and in-world identity panel.

### 3. Issue evidence-backed app-record stamps
Initial stamps will be awarded only when server-side records prove the event:
- **First Arrival** — a verified wallet visited a BITMAP.
- **World Walker** — visited distinct BITMAPs.
- **First Mark** — placed a persistent structure.
- **Builder** — built on multiple BITMAPs or maintained several persistent structures.
- **Land Steward** — held a BITMAP and created persistent history on it.
- **Deployer** — activated an Extender on a BITMAP.
- **Participant** — joined a recorded event, lease, clan action, or confirmed trade.
- **Historian** — accumulated several different categories of verified provenance.

Each stamp stores its evidence source, time, wallet, BITMAP when relevant, and issuing rule version. Stamps are app records in this release; the schema leaves room for a future inscription ID without presenting them as on-chain today.

### 4. Add the Stream
- Add `/stream` as a live, filterable history feed built from real records: visits, persistent builds, deployments, confirmed trades, leases, events, clan milestones, combat, donations, and stamps.
- Every item identifies its proof level: **CHAIN**, **WORLD**, or **ACCOUNT**, links to the relevant BITMAP/profile/transaction, and never fabricates a person, price, or event.
- Add a personal Stream view inside Passport and a world pulse section on Explore.
- Use pagination and stable event IDs so the feed scales without repeatedly joining every source table in the browser.

### 5. Make stamps unlock possibilities
The first unlock family is **build capabilities**, not cosmetic badge accumulation.
- Existing build abilities remain available; nobody loses current functionality.
- New multi-part blueprints made from existing Oasis structures unlock through verified history.
- The build menu shows locked blueprints with the exact history requirement and evidence progress.
- Build placement checks the capability on the server as well as in the interface.
- The Passport explains what each earned history record now makes possible and points directly to Build.

Initial progression:
- First Arrival → unlock a **Trail Marker** blueprint.
- First Mark → unlock an **Oasis Waystation** blueprint.
- Builder → unlock a **Fortified Camp** blueprint.
- Land Steward or Deployer → unlock a **District Gate** blueprint.

### 6. Connect provenance end to end
- Successful persistent visits, builds, deployments, leases, confirmed trades, event participation, combat, and qualifying social actions append a normalized provenance event.
- Stamp evaluation is idempotent and server-controlled; reloading or repeating the same source cannot duplicate a stamp.
- BITMAP pages gain a concise **History Created Here** stream alongside the existing asset provenance and development history.
- Personal Passport history links back to the source BITMAP, build, deployment, trade, or world event.

## Data and security

Add three tables through one reviewed migration, each with explicit grants and row-level security:
- `provenance_events` — append-only normalized events with actor, wallet, BITMAP, source record, proof level, metadata, visibility, and timestamp.
- `passport_stamps` — immutable earned stamps tied to a user and verified wallet, unique per rule/evidence as appropriate.
- `passport_unlocks` — server-granted capability keys with the stamp/evidence that enabled them.

Security rules:
- Public Stream reads only public, non-sensitive event fields.
- A signed-in user can read their complete Passport; public profiles receive only public stamps/history.
- Browser code cannot award stamps or unlocks directly.
- Authenticated server functions verify the user and linked wallet, derive eligibility from authoritative tables, and write through privileged server-only helpers.
- Build placement verifies required capability server-side.
- No rewards are based on client-only inventory or local browser state.

## Technical implementation

- Add `src/lib/passport.ts`, `passport.functions.ts`, and `passport.server.ts` for typed reads, evidence evaluation, stamp issuance, and unlock checks.
- Add `src/lib/provenance-stream.ts` for public and personal feed queries.
- Add focused UI components for the loop navigator, Passport summary, stamp evidence, unlock path, and Stream event rows.
- Add routes `/passport` and `/stream`, each with complete route-specific metadata.
- Wire event creation into existing successful server-side write paths rather than trusting client callbacks.
- Extend the build template model with optional capability requirements and pass verified unlocks into the in-world build menu.
- Keep all new user-facing labels inside the existing translation layer and preserve the current terminal/Oasis visual system.

## Validation

- Verify stamp issuance is idempotent and impossible from an unlinked wallet.
- Verify public/private Stream visibility and row-level policies.
- Verify each new blueprint is hidden or locked until its capability is earned, then placeable after issuance.
- Verify existing structures, persistence, economy, marketplace, quality settings, combat, and mobile controls remain unchanged.
- Test Home, Explore, Stream, Passport, public profile, BITMAP history, and Oasis build menu on desktop and phone with no horizontal overflow.
- Run focused tests, type checks, build checks, and a security scan after the migration.

## Boundaries

- No on-chain stamp inscription flow in this release.
- No invented historical backfill: existing authoritative records may qualify; missing evidence remains missing.
- No BIT rewards merely for collecting stamps.
- No existing capability is removed or retroactively locked.
