# On-chain 3D models on the BITMAP world

## Goal
Let a verified BITMAP owner attach an existing on-chain 3D inscription to their BITMAP, then show that model to every visitor in the shared 3D map.

## What will be built
1. **Public model registry**
   - Add a `bitmap_models` record keyed by BITMAP height with inscription ID, display transform, validation status, owner address, and timestamps.
   - Public visitors can read approved models; only authenticated users with a linked wallet matching the current BITMAP owner can publish, replace, or remove one.
   - Keep roles and ownership checks server-side; no client-only ownership trust.

2. **Strict on-chain validation**
   - Accept an existing inscription ID only.
   - Fetch its inscription content on the server and require a self-contained binary GLB.
   - Enforce limits for file size, valid GLB headers/chunks, embedded assets only, vertex/triangle budget, texture/image count, animation count, and model bounds metadata.
   - Reject malformed, oversized, externally-referenced, or unsupported models with a clear reason.

3. **Owner publishing flow**
   - Add an owner-only `PLACE 3D MODEL` action to the selected BITMAP window and its detail/build page.
   - Provide inscription ID, scale, rotation, and vertical offset controls with validation feedback.
   - Support replacing or removing the model and refresh map data immediately after publishing.

4. **Shared map rendering**
   - Query approved models only for the close-up visible BITMAP window.
   - Load models inside isolated Suspense/error boundaries so one broken inscription cannot blank the world.
   - Normalize each model into its BITMAP footprint, preserve animation when within budget, and add a lightweight marker at medium distance.
   - Cap concurrently loaded models and prioritize nearest models to preserve the million-district map performance.

5. **Verification**
   - Test unauthorized and non-owner writes, invalid inscription IDs, oversized/malformed GLBs, replace/remove flows, public reads, and map rendering.
   - Verify desktop/mobile map interaction, clean browser console/network state, and a lit nonblank 3D scene.

## Technical details
- Reuse the existing wallet-link authorization and live BITMAP ownership resolution.
- Reuse the existing Ordinals content URL and GLTF loader patterns, but remove runtime dependency on third-party decoder CDNs for this map path.
- Keep the model file on-chain; the database stores only validated metadata and placement settings.
- Initial safety budget: one model per BITMAP, 2 MB GLB, 100k triangles, 8 embedded textures, 4 animation clips, and 24 simultaneously rendered close-range models.
