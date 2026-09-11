# Oasis atmosphere and first-person feel

## Goal
Make exploration feel more atmospheric and game-like while keeping the world readable and the minimal HUD intact.

## Changes
- Strengthen the existing world fog into a closer desert haze during first- and third-person exploration, while keeping the wider overhead map readable.
- Make first-person a clear, persistent choice in the compact utility menu and retain `O` as the instant first/third-person switch.
- Improve first-person movement feel with smoother acceleration feedback, restrained step motion, landing impact, subtle turn lean, and speed-sensitive field of view.
- Improve third-person chase feel with smoother look-ahead and controlled turn lean without pulling the camera too far from the avatar.
- Keep aiming steady, driving cameras stable, and reduced-motion users free of extra camera motion.

## Technical details
- Update the existing `PlayerCameraRig` rather than introducing a second camera system.
- Drive all camera effects from clamped frame delta and current velocity; avoid React state updates in the render loop.
- Use scene fog matched to the existing world background and vary its near/far range by camera mode.
- Reuse the current camera selector and semantic design-system controls.

## Success criteria
- First person is immediately discoverable and selectable.
- Nearby terrain and enemies remain clear while distant geometry fades naturally.
- Walking, sprinting, jumping, landing, and turning feel responsive without motion sickness.
- Aiming and vehicles remain stable.
- The map builds cleanly and the 3D scene is visibly verified on desktop and mobile-sized viewports.
