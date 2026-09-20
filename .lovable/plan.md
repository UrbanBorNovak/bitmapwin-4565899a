# Turn the Painted Oasis Into a Real Bitcoin Atlas

## Goal
Keep the illustrated Oasis as the brand layer, but place every BITMAP on a deterministic spatial index so nearby block heights remain nearby and the map behaves like an atlas rather than a static picture.

## This release
- Replace random pin hashing with a deterministic Hilbert spatial index across a 1,024 × 1,024 logical world, covering the million-height BITMAP range while preserving locality.
- Keep the painting as the map skin beneath that coordinate system.
- Add smooth pan and cursor-anchored wheel/pinch zoom with World, Region, District, and BITMAP zoom levels.
- Cluster nearby verified-history pins when zoomed out and split them into individual places as the camera moves closer.
- Add a jump control for a block height or `<height>.bitmap`; animate the camera to its exact location and select it.
- Add `/map/$block` deep links so `/map/716693` opens and focuses that BITMAP, while `/map` remains the full atlas.
- Show the selected BITMAP in a practical inspector with coordinates, era/biome, verified recent history, and direct actions to open the BITMAP or enter the Oasis.
- Add an always-visible legend, zoom controls, current scale label, coordinate readout, and a compact painted mini-map showing the current viewport.
- Keep live activity on the map by making ticker items fly to their BITMAP instead of leaving the atlas.
- Use a phone bottom sheet for selected-place details instead of the desktop right rail.

## Geography and eras
- The spatial index is canonical and reusable by future map layers, generated terrain, and the 3D drop-in camera.
- Era-driven biome labels and subtle semantic overlays establish the data model now: Genesis/Sub-1K, Early/Pizza, Halving eras, and Frontier near the current tip.
- The current tip defines the frontier boundary; unmined cells remain beyond it. No fabricated chain activity or ownership is shown.

## Technical details
- Build a pure, tested atlas geometry module for Hilbert index conversion, viewport transforms, zoom bands, era classification, and clustering.
- Use native pointer events plus a non-passive wheel listener for drag, touch pinch, and cursor-anchored zoom without page-scroll conflicts.
- Reuse the existing provenance stream and chain-tip queries; no backend schema changes are required.
- Preserve all existing routes and the separate full 3D Oasis page.
- Respect reduced motion, keyboard focus, touch target size, and the current terminal/painterly visual system.

## Deferred after this foundation
- Full wallet/owner/event search, dedicated ownership and market layers, 24-hour heatmaps, time scrubbing, procedural terrain tiles, and direct 2D-to-3D camera handoff will build on the same spatial index in later releases.

## Verification
- Test Hilbert locality, coordinate bounds, era boundaries, clustering, and deep-link parsing.
- Verify pan, wheel zoom, zoom buttons, block jump, ticker focus, pin selection, inspector actions, and mobile bottom sheet.
- Check desktop and 390 × 844 layouts for overflow, map occlusion, and console/runtime errors.
