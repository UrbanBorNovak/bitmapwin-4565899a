# Classic-world terrain and lighting for the Oasis

The Oasis is already 3D and walkable. This upgrade gives it the classic online-world look Lineage2JS goes after: big rolling land you can see for miles, blended ground materials, and baked sunlight and shade. We borrow only the ideas. All code and art is our own, and the land shape still comes from real block data.

## What you will see

- **Hills to the horizon.** The land no longer flattens into desert past the nearby area. Far ridges and highlands stay visible and fade into haze.
- **Painted ground that blends.** Grass on low ground, sand on slopes, rock on steep faces and chalk on peaks. The materials blend smoothly instead of switching sharply, in the Atlas palette.
- **Real sun and shade on the land.** Hills cast long shadows across valleys and hollows get darker. This follows the time of day and the weather.
- **Grounded buildings.** Builds, shrines and props sit in soft shade where they meet the ground, so they stop looking pasted on.
- **Layered haze.** Distance fog plus low-lying haze in valleys, tinted to match the sky, gives the classic sense of depth.

Walking, driving, flying and every placed object stay on exactly the same ground as today.

## Technical details

1. **Terrain rings (distance detail).** Replace the single patch in `TerrainField` with 3 nested rings: near (current density), mid (half) and far (quarter, out to about 400 BITMAPs). Each ring samples `groundY`, is rebuilt only when the player crosses its snap step, and gets skirts to hide seams. Remove the fade-to-zero edge. `GroundPlane` stays as the base beyond the far ring.
2. **Blended ground material.** A custom material built on `meshStandardMaterial` blends 4 procedural layers (grass, sand, rock, chalk) by height and slope. The layers are small tiling canvas textures made in code. Detail texture shows up close and fades out with distance.
3. **Baked lighting in the vertices.** On each ring rebuild, trace along the sun direction across the heightfield to get a hill shadow, plus a cheap hollow-darkening (cavity) term, and store both in a vertex attribute. The shader multiplies these with the live sun colour from `WeatherLighting`. The bake runs again when the sun angle changes by more than about 5 degrees, spread over frames so it never stalls.
4. **Shade under objects.** Instanced soft shadow decals under builds, `TerrainModels` and shrines, placed with `groundY`.
5. **Height fog.** Add a height-fog term to the terrain and water shaders, using the existing fog colour, near and far values.
6. **Performance.** Stay under the mobile budget: 3 ring meshes add under 60K triangles, with no new real-time shadow maps. The low graphics setting drops the far ring and the baked cavity term.
7. **Checks.** Take screenshots at `/oasis` in third-person, first-person and map views. Walk and drive to confirm the ground height is unchanged, and check the phone view.

## Not included

- No Lineage2JS code, files or NCSOFT game content.
- No changes to gameplay, the economy or how land data is sourced.
