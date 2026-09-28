# AAA Guardian Voxel Detail

## Goal
Turn every Block-DNA Guardian into a premium voxel collectible with a clearly recognizable species, richer close-up detail, and restrained rarity spectacle while preserving its real block-derived identity.

## Build
- Rebuild each Guardian family around a stronger silhouette and layered anatomy: articulated joints, hands/feet, facial planes, armor panels, vents, runes, crests, claws, horns, feathers, scales, and segmented tails.
- Give each named species a distinct visual treatment within its existing family, so Cyber Wyrm and Sand Basilisk no longer read as the same model, nor Storm Jackal and Rune Chimera.
- Add subtle procedural idle motion to presentation views and compatible world parts—breathing, head tracking, wing settling, tail motion, floating shards—without changing fly-brain movement or collision behavior.
- Add rarity-specific physical detail and effects: extra armor/runes for Rare, stronger layered accents for Epic, and a controlled Mythic crown/aura treatment.
- Keep Guardian colors, stats, species, rarity, one-per-block rules, summon proof, and optional shielded Ordinal data fully deterministic.
- Keep geometry reusable and effects bounded for the existing mobile WebGL budget.

## Validation
- Inspect representative golem, wisp, bird, wyrm, jackal, and chimera Guardians in the close-up turntable.
- Confirm details remain readable in the Oasis scale and that feet/bodies stay correctly grounded.
- Check desktop and phone views, motion, runtime errors, and the preview build.

## Technical details
- Refactor the Guardian body into small procedural subassemblies and deterministic species variants rather than importing replacement models.
- Animate only group transforms using clamped frame delta; no React state updates per frame.
- Preserve the current public `GuardianBody` interface so inventory, summon, and Oasis callers remain compatible.
