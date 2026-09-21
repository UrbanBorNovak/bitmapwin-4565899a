# Smooth atlas zoom and stable close-up detail

## Changes
- Keep wheel and pinch zoom anchored under the pointer, while batching camera updates to one per animation frame for steadier movement.
- Add small hysteresis bands to terrain, fine-detail, clustering, and parcel visibility thresholds so features do not repeatedly pop in and out near a zoom boundary.
- Keep close-up SVG detail on stable world-aligned cells while panning, and cross-fade detail tiers instead of replacing them abruptly.
- Remove conflicting marker hover transforms that override inverse zoom sizing and cause pins to jump.

## Verification
- Test repeated wheel zoom, trackpad-style small deltas, drag, and pinch-sized transitions at every detail threshold.
- Confirm labels remain sharp, markers stay fixed to their land, close-up marks do not flicker, and desktop/mobile layouts remain clean.
- Check runtime logs and the preview build.
