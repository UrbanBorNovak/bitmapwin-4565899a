# Extend Oasis Fog to the Full Atlas

## Goal
Cover every unvisited part of the illustrated `/map` Atlas with the same grey exploration fog already used in the Oasis World Scan.

## Changes
- Reuse the device-saved charted cells, so walking in the Oasis clears matching areas on both maps.
- Add a soft-edged, animated grey fog layer above the Atlas artwork and map detail, while keeping controls usable.
- Keep the visitor's current charted area visible and show the charted-area count on the Atlas.
- Apply the fog to the small overview map as well, so it never reveals unexplored geography.

## Technical details
- Introduce a shared Atlas fog overlay component using the existing `FOG_CELL` grid and `useSeenCells()` store.
- Render it inside the same pan-and-zoom transform as the full Atlas, after visual terrain but before interactive markers.
- Use SVG masking for soft clearings and CSS/SVG motion that respects reduced-motion preferences.
