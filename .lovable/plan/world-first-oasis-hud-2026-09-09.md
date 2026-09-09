# World-first Oasis HUD

## Goal
Make the 3D world the dominant experience. While walking in first- or third-person, keep only essential status and two clear entry points visible; everything else opens on demand.

## Changes
- Remove the page-level journey rail and always-open side chat from the active Oasis experience so the world spans the available width.
- Increase the world viewport and add a restrained in-world top line for `THE OASIS` and the current BITMAP/block.
- Replace the crowded exploration toolbar with two compact actions: `[M] MAP` and `[C] CHAT`.
- Add keyboard-controlled overlays:
  - `I` opens/closes inventory.
  - `B` opens/closes building.
  - `M` opens/closes the full map.
  - `C` opens/closes chat; move camera switching to a non-conflicting key and keep an accessible view selector inside the utility menu.
- Hide skills, smelting, mining, party roster, combat log, extender status, minimap, weapon belt, camera selector, and detailed controls during ordinary exploration.
- Keep urgent state contextual: health appears when damaged or dead; trap, damage, event, interaction, and action feedback remain visible only while relevant.
- Add one small utility/menu control for less frequent actions such as view, sound, travel, food, companion, night vision, and terraforming.
- Show the existing inventory, build, map, and chat surfaces as focused overlays rather than simultaneous panels.
- Preserve the overhead map mode’s search, framing controls, selection details, and legend.

## Technical details
- Refactor HUD visibility inside `BitmapWorld3D` around explicit overlay state, with Escape closing the active overlay and only one large overlay open at a time.
- Extend `Minimap` with controlled open state so its full-map dialog can be launched from the minimal HUD without rendering the persistent minimap.
- Reuse the existing real-time world/party chat and existing controls; no game rules, marketplace logic, or stored player data change.
- Adjust the `/map` layout and shared HUD styles only where needed, then verify desktop and mobile rendering plus keyboard behavior.

## Success criteria
- On entering first- or third-person exploration, roughly 80%+ of the viewport is unobstructed world.
- Default exploration shows no permanent chat, party, skills, materials, combat log, minimap, weapon belt, or verbose control panel.
- `I`, `B`, `M`, and `C` reliably open the expected focused surface and Escape closes it.
- Critical combat/death feedback remains visible and usable.