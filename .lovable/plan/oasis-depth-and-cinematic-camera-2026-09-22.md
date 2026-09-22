# Oasis Depth and Cinematic Camera

## Goal
Make The Oasis feel like a layered, inhabited Bitcoin-native world rather than a flat map, while preserving its current painterly atlas style, navigation, gameplay, real on-chain content, and minimal HUD.

## World depth
- Organize the existing scene into explicit **FAR**, **MID**, and **NEAR** render groups so each distance band has a clear visual job.
- **FAR:** add low-cost distant terrain silhouettes, a few oversized district structures, atmospheric haze, and sparse moving activity. Use deterministic placement and instancing so the horizon feels populated without loading the full nearby world.
- **MID:** keep districts, roads, permanent landmarks, published builds, BSS scenes, water, and moving world activity readable. Fade and scale detail by camera distance instead of letting everything compete at once.
- **NEAR:** prioritize the selected BITMAP, neighboring BITMAPs, reinscription ground textures, interactive objects, local flora/fauna, and the avatar. Preserve exact walkable terrain and collision behavior.
- Keep the current HUD visually unchanged apart from any small camera action needed for inspection/orbit.

## Cinematic camera
- Replace instant map-camera position changes with a camera transition controller using frame-rate-independent acceleration, damping, and eased position/target/FOV movement.
- Add controlled zoom limits and subtle tilt that responds to distance and travel speed without causing motion sickness.
- Make selecting or entering a BITMAP perform a staged fly-to: wide approach, district reveal, then a close landing/inspection view.
- Add landmark inspection with a slow, bounded orbit; normal input cancels the orbit immediately and returns control to the user.
- Preserve existing first-person and third-person movement cameras, while smoothing transitions between map, inspection, and walk modes.
- Respect reduced-motion settings by shortening transitions and disabling automatic orbit/tilt.

## Performance and stability
- Reuse the current quality presets and performance governor to cap distant objects, animation density, shadows, and atmospheric effects on lower settings.
- Use instancing and distance-based visibility; avoid loading remote assets for scenery.
- Keep the current BITMAP coordinate system, terrain heights, BSS rendering, land skins, builds, ownership overlays, and collision logic unchanged.
- Ensure camera movement never writes React state every frame and clamp frame delta after stalls.

## Technical approach
- Add a focused world-depth module for deterministic far silhouettes and distant activity.
- Refactor the map camera in `BitmapWorld3D.tsx` into a small cinematic state machine: `idle → flying → inspecting → entering`, driven inside `useFrame`.
- Extend existing camera commands with focus/inspect intent rather than adding a second competing controls system.
- Group existing scene elements by distance band and apply visibility/fade rules based on camera mode and distance.
- Keep `MapControls` for manual navigation, disabling it only during a cinematic transition and re-enabling it when complete or interrupted.

## Verification
- Test world overview, BITMAP selection, fly-to, landmark orbit, enter/walk transition, and manual interruption on desktop and mobile.
- Verify `/oasis?height=715093` still shows the reinscribed ground image and `/oasis?height=156700` still shows its BSS scene.
- Confirm reduced-motion behavior, no camera jumps, no overlapping HUD, no new runtime/console errors, and acceptable frame timing on lower quality.
