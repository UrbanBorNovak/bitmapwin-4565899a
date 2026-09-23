# Extend the ord.net system and restore light mode

## Goal
Make the atlas, BITMAP land details, and clan/rank leaderboards use the same dense, square, data-first interface as the new market shell, while preserving the painterly atlas image and all existing data and interactions. Add a true user-selectable light view.

## Implementation
- Restyle the atlas navigation rail, search, layer/time controls, inspector, analytics, map key, activity strip, and mobile sheet as flat monochrome instrument panels with crisp rules and Bitcoin-orange active states. Keep the painted map itself visible as the content.
- Tighten the BITMAP land page into a denser property dossier: compact heading and status area, flat bordered data sections, consistent table/panel rhythm, and no remaining storybook page chrome.
- Rework rank and clan leaderboards into exchange-style boards with a compact title bar, segmented board/scope controls, stronger row hierarchy, numeric alignment, clearer active rows, and phone-safe columns.
- Define a real ord.net-compatible light palette with white/off-white surfaces, near-black text, neutral gray rules, and Bitcoin-orange actions. Restore the theme control in the shared header and keep the saved theme behavior.
- Ensure all targeted screens use semantic theme colors so dark and light views remain legible without changing the atlas artwork, Oasis renderer, data, or business logic.

## Technical details
- Update semantic tokens and targeted shared utilities in `src/styles.css`; avoid route-level hardcoded colors.
- Update the shared header, atlas explorer, BITMAP detail composition, and rank shell/table styling. Keep the existing Button component for controls.
- Verify `/map`, `/bitmap/715093`, `/ranks`, and `/ranks/clans` in dark and light views at desktop and phone widths, then check runtime and build logs.
