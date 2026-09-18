# Stable River Polish

## Goal
Make rivers read as natural waterways that begin as narrow creeks, widen gradually downhill, and never jump to a new location as the player moves or terrain data finishes loading.

## Changes
- Replace player-centred river generation with deterministic world-sector rivers keyed only by fixed BITMAP coordinates.
- Keep generated river paths cached so streaming and terrain refreshes cannot reroute an existing river.
- Start each route as a thin spring/creek, then widen smoothly based on distance travelled and accumulated downhill flow.
- Smooth bends into continuous ribbon geometry, reduce abrupt width changes, and add restrained shallow-bank variation.
- Keep waterfalls attached to the same fixed route wherever the terrain drop is large enough.
- Stream fixed neighbouring river sectors around the player without regenerating their locations.

## Technical details
- Build river control points from stable integer sector seeds and sample a smoothed Catmull–Rom centerline.
- Cache river plans separately from render geometry; terrain updates may adjust vertex height only, never X/Z positions.
- Use tapered widths and cumulative UV distance so water animation flows consistently from source to outlet.
- Dispose replaced geometry and preserve the current draw-call budget.

## Verification
- Run the TypeScript check and inspect preview diagnostics.
- Capture the world before and after moving across a stream boundary to confirm river locations remain fixed and visually continuous.
