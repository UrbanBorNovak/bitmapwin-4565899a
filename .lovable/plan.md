# Vehicle Combat Balance and Damage

## Build
- Give every ride a clear combat role by tuning top speed, sprint, acceleration, braking, grip, and steering radius together.
- Add per-ride hull durability, armor, occupant protection, and destroyed/repair states.
- Route vehicle gun hits through the existing player damage system so cannon and weapon damage changes health instead of only showing hit messages.
- Add impact explosions, critical hull effects, destruction feedback, and a vehicle integrity bar in the combat HUD.
- Add terrain-aware hull-down protection: ground vehicles exposing only the turret/upper hull take reduced incoming damage when suitable nearby cover blocks the lower hull.
- Keep all combat intelligence and damage calculations local/deterministic, with no AI-credit usage.

## Technical details
- Extend ride specifications with combat durability and turn-radius metadata while preserving the shared traversal cap.
- Add a small vehicle-combat state module for hull HP, armor reduction, repair timing, hull-down tests, and damage events.
- Extend presence combat messages with validated ranged damage and ride state, then connect vehicle shells to player/vehicle damage.
- Render pooled lightweight explosion effects and expose hull status through the existing AAA HUD.

## Verify
- Typecheck and confirm the live build.
- Test representative roles: tank, fast sports car, Cybertruck, watercraft, and aircraft.
- Verify player hits, armored vehicle hits, hull-down reduction, destruction/ejection, respawn/repair, explosion visuals, and no page errors.
