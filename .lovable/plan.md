# Show raid outcomes on Oasis BITMAP land

## What will change
- Load the latest settled Guardian raids inside the shared Oasis world alongside live Guardian routes.
- Place each result above the winning Guardian’s home BITMAP, showing `WINNER`, the BITMAP height, and the exact BIT spoils.
- Keep multiple recent wins readable by combining outcomes per winning BITMAP and showing the newest result plus its accumulated visible spoils.
- Refresh the markers on the same live cadence as raid settlement, so newly settled raids appear without reopening the Oasis.

## Visual behavior
- Use the existing signal-cyan and Bitcoin-orange world-marker language.
- Anchor each marker to the terrain height, billboard it toward the camera, and keep it visible only near the player to protect frame rate.
- Preserve the existing Guardian movement and raid-settlement behavior; this change only adds the in-world result display.

## Technical details
- Add a typed public recent-raids query using the existing `guardian_raids` read access.
- Render lightweight HTML markers from `TerritoryGuardians`, positioned with the existing BITMAP grid and terrain functions.
- Verify the current build signal and inspect the Oasis in the browser after implementation.
