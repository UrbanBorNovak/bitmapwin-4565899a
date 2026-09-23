# Plan: Optional Ordinals PFP extenders for BITMAPWIN // PLAY

## Goal
Add optional card-art extenders inside the existing BitmapWin PLAY system so living cards can show real Ordinals PFP HTML inscriptions, starting with the provided Weirdos-style inscription example.

## What will change
- Add a PLAY extenders settings page where a player can enable or disable PFP art packs.
- Add a starter PFP extender using the provided real inscription URL/id, rendered through the same safe preview iframe pattern already used for inscriptions.
- Let players add their own HTML inscription IDs as custom PFP extenders.
- Update living cards so, when an extender is enabled, the card art can use the selected PFP HTML preview while keeping the BITMAP pattern, stats, state, and history visible.
- Add a small section on each card page showing which visual extender is active.
- Keep everything local and optional for now, so it does not alter ownership, gameplay balance, world data, or existing card persistence.

## Technical details
- Store enabled/default/custom PFP extender settings in the existing PLAY local persistence layer.
- Add new client-safe types for card visual extenders.
- Add a reusable card-art component that chooses between the current BITMAP pattern and an Ordinals preview iframe.
- Keep iframe sandboxing strict and only accept valid inscription ids.
- Add navigation from PLAY to the new extenders page.
- Preserve the existing ord.net terminal shell, light/dark themes, and current PLAY routes.

## Verification
- Open `/play/extenders`, enable the starter PFP extender, and confirm the provided HTML inscription renders.
- Open `/play/cards` and `/play/match` to confirm cards still work and the optional PFP art appears without breaking gameplay.
- Check mobile width for overflow.
- Check the build log after edits.
