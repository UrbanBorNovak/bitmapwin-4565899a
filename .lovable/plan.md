# Phase 2 Bedrock — Creator Experience

## Goal
Close the gaps in the existing creator flow so a builder can iterate, configure, compose and ship Extenders without hitting dead ends. No new major features — just make the current MAP → EXTEND → DEPLOY loop coherent for the person creating the software.

## What you'll see when this is done

- `/create` can publish a **new version of an existing extender** instead of always minting a new slug.
- Deploy-time **config** is editable in `/create`, `/studio`, and the `/extenders/$slug` deploy panel, and the sandbox receives it via `land.config`.
- **Dependencies** between extenders can be declared in Studio and shown on detail pages.
- Published extenders have **icon/preview inscriptions** picked from the creator's catalogue.
- The SDK version recorded on every published version matches the documented SDK contract.
- Sandbox errors and limit hits are surfaced in the preview panel with a terminal-style log.
- `/extend` still offers Import / Create with AI / Explore Market, and the Import path validates a manifest before registering it.

## Verified current state

- `/create` is live end-to-end: brief → AI plan + code → sandbox preview → publish/deploy, charging BIT on success. It always creates a new extender with `semver: "1.0.0"`, `dependencies: []`, `permissions: []`, `config: {}`.
- `/studio` is the expert console: draft creation, AI code revision, code editor, starter templates, version history, manual publish with permissions, and a link to `/extenders/$slug` to deploy.
- The sandbox (`extender-runtime.ts`) is real: Blob worker, hard limits, persistence via `extender_state`, `land.config` already passed at runtime.
- Tables `extender_dependencies`, `extender_permissions`, and `extender_deployments.config` exist but are underused by the UI.
- `SDK_VERSION` in `src/lib/extenders.ts` is `"0.1"` while `src/lib/extender-sdk.ts` documents "v0.2".

## Implementation slices

### 1. Versioning from `/create`

Stop minting a new extender on every rebuild.

- Add an "EXTEND AN EXISTING PACKAGE" selector on `/create` (reuse `myExtendersQuery`).
- When an existing extender is chosen, `ship` calls `publishVersionFn` on that `extenderId` with an auto-incremented semver (patch/minor based on tier or user choice) instead of `createExtenderFn`.
- When no extender is chosen, keep the current create + publish `1.0.0` path.
- After deploy, the success panel links to `/studio` with that extender pre-selected.

### 2. Deploy-time config editor

`land.config` is already supported by the runtime but always empty.

- Let a version declare an optional `configSchema` in its manifest (simple key/value list or JSON shape).
- Render config inputs in `/create` step 4, Studio's publish form, and the `/extenders/$slug` deploy panel.
- Pass the collected config to `deployExtenderFn` and store it in `extender_deployments.config`.
- Update the `Inscription Gallery` starter template to declare `config.inscriptions` so the creator knows what to fill in.

### 3. Dependency selection in Studio

The schema and detail page already support dependencies; the UI does not.

- In Studio's `PublishVersionForm`, add a searchable multiselect of published extenders the creator owns or that are public.
- Feed selected dependencies into `publishVersionFn` as `{ dependsOnExtenderId, versionRange }`.
- On `/extenders/$slug`, keep showing the resolved dependency list already read by `versionRequirementsQuery`.

### 4. SDK version reconciliation

- Bump `SDK_VERSION` in `src/lib/extenders.ts` to `"0.2"` to match the documented SDK contract, or reconcile the docs/types header back to `"0.1"` if the runtime contract has not actually changed.
- Store the SDK version on every new publish and display it on the detail page.

### 5. Icon/preview inscription pickers

`icon_inscription_id` and `preview_inscription_id` exist on `extenders` but are always null.

- Add an inscription picker to `CreateExtenderForm` in Studio and to `/create`'s ship step.
- Reuse the catalogue pattern from `listModelCatalogue` (query `bitmap_models` for approved inscriptions owned by the creator's linked address, or allow any valid inscription ID).
- Render the chosen icon/preview on extender cards and detail pages.

### 6. Real import flow (smaller slice)

Make the **IMPORT EXTENDER** path on `/extend` real but minimal.

- Add `/studio/import` (or a modal on `/studio`) where a creator pastes a manifest JSON + code.
- Validate required `code`, optional `assets`, `dependencies`, `permissions`, `configSchema`.
- Run the code through the Blob worker preview before registration.
- On success, create a draft extender + first version; on failure, show the sandbox error log.

### 7. Sandbox error surfacing

- Capture worker `error` and `limit` messages in `ExtenderPreview` and render them in a collapsible terminal log.
- Add a **TEST IN SANDBOX** button to `/studio` and `/create` that runs code without publishing.
- Ensure repeated tick errors stop only that extender and report cleanly.

## Out of scope

- Revenue sharing payouts
- City governance
- Ratings/reviews
- New game systems (combat, parties, avatars)
- New tokenomics
- Economy/social SDK modules (stay labeled COMING SOON)

## Verification

- Typecheck and production build pass.
- `/create` can generate an extender, then generate a second version of the same extender.
- Deploy an extender with config and confirm `land.config` is present in the sandbox.
- Declare a dependency in Studio and see it on `/extenders/$slug`.
- Import a manifest through `/studio/import`; invalid code shows the error log.
- Non-owners cannot publish versions or deploy.