# Ghost movement trace

## Goal
Make the downed ghost appear only as a short fading body-shaped trail while moving, instead of a full ghost model following the player.

## Changes
- Replace the current floating ghost model with a small pooled set of translucent body silhouettes.
- Sample movement by distance, fade older silhouettes smoothly, and leave no trace while standing still.
- Keep the effect lightweight, non-interactive, and frame-rate independent.
- Verify the Oasis renders without errors.
