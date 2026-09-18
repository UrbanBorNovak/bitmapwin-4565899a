# Visible terrain grass

## Goal
Make grass unmistakably visible in sandy patches around the walking player.

## Build
- Replace the failing heightmap billboard shader with reliable crossed grass planes using the existing transparent blade texture.
- Place every clump at its sampled terrain height, with dense guaranteed coverage around the player and patchy coverage farther away.
- Keep lightweight wind motion, no dark depth shadows, and water/structure exclusions.
- Verify the live `/map` scene and build health.

## Technical details
- Keep instancing for mobile performance, but move terrain height from the custom vertex heightmap into each instance transform.
- Use two crossed planes per grass clump so blades remain visible from every camera angle.
