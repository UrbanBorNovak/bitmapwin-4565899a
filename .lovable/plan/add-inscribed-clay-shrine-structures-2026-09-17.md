# Add inscribed clay shrine structures

## What will change

- Add all eleven supplied inscription models as a coherent Oasis building set: shrine, clay walls, entrances, steps, pillars, door, window/hole walls, iron bars, spikes, and saw.
- Create several deterministic fortified shrine/ruin layouts on dry land around the world rather than scattering unrelated pieces.
- Keep entrances and interior paths open while walls, pillars, bars, and dangerous perimeter pieces block walkers and vehicles.
- Stream only structures near the player, normalize every model to Oasis scale, isolate each model load, and preload the inscription assets.
- Preserve clean water by relocating any generated site that overlaps a sea.

## Technical details

- Add a focused R3F structure-set component using the existing `InscribedModel`, `WORLD_CELL`, `world-solids`, and sea helpers.
- Use fixed seeded site generation for stable placement, model variation, and rotation across visits.
- Register piece-level collision circles instead of one solid building radius so doorways remain usable.
- Mount the new structures beside existing landmarks and castle content in The Oasis.

## Verification

- Confirm the preview build is clean.
- Open The Oasis in a browser and verify the models load, sites remain on land, entrances are passable, collisions are present, and there are no new console or network failures.
