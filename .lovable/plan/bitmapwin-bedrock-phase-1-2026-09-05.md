# BITMAPWIN — Bedrock Phase 1

Turn the existing app into the substrate layer: land as deployment surface, Extenders as first-class packages, a marketplace that feels like an app store for a permanent Bitcoin world. Nothing existing gets removed — the map, marketplace, builds, models, leases, avatars, combat and wallet flows all stay exactly as they work today.

## What you'll see when this is done

- A new home page that says what BitmapWin is: build on permanent Bitcoin land. Clear paths to Explore World / Build / Marketplace / Become a Builder.
- A new **Extenders** section: browse packages by category (Games, Combat, World Systems, Economy, RPG, Vehicles, Cities, AI Built, Developer Tools, Art, Construction), each with creator, version, dependencies, permissions, installs and update history.
- An **Extender Studio** page where a creator registers a package, adds versions, declares dependencies and permissions, and publishes it. Real records, real ownership checks. The AI-generation workflow is shown as a labelled plan-only pipeline (PLAN → DEPENDENCIES → GENERATE → SANDBOX → TEST → PUBLISH), marked COMING SOON — no faked generation.
- A tile panel on the map and on each BITMAP page that reads like territory: owner, district, buildings, active extenders, lease status, visitors, history, plus BUILD / EXTEND / ENTER / LEASE / MARKET / HISTORY actions.
- **My World**: one owner dashboard tab set for land, buildings, extenders, deployments, leases, revenue, visitors.
- **Builder profiles** extended with creator level, published extenders, installs, and FOLLOW / HIRE / VIEW actions.
- A **SDK** page documenting the world primitives (land, build, player, world, economy, social, AI) with the parts that exist today marked LIVE and the rest COMING SOON.
- Map UX pass: search and coordinate jump, "jump to my land", filters (developed / undeveloped / leased / has experience / trending), district boundaries, and visual distinction between developed and empty land.

Every surface labels its data: LIVE, MOCK, or COMING SOON. No invented owners, prices, ratings or history.

## Data model (backend)

New tables, all with grants + RLS, all machine-readable so an agent can use them later:

- `extenders` — id, slug, name, summary, description, category, creator_address, creator_user_id, tags, icon/preview inscription ids, status (draft/published/archived), is_ai_built, license, monetization (free/paid/lease), price_sats, created/updated.
- `extender_versions` — extender_id, semver, sdk_version, changelog, manifest (jsonb: assets, systems, config schema, entry points), status, published_at.
- `extender_dependencies` — version_id, depends_on_extender_id, version_range.
- `extender_permissions` — version_id, permission (view/enter/build/edit/deploy/manage/lease/monetize), reason.
- `extender_deployments` — extender_version_id, bitmap_height, deployed_by, granted_via (owner/lease/permission), config jsonb, status, active window. This is what makes land a deployment surface.
- `land_grants` — bitmap_height, owner_address, grantee (address or user), permissions[], expires_at. Lets an owner authorise a builder without transferring land; reuses the existing wallet-link + live-ownership checks.
- `extender_installs` — install/usage counts driven by real deployment and visit events, not seeded numbers.
- `cities` — name, slug, banner, description, founder, treasury placeholder; `city_bitmaps` membership. Foundation and UI language only, no governance.

Ratings/reviews are deferred to Phase 2 rather than shipped empty-with-fake-stars.

Authorisation follows the existing pattern: reads are public for published rows, writes go through server functions that verify the caller's wallet link and live chain ownership (same path `bitmap_models` placement already uses). Nothing bypasses that.

## Technical notes

- New routes: `/extenders`, `/extenders/$slug`, `/studio`, `/studio/$slug`, `/sdk`, `/my-world`, `/cities` (+ `/cities/$slug`). Existing routes keep their paths so published URLs stay valid; `/marketplace` gains an ecosystem tab bar (Assets · Extenders · Experiences · Builders) rather than being replaced.
- Server functions in `src/lib/extenders.functions.ts` + `extenders.server.ts`, queries in `src/lib/extenders.ts`, mirroring the existing `.functions/.server/.ts` split. Ownership checks reuse `can_build_bitmap` / wallet-link helpers.
- Tile panel work is a presentation refactor of the existing selected-BITMAP window in `BitmapWorld3D.tsx` plus `bitmap.$block.tsx` — the 3D renderer, movement, combat and model loading are untouched.
- Map filters/search sit on top of existing `map_owners` / `map_bitmap_models` window RPCs, extended with a deployment window RPC.
- SDK page documents a typed `src/lib/sdk/` surface derived from existing helpers so Phase 3 can expose it for real; no new engine.
- Design stays monochrome + Bitcoin orange, terminal typography, no gradients in 2D. Copy uses BITMAP, and all new labels go through the existing translation layer.

## Out of scope this phase

Extender execution sandbox, AI generation backend, revenue sharing payouts, city governance, ratings. Each appears in the UI as an explicit COMING SOON boundary so Phase 2/3 can drop in behind it.
