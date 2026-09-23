# Upgrade Oasis game feel and graphics

## Outcome
The Oasis feels more like a living playable world: richer depth, clearer landmarks, stronger movement feedback, better close-range detail, and a more polished atlas-painterly look without replacing the existing map, BSS, reinscription textures, builds, or HUD.

## What changes for players
- Walking, first-person, and third-person movement feel more responsive and cinematic, with subtle speed feedback, camera bob/lean, landing/turn feedback, and smoother acceleration.
- The world gains stronger near/mid/far staging: distant silhouettes and beacons, richer district roads, denser nearby life, and more obvious interactive landmarks.
- Owned BITMAPs and important places become easier to spot from a distance with atlas-style light beacons and labels that stay readable.
- Close-up land feels less flat: stronger terrain color variation, grounded shadows, atmospheric haze, larger landmark silhouettes, and small motion details around active places.
- Graphics quality settings keep protecting weaker devices; Low stays lighter, High gets the most visual richness.

## Implementation scope
- Improve the existing Oasis only. Do not redesign BitmapWin, replace the renderer, change navigation, or invent new data.
- Keep all real data flows intact: on-chain land, BSS scenes, reinscription ground textures, saved builds, clan crests, provenance, and atlas links.
- Use the existing atlas/storybook visual direction: warm painted land, turquoise water, haze, ink/page overlay, orange ownership/action highlights, cyan live-state highlights.

## Technical plan
- Add a lightweight visual-feel layer module for gameplay camera effects: camera bob, speed FOV, turn lean, soft landing/impact shake, and reduced-motion bypass.
- Tune player movement constants in the current state layer for better acceleration/deceleration and less floaty turns, without changing world scale.
- Expand `WorldDepthLayers` with quality-aware far silhouettes, district landmarks, moving carts/birds/smoke, and stronger atmospheric fade.
- Add a close-range `WorldAtmosphere` layer for grass shimmer, dust motes, foot-level particles, and active-place accents using instancing instead of many React meshes.
- Polish materials and lighting in the Oasis scene: richer hemisphere/sun balance, softened shadows, atlas-toned fog, and better contrast between land, water, builds, and BSS/reinscription content.
- Strengthen owned-land beacon visibility at distance while respecting quality caps and avoiding noisy clutter.
- Keep all per-frame work in refs/useFrame with clamped delta; do not write React state every frame.

## Verification
- Check `/oasis`, `/oasis?height=715093`, and `/oasis?height=156700` on desktop and mobile viewports.
- Confirm the 715093 reinscription texture remains visible and walkable on the ground.
- Confirm the 156700 BSS scene still renders and labels correctly.
- Test Low/Medium/High quality so the richer graphics scale down correctly.
- Inspect runtime/build diagnostics and browser console before reporting completion.
