# Add complete Graphics Quality controls

## Outcome
Players can switch between Auto, Low, Medium, and High from the Oasis HUD. The choice persists as `bitmapwin.quality`, weak first-time devices get a one-shot Low recommendation, and High preserves the current Oasis look while lower modes substantially reduce GPU and simulation load.

## Player experience
- Add a compact `QUALITY` control beside Map / 3rd / Chat, with large touch targets on phones.
- Provide Auto / Low / Med / High presets plus a collapsed Advanced panel for render scale, view distance, shadows, plot glow, FPS cap, and adaptive quality.
- Save the complete quality selection locally and apply it on the next visit without a flash of the wrong preset.
- On the first weak or touch device visit, offer “This device looks limited — start on Low?” with Low and Keep Auto actions; remember the response once.
- Show a recoverable “Graphics context lost — tap to reload” overlay if WebGL is interrupted.
- Add `?debug=1` telemetry for FPS, frame time, effective pixel ratio/render scale, draw calls, triangles, preset, and browser heap when available.

## Rendering and adaptive performance
- Create the central graphics modules: `quality.ts`, `QualityContext.tsx`, `QualityHud.tsx`, `AdaptiveQuality.tsx`, and `useFps.ts`.
- Drive Canvas pixel ratio, scaled drawing-buffer size, antialiasing, shadow configuration, FPS scheduling, document visibility pause/resume, and context recovery from the effective quality settings.
- Replace the existing independent DPR governor with the shared adaptive controller. It will lower scale after sustained sub-25 FPS and raise it only after sustained 55+ FPS, with a two-second cooldown and preset bounds.
- Keep the current High lighting, environment, effects, glow, vegetation, and model detail. Low and Medium use the requested reduced lighting, shadow, glow, particle, and post-effect paths.
- Because WebGL antialias is fixed when the renderer is created, switching into or out of Low will recreate only the renderer/Canvas boundary while preserving game and HUD state; ordinary scale, shadow, range, and effect changes stay live.

## Streaming, density, and animation budgets
- Connect the quality view-distance band to chunk streaming and nearby terrain/dressing radii: Low current district, Medium 3×3, High 5×5; prune departed chunks immediately while retaining deterministic world identity.
- Keep distant unloaded space as the existing lightweight land/map surface rather than mounting full world content.
- Apply preset budgets to grass, trees, flowers, shrooms, cacti, houses, crates, miners, bots, creatures, rain, trails, mist, and other particles.
- Preserve existing instanced procedural pools and add low/mid fallback paths for repeated inscription props where true instancing is unsafe for distinct loaded scenes: cheap geometry/billboards on Low, reduced nearby models on Medium, current full models on High.
- Cap visible animated NPCs/miners at 8 / 16 / current-full and tick their animation/simulation every third / second / every frame by preset.
- Render Low owned/mining plots as opaque brighter sand and Medium as a cheap tint; reserve the existing transparent/additive glow for High.

## Route and mobile safeguards
- Lazy-load the heavy world module only from `/map`; economy and collection pages remain free of the 3D bundle and never mount a Canvas.
- Keep the existing left joystick and right-half drag controls, and preserve safe-area placement and tap-sized world HUD controls.
- Auto starts conservatively from touch, memory/core count, WebGL2 availability, and the first three seconds of measured FPS; touch Auto targets 30 FPS by default.

## Verification
- Verify persistence, first-visit prompt, each preset and every Advanced override on desktop and mobile emulation.
- Check that Low/Medium/High visibly change resolution, streamed range, shadows/glow, prop/NPC density, particles, and FPS target while High matches the current scene.
- Travel across district boundaries and change settings in motion; confirm no whole-app remount, no lost pose, and correct chunk unloading.
- Simulate context loss/restoration and tab hiding; confirm recovery overlay and paused rendering.
- Confirm `/coins`, `/marketplace`, `/builds`, `/leases`, and `/collections` do not request or initialize the world module.
- Run focused type checks, inspect build/runtime/console diagnostics, and capture desktop/mobile Oasis frames plus debug telemetry.

## Technical notes
- Presets are immutable defaults; Advanced values are user overrides layered over the selected preset. Auto resolves to Low/Medium/High capabilities while retaining the visible Auto selection.
- The requested “current district / 3×3 / 5×5” bands map to existing chunk radii `0 / 1 / 2`.
- Renderer antialias changes require a Canvas key because WebGL cannot toggle antialias after context creation; gameplay state remains above that boundary.
