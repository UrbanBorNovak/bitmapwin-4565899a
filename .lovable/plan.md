# Tank Combat, Vehicle Trails, and Mystery Fog

## Goal
Improve vehicle travel in The Oasis by correcting the tank’s direction, giving it a usable cannon, making movement trails match each ride, and adding atmospheric mystery fog without obscuring play.

## Changes
- Correct the tank model’s forward-facing orientation without changing other ride alignment.
- Add a tank-only cannon action using the existing fire controls: mouse click, keyboard `E`, and the mobile FIRE button.
- Render a visible shell/tracer, muzzle flash, impact burst, cooldown feedback, and cannon sound; cannon impacts damage nearby creatures and valid nearby targets through the existing combat rules.
- Keep regular equipped weapons unchanged when not driving the tank.
- Replace generic ground-vehicle tracks with ride-specific trails:
  - tank: broad twin tread bands
  - cars/truck: paired tire tracks sized to each vehicle
  - Genesis Dog: paw prints
  - boats: wake and foam only
  - aircraft/jetpack: no ground marks
- Add layered, restrained mystery fog with denser distance haze outside map view while preserving nearby visibility and navigation.
- Update the task roadmap and verify the world in desktop and mobile-sized views.

## Technical Details
- Extend ride metadata with explicit model orientation and trail profiles instead of inferring every model from bounding-box dimensions.
- Add a dedicated pooled tank-cannon scene effect to avoid frequent object creation and keep flight/driving performance stable.
- Reuse existing entity damage, player combat, touch controls, audio synthesis, and semantic world colors.
- Keep movement and visual effects frame-rate independent and cap short-lived projectile effects.

## Validation
- Confirm the tank points and travels forward.
- Fire the cannon using keyboard/mouse and mobile controls; confirm effects, cooldown, damage, and no crashes.
- Drive representative ground, water, and air rides and inspect their correct trails.
- Check first-person, third-person, and map visibility with the new fog.
- Confirm a clean build and no browser console or request errors.
