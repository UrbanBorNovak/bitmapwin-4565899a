# Fill the streamed world with BITMAP terrain and grass

## Goal
Make every BITMAP in the visible world window contribute its own terrain and grass, instead of concentrating detail around the current tile. Keep the result continuous while walking or fast-travelling and preserve real block-derived terrain wherever that data exists.

## Changes
- Align terrain and vegetation to one shared moving BITMAP window centered on the player.
- Stream all visible BITMAP terrain samples in bounded batches, prioritizing nearby cells, so real block activity progressively replaces deterministic fallback terrain without gaps or resets.
- Generate deterministic grass for every dry BITMAP in the visible window, with dense nearby patches and lighter distance-based coverage farther out.
- Keep terraformed BITMAPs visibly richer than ordinary land and continue excluding water and built surfaces.
- Raise the grass instance budget only as needed and use distance tiers so the expanded coverage remains smooth.
- Preserve each blade's sampled terrain height when streamed terrain updates, preventing floating or buried grass.

## Verification
- Check the world at multiple BITMAP positions and confirm terrain and grass continue beyond the starting tile.
- Confirm grass remains transparent, wind-reactive, terrain-rooted, and absent from water and structures.
- Check desktop and mobile framing, runtime errors, and the latest preview build.

## Technical details
- Extend the current `TerrainField`/`LandGrowth` coverage contract rather than creating per-tile meshes.
- Use deterministic BITMAP-height hashing and instanced rendering for stable layouts.
- Queue terrain requests instead of dropping movement-triggered requests while another request is active.
