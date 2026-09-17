# Stabilize The Oasis world stream

## Outcome
Players can travel long distances without shared structures, ore fields, or the aurora visibly resetting. The `/map` loading and stream-status surfaces match the tactical cold-tech HUD.

## Implementation
- Keep world-stream records stable across movement: merge refreshes by chunk, remove only records confirmed absent from refreshed chunks, and avoid remounting unchanged structures.
- Stabilize ore rendering across moving stream windows: preserve deterministic vein state and stop global ore registrations from being cleared during overlapping window updates.
- Keep the sky layer persistent: make aurora shader resources independent of movement/render changes and keep its animation clock continuous.
- Add a small shared stream-status store exposing loaded, queued, and syncing states without driving the 3D scene every frame.
- Restyle The Oasis loading curtain and `/map` stream readouts with existing angular glass panels, cyan live telemetry, and orange progress/action accents.
- Replace the map legend's inline colors with semantic design tokens.

## Verification
- Exercise fast travel and returning to previously visited areas; confirm structures and partially mined ore retain identity/state.
- Confirm the aurora stays mounted and its animation remains continuous while traveling.
- Check `/map` at desktop and mobile widths, including loading and active stream states.
- Confirm the preview build, console, and runtime diagnostics are clean apart from environments where WebGL is unavailable.
