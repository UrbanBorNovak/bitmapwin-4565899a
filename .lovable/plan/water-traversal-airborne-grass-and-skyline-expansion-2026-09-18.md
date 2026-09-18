# Water traversal, airborne grass, and skyline expansion

## Build
- Let on-foot players move freely across shorelines and water, using the visible water surface as the walking floor while over water; retain vehicle-specific behavior.
- Make grass visibility depend on horizontal distance only and keep its streamed ground coverage active while the player jumps or flies.
- Add the two supplied, validated on-chain 3D inscriptions to the grayscale megacity beyond every glass edge, normalized and repeated at monumental scale like the existing towers.

## Technical details
- Adjust the player movement blocker and grounding path without changing land collision, structures, or deep-water visuals.
- Correct the grass shader’s camera fade so vertical camera/player distance cannot erase nearby terrain grass.
- Extend the current `OuterSkyline` data rather than creating a second loading/rendering path.
- Verify TypeScript, preview build health, and the live `/map` canvas at the supplied viewport.
