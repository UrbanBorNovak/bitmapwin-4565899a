# V7 Guardian chain timeline and theme switch

## What will change
- Add a compact timeline for the latest 12 Guardians in the pack.
- For each Guardian, read and show its BITMAP block height, difficulty, block weight, and inscription time from recursive on-chain endpoints.
- Mark deterministic Blood Moon entries from the Guardian's block height and show the current four-second pulse phase live for the selected Guardian.
- Add a dark/light control to the V7 inscription. It follows the visitor's device theme initially, remembers a manual choice locally, and recolors the sky, HUD panels, labels, and controls without changing Bitcoin-orange ownership signals or cyan live-state signals.
- Keep the existing Guardian view unobstructed by making the timeline a compact, toggleable canvas panel with phone-safe sizing.

## Technical details
- Extend only `src/lib/guardian-delegate-v7.ts`; V6 remains byte-identical and active until V7 is inscribed and wired.
- Reuse `COLL.ids`, `/r/inscription`, `/r/blockinfo`, `G.h`, `G.df`, `G.wt`, and `CY.n/CY.t`; cap loading at the newest 12 children.
- Treat Blood Moon as a deterministic block-height event. Treat pulse phase as a live local animation event, not immutable chain history, and label it accordingly.
- Verify generated V7 JavaScript parses, run the focused generator check and TypeScript check, then inspect the current build log.
