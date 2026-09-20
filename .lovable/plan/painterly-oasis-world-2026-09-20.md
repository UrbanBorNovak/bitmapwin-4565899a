# Painterly Oasis world

## Goal
Give the entire Oasis a cohesive hand-painted animated-film atmosphere while preserving its Bitcoin-native identity, real data, navigation, builds, and gameplay.

## Changes
- Repaint the atlas artwork as a warm, whimsical storybook landscape with richer clouds, water, forests, villages, and mountains.
- Retune the 3D sky, fog, sunlight, terrain, water, vegetation, and fallback buildings into the same soft cel-painted palette.
- Add subtle paper-grain and painted-edge treatment to the atlas without obscuring pins, labels, layers, or controls.
- Keep Bitcoin orange for ownership/actions and signal cyan for live state; no data, mechanics, or controls change.

## Technical details
- Replace the bundled atlas image with a new high-resolution painterly render.
- Adjust Three.js shader colors, lighting, roughness, material toning, and environmental palettes in shared Oasis rendering components.
- Use restrained post-processing-like canvas styling rather than adding a costly runtime effects dependency.
- Verify the atlas and Oasis at desktop and phone sizes, including 3D visibility and control legibility.

## Success criteria
- Atlas and 3D world visibly belong to one warm, hand-painted storybook world.
- Sky, ground, foliage, water, landmarks, and player-built structures all carry the treatment.
- Live pins and terminal HUD remain readable and functionally unchanged.
- No blank canvas, overflow, or new runtime errors.
