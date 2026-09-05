# Phase 2 Bedrock — Creator Experience

## Goal
Finish the builder/creator substrate so anyone can reliably import, build, test, version, configure, publish and deploy an Extender onto BITMAP land. Keep the surface narrow: no new major features, just make the existing MAP → EXTEND → DEPLOY loop actually work for creators.

## What you'll see when this is done

- `/extend` offers three real paths that do not dead-end: **Import** (upload/paste a manifest), **Create with AI** (`/create`), and **Explore Market** (`/extenders`).
- `/create` becomes an iterative AI build lane: describe → generate → preview → tweak → publish/deploy, with clear regeneration and edit controls.
- `/studio` becomes the creator command center for packages you already own: edit code, manage versions, set deploy config, publish/unpublish, and deploy to land.
- Deployed Extenders carry versioned config that creators can edit per deployment.
- The sandbox gives clear feedback when code fails, exceeds limits, or references invalid assets.
- All creator actions are protected by the same wallet-link + live-ownership checks already used for `bitmap_models`.

## Data model (backend)

No new tables required; we extend the existing schema:

- `public.extender_versions.manifest` already stores `code`, `assets`, `models`, `plan`, `builtWith`, `brief`.
- `public.extender_deployments.config` already stores JSONB config; we will expose it in the UI and validate it against a declared schema.
- `public.extender_dependencies` and `public.extender_permissions` exist but are not yet populated by the AI builder or import flow; we will wire them.

Grants and RLS already exist; preserve them.

## Implementation slices

### 1. Real Extender import flow

Make the **IMPORT EXTENDER** path on `/extend` real.

- Add an `/studio/import` route or modal where a creator pastes/upload a manifest JSON and code.
- Validate the manifest against the SDK: required `code`, optional `assets`, `dependencies`, `permissions`, `configSchema`.
- Run the code through the same Blob worker preview before registration.
- On success, create a draft extender + first version; on failure, show sandbox error output.
- Reuse `createExtenderFn` and `publishVersionFn`; add `importExtenderFn` only if the validation/preview logic needs server-side orchestration.

### 2. Iterative AI builder on `/create`

The current one-shot generate-then-ship flow is hard to iterate. Add a loop:

- After generation, show the design plan, the code, the model catalogue matches, and the preview together.
- Add **REGENERATE**, **EDIT CODE**, and **KEEP & DEPLOY** actions.
- REGENERATE sends the existing design + user feedback back to the AI with the same tier limits.
- EDIT CODE opens a small in-page editor; changes re-run the preview immediately.
- KEEP & DEPLOY proceeds to land selection, pricing in BIT, and publish/deploy.
- Persist the final prompt + design in the version manifest so the creator can revisit it.

### 3. Versioned deploy config UI

`extender_deployments.config` exists but is invisible.

- Let a version declare an optional `configSchema` (manifest field) with typed defaults.
- In `/create` and `/studio`, render config inputs from the schema when deploying.
- Store the chosen config on the deployment and hydrate it into the sandbox via `ExtenderContext.config`.
- Allow editing config for an existing deployment from `My World` or the BITMAP detail page.

### 4. Clarify `/studio` vs `/create`

- `/create` = fast AI-assisted build lane for new experiences.
- `/studio` = creator command center for packages you own: list, edit, version, configure, publish, deploy.
- Update `/extend` copy and the MVP flow rail so the choice is obvious.
- Remove the duplicative AI composer inside `/studio` or reframe it as "Edit code / Generate next version" for an existing package.

### 5. Sandbox feedback and hardening

- Surface worker errors, limit hits, and invalid `world.model` references in the preview panel with a terminal-style error log.
- Add a **TEST IN SANDBOX** button to `/studio` and `/create` that runs code without publishing.
- Ensure the sandbox stops and reports when `on('tick')` throws repeatedly, without crashing the world.

## Out of scope

- Revenue sharing payouts
- City governance
- Ratings/reviews
- New game systems (combat, parties, avatars)
- New tokenomics

These stay as explicit COMING SOON boundaries.

## Verification

- Typecheck and production build pass.
- `/extend` shows three working paths.
- Import a sample manifest end-to-end and see it in `/studio`.
- Generate an AI extender, regenerate once, edit code, and deploy.
- Edit deployment config after deploy and confirm the sandbox receives it.
- Signed-out and non-owner users cannot create, import, or deploy.