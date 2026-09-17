# Keep every accessory attached to the character

## Goal
Make all equipped accessories consistently fit and remain attached to the character in the world and live loadout, including during walking, running, jumping, leaning, flying, and riding.

## Changes
- Replace loose whole-body offsets with shared body attachment points for head, face, neck, back, hands, wrists, fingers, and feet.
- Drive wearable movement from the same pose math as the character so accessories inherit body lean, stride, and mount height.
- Normalize each inscription safely before placing it, with stable scale limits and base seating where appropriate.
- Apply the same attachment system to both the live loadout preview and the in-world character.
- Keep first-person visibility rules intact so headwear does not obstruct the camera.

## Verification
- Validate TypeScript and the preview build.
- Check the character loadout and `/map` in the browser for clipping, floating pieces, closeups, missing models, and runtime errors.
