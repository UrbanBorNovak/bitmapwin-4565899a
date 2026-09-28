# Consolidate Marketplace Price Trends

## Scope
- Recompose the PRICE TRENDS panel into one focused market-analysis workspace with a clear title, compact explanation, and visible active filter summary.
- Replace the long wall of trait buttons with a searchable/selectable trait control, grouped collection control, and a compact 30D / 90D / 1Y / ALL timeframe switch.
- Keep every existing trait and collection available while showing only the current selection, preventing wrapping and visual overload on phones and desktops.
- Upgrade the chart presentation with a stable chart stage, clearer floor/average distinction, readable point details, and polished loading, empty, and interaction states.
- Consolidate the four headline metrics into a quieter data rail and keep matching actionable listings beneath the chart without changing sale or provenance logic.

## Accuracy and behavior
- Continue using confirmed settled Bitcoin sales only; no estimated or synthetic pricing.
- Preserve current filtering semantics, all timeframes, live listings, and provenance scoring.
- Add a one-action reset when any trait or collection filter is active.

## Verification
- Check the Marketplace at desktop and phone widths for overflow, readable controls, chart interaction, filter changes, and empty states.
- Confirm the latest preview build is healthy.

## Technical details
- Refactor only the marketplace trend presentation and local state in `TrendExplorer`; no database or trading logic changes.
- Use the existing terminal glass-panel tokens, Bitcoin orange for selection/action, and signal cyan for secondary live-data emphasis.
- Use the shared button component for interactive commands and accessible labels/pressed states for segmented controls.
