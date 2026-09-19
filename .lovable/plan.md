# Warm Personal Profiles

## Goal
Turn the dashboard identity and public profile into a welcoming personal home while preserving BITMAPWIN's black terminal language and real on-chain data.

## Build
- Restyle the dashboard identity area as a warm amber profile card with a circular inscription portrait, verified session state, wallet identity, personal bio, and existing real activity totals.
- Make profile actions clear and retain the existing wallet, public-profile, and edit flows.
- Redesign the profile editor as a warm identity workshop with a larger live preview, clearer fields, character counts, and an improved inscription picker.
- Carry the same visual identity to the public profile, including membership, bio, wallet address, and real built-BITMAP activity.
- Keep all existing dashboard sections, queries, and transaction behavior unchanged.

## Technical details
- Add profile-specific semantic amber surface and glow tokens to the shared style system; no hardcoded colors in components.
- Use only existing profile, holdings, build, follower, visitor, and membership data. No invented ranks or trust scores.
- Preserve mobile layouts and accessibility, including clear focus states and touch-sized controls.
- Verify the dashboard, editor, and public profile on desktop and phone, then confirm the app remains error-free.
