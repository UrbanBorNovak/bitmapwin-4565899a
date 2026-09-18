# Wind-reactive grass and richer Oasis sky

## Goal
Bring the reference demo’s natural motion and open-sky atmosphere into The Oasis without changing BITMAP terrain, gameplay, or the existing day/night identity.

## Changes
- Replace the current whole-grass-pool rocking motion with subtle per-blade wind bending, so nearby terraformed grass ripples in staggered waves while staying rooted to the terrain.
- Keep grass deterministic, lightweight, and limited to genuinely terraformed BITMAPs; preserve structure clearances and current growth density.
- Add a camera-following atmospheric sky dome with a clearer horizon-to-zenith transition inspired by the reference, integrated behind the existing inscribed sun, moon, stars, aurora, and lightning.
- Match fog and lighting to the sky for readable daytime and nighttime exploration, without changing overhead map visibility.
- Respect reduced-motion preferences by greatly reducing wind movement.

## Technical details
- Extend `LandGrowth` with an instanced grass blade geometry and a lightweight vertex shader using time, world position, blade height, and instance variation.
- Blend scene fog inside the grass shader so distant grass fades naturally rather than cutting through haze.
- Extend `SkyBodies` with an inside-facing procedural sky dome centered on the camera; retain the current celestial and weather layers.
- Avoid runtime asset downloads and additional rendering dependencies.

## Success criteria
- Grass roots remain fixed while blade tips sway gently and asynchronously.
- Grass remains aligned to the real terrain and does not grow through player structures.
- The sky has visible atmospheric depth and a natural horizon while all existing sky events remain visible.
- The scene renders correctly at desktop and mobile-sized viewports with no new runtime or build errors.
