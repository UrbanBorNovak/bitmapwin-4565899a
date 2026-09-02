# Pixel-Punk Mascot

## Goal
Replace the stickman companion with a compact Bitmap punk avatar that fits the monochrome terminal identity and Bitcoin-orange accent.

## Changes
- Redraw the mascot as a crisp pixel-art punk with a square head, mohawk, visor/eye accent, jacket, arms, and legs.
- Keep the existing roaming, thinking, cheering, speech bubbles, route-aware reactions, and reduced-motion behavior.
- Update component naming and the global app-shell mount to reflect the new mascot.
- Verify the avatar renders cleanly without overlap at the current viewport and on a narrow mobile viewport.

## Technical details
- Use an inline SVG pixel sprite so animation remains sharp, lightweight, theme-token-aware, and deterministic.
- Preserve the existing mascot event API so bid and purchase reactions continue working unchanged.
