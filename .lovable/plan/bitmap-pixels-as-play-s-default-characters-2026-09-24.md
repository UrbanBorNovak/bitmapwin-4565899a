# BITMAP Pixels as PLAY’s default characters

## Build
- Load the verified BITMAP Pixels manifest once through the existing collection reader and cache it for all cards.
- Assign every living card a stable character by hashing its BITMAP height into the real on-chain skin list.
- Render that character as the card’s default art, with a clear collection/index label and the existing BITMAP identity mark.
- Preserve current precedence: selected Ord Torches or imported extender art replaces the default character art.
- Keep the abstract BITMAP pattern as the graceful fallback while the manifest loads or if Bitcoin data is unavailable.

## Verify
- Check PLAY lobby, card collection, and match table at desktop and phone sizes.
- Confirm assignment remains stable across reloads and existing extender selections still override defaults.
- Check current build and browser errors.

## Technical details
- Add a lightweight shared client cache/hook instead of loading a 3D canvas inside every card.
- Reuse the existing inscription proxy for cross-origin-safe on-chain images.
