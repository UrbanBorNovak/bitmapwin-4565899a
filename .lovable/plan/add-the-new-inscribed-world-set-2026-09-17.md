# Add the new inscribed world set

## What will change

- Replace the current pine-tree shrooms with both supplied SHROOM inscriptions, mixed deterministically around tree bases.
- Replace the current dumpster inscription with the supplied DUMPOSTER model.
- Replace the current tower with the supplied METAVOXEL TOWER and add the TOWER CORNER as part of a new castle district.
- Add a solid castle landmark assembled from CASTLE WALL, UPPER WALL FENCE, TOWER CORNER, and CASTLE WALL TOP FENCE RIGHT ENDING pieces. Its doorway will remain passable while walls and towers block walking and vehicles.
- Replace the small Bitcoin statue with SATOSHI'S STATUE; keep the separate Great Bitcoin Statue already in the world.
- Keep PIKACHU1 and add PIKACHU2 as a second shoreline creature group using the same independent fly-brain behavior and nearby-creature HUD signal.
- Replace the companion roster with the supplied CAT ON A LEASH, DOG ON A LEASH, and GOOSE ON A LEASH models. The unlabeled `b8f812…i0` entry is already the current goose model, so it will not be duplicated.
- Add the BIRD as a peaceful flying-brain creature.
- Add BLUE PILL as a field ration with its own SVG inventory/rations icon and a short recovery buff.
- Add BATMAN HEAD as a wearable head item in the character inventory, with an SVG slot icon and proper attachment to the avatar.

## World behavior and presentation

- Normalize every inscription to Oasis scale, preload it, and isolate loading so a failed model cannot blank the world.
- Give permanent architecture matching collision shapes while keeping intentional openings usable.
- Keep scattered items deterministic and nearby-only so the additions do not undo fast-travel and flight performance work.
- Preserve the existing monochrome terminal HUD with Bitcoin-orange active states.

## Verification

- Check types and the preview build.
- Open The Oasis in a browser, verify the world renders without a blank screen, inspect the inventory/rations controls, and confirm no new console or network failures.
- Verify collision around the castle and passage through its opening as far as the software-rendered preview allows.
