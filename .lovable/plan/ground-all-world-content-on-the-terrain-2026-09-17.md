# Ground all world content on the terrain

## Goal
Make every remaining in-world model follow the same BITMAP terrain surface, while keeping water level and lava placement visually correct.

## Changes
- Add one shared surface-position helper so static models, spawned props, buildings, ores, collectibles, events, extenders, vehicles, markers, and effects consistently use terrain height.
- Update instanced desert dressing so each cactus, rock, plant, pond, tree, house, mine, shrine, playground, and resource node is rebuilt at its local terrain elevation.
- Ground fixed and streamed objects, including player builds, landmarks, on-chain models, world extenders, BITMAP mine crews, DJ stages, mystery boxes, eggs, traps, trails, and vehicle placement.
- Keep open sea water at its global waterline above the submerged sea floor; place islands at that waterline.
- Place lava lakes, rims, glow, waterfalls, and splash pools on their local terrain surface, with falls extending from that surface rather than the old flat plane.
- Preserve flying objects' intentional altitude above the terrain instead of pinning them to the floor.

## Verification
- Check the project build after the changes.
- Open the live 3D world and verify representative structures, resources, creatures, extenders, water, lava, and vehicles have no floating or buried bases.
- Confirm the scene renders without runtime errors or a blank canvas.

## Technical details
- Use `groundY(x, z)` for dry-ground anchoring.
- Use a dedicated water-surface height for seas and islands so sea-bed displacement does not pull water down.
- For large footprints, anchor to a stable local sample rather than changing height every frame; animated movers sample at their current position.
