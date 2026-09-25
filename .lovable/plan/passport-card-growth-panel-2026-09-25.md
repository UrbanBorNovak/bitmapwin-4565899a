# Passport Card Growth Panel

## Goal
Show the signed-in holder’s living PLAY cards directly inside Passport, with their current growth and next evolution milestones.

## Build
- Add a Passport-native growth section populated from the existing persistent PLAY profile.
- Show every card’s BITMAP identity, type, current state, traits, learned adaptations, power, defense, energy, activity, XP, matches, and wins.
- Visualize the full DORMANT → ACTIVE → AWAKENED → DEVELOPED → LEGENDARY path, highlighting completed and current stages.
- Show each card’s nearest learning or evolution requirement and link to its full card record.
- Keep unavailable/loading/empty states honest and preserve mobile usability, light mode, and the existing Passport visual system.

## Technical details
- Reuse `usePlayProfile`; do not add database tables or duplicate card state.
- Extract shared growth calculations so Passport and the static card history use the same milestone rules.
- Keep all data derived from persisted card records and existing world facts.

## Validation
- Verify signed-out and signed-in Passport layouts at desktop and mobile sizes.
- Confirm card links, no horizontal overflow, no browser errors, and a clean build.
