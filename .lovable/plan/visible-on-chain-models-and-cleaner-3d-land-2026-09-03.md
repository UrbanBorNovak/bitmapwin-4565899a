# Visible on-chain models and cleaner 3D land

## Changes
- Remove the close-range raised district block layer that creates the extra orange 3D blocks.
- Keep the flat million-district map, holder colours, owned-BITMAP glow, selection outline, cursors, and model rendering.
- Normalize each downloaded GLB from a fresh clone, center it over its BITMAP, place its base on the terrain, and scale its largest dimension to several district cells so the full object is legible up close.
- Preserve each owner-configured scale, rotation, height offset, and model animation.
- Make nearby model loading activate at a practical close-range distance and expose model presence in the selected BITMAP window.

## Verification
- Confirm the real approved GLB for 74516.BITMAP is requested and rendered after flying close.
- Capture the map at desktop size and check that the duplicate raised block layer is gone, the scene is visible, and there are no runtime errors.

## Technical details
- Keep the existing React Three Fiber scene and strict on-chain GLB validation.
- Avoid additional geometry passes and retain the 24-model nearby limit.
