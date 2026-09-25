# Live card growth timeline

## What will change
- Add a live growth timeline to each living card page.
- Show chronological play, combat, win/loss, build, learning, and evolution moments.
- Display the card state, traits, power, defense, activity, and XP recorded at each new moment.
- Highlight exactly what changed between adjacent moments, while keeping older saved cards compatible.

## Technical details
- Extend card-history entries with an optional growth snapshot so all future events preserve exact card state.
- Record snapshots through the existing world-event pipeline after each mutation.
- Render a focused timeline on the existing card detail page, with a current-status entry for legacy history that predates snapshots.
- Add focused tests for snapshot recording and stat/trait progression.
