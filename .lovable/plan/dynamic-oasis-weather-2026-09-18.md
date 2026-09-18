# Dynamic Oasis weather

## Goal
Add a synchronized weather cycle to the 3D world where sun, wind, and rain visibly affect the environment rather than acting as isolated decoration.

## Build
- Add one deterministic shared weather clock with smooth clear, windy, overcast, rain, and storm transitions.
- Render camera-local rain streaks that follow the player, slant with wind, vary in density, and remain lightweight.
- Drive the sky and sun from weather: cloud cover, daylight strength, sun visibility, storm darkening, and rain haze.
- Drive grass from the same wind vector and gust strength so blade direction and bend match the active weather.
- Drive rivers and waterfalls from rainfall and wind so wet weather increases flow speed and surface energy.
- Drive the glass world edges from rain and sun with changing transparency, wet sheen, and animated wind-swept rain traces.
- Preserve reduced-motion behavior and avoid adding expensive post-processing.

## Technical details
- Create a small browser-safe weather module exposing frame-stable values derived from time.
- Add a dedicated instanced/shader rain system near the existing sky effects.
- Pass weather uniforms into the existing grass and water shaders; update material properties through refs without React rerenders per frame.
- Extend the boundary material with a lightweight shader patch for moving rain streaks and sun highlights.
- Verify the `/map` canvas initializes, shaders compile, and the preview build remains clean.
