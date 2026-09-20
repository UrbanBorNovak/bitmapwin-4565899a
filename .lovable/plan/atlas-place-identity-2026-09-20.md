# Atlas place identity

## Goal
Give every BITMAP a stable, memorable place identity without changing its real Hilbert position or implying invented on-chain facts.

## Build
- Add a deterministic atlas gazetteer that derives a district name, local place name, terrain landmark, and compact address from each BITMAP’s block height, coordinates, and era.
- Draw restrained district labels and landmark symbols directly over the painted atlas, revealing more detail as users zoom so the map stays readable.
- Show the selected BITMAP’s district, local place, landmark, coordinates, era, and biome in the desktop inspector and phone sheet.
- Extend block search to match generated district or landmark names, then fly to the matching place.
- Reuse the same identity in pin labels and the Oasis mini-map readout.

## Technical details
- Names remain deterministic client-side data: the same block always receives the same identity, with no fabricated ownership or activity records.
- Labels use collision-aware, zoom-dependent sampling from the existing 1024×1024 Hilbert grid.
- Existing owner-created districts remain separate; generated names describe atlas geography rather than legal ownership.
- Preserve the painterly image, current layers, provenance pins, claimed-land markers, and 3D drop-in flow.

## Validation
- Verify direct `/map/:block` selection, name search, zoom label density, landmark selection, desktop layout, and phone bottom-sheet behavior.
- Confirm no horizontal overflow, runtime errors, or build errors.
