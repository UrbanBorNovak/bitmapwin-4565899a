# Modern tactical first-person and safer travel

## Changes
- Rework first-person camera motion for tighter tactical control: lower eye-level sway, sharper mouse response, stable aim-down-sights, restrained sprint FOV, and subtle strafe/turn lean.
- Reduce on-foot walk/sprint speed and dramatically lower every vehicle's normal, boost, and climb speeds while preserving distinct handling.
- Add a hard traversal cap in the shared movement simulation so temporary boosts cannot outrun nearby-world loading.
- Tune chunk look-ahead and fast-travel performance thresholds to the new speed range.

## Validation
- Check first-person walking, sprinting, aiming, jumping, and 1st/3rd-person switching.
- Drive a ground vehicle and fly an air vehicle, confirming nearby terrain appears before arrival and no blank or crashing frames occur.
- Verify desktop and phone controls, build health, and browser errors.

## Technical details
- Keep movement delta-time based and camera easing frame-rate independent.
- Preserve existing combat, inventory, equipment, vehicle weapons, and world scale.
