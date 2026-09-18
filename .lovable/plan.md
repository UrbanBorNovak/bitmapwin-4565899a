# Monumental Outer Skyline

## Goal
Place the three supplied on-chain skyscrapers beyond the Oasis glass walls so the playable world feels deliberately small beside a vast grayscale city.

## Changes
- Add a dedicated outer-skyline scene using the three validated GLB inscriptions.
- Normalize each model independently, ground it on the gray outer plane, and scale it far above the Oasis boundary.
- Arrange repeated, rotated silhouettes around all four outer edges while keeping the supplied three towers as the dominant landmarks.
- Desaturate and soften imported materials so the city clearly belongs to the unreachable grayscale world.
- Keep the skyline non-interactive, shadow-free, and outside the glass boundary.
- Load each model inside its own scene fallback so one slow inscription cannot blank the Oasis.

## Technical details
- Reuse normalized inscription geometry rather than cloning full scenes for every skyline copy.
- Position towers beyond x = ±50 and z = 0/100, with varied heights and setbacks for depth.
- Disable raycasting, shadows, and frustum issues on the distant skyline.

## Verification
- Run the TypeScript check and inspect preview diagnostics.
- Open Oasis and capture the live 3D scene to verify the towers visibly dwarf the playable world without overlapping its controls.
