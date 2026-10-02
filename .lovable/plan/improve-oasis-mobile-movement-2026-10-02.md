# Improve Oasis mobile movement

## Build
- Replace the cramped phone controls with a larger left movement stick and a clear right-side camera swipe zone.
- Make sprint activate naturally near the stick edge and add a one-tap auto-run control for long BITMAP crossings.
- Reorganize jump, attack, ride, and flying controls into thumb-reachable action buttons that respect phone safe areas.
- Prevent stuck movement when a finger leaves the screen, a menu opens, or the app loses focus.
- Keep the existing desktop controls and Oasis gameplay unchanged.

## Verify
- Check portrait and landscape phone layouts for overlap with menus, map, and world readouts.
- Test walking, turning, camera look, sprint, auto-run, jump, attack, and ride controls.
- Confirm the app builds cleanly and no new preview errors appear.

## Technical details
- Update the existing touch-control component and shared touch state only; no world data or Guardian logic changes.
- Continue using the current semantic color system and terminal-style visual language.
