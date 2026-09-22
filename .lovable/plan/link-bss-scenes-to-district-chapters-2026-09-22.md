# Link BSS scenes to district chapters

## Goal
Make every verified BSS scene discovered by BitmapWin visible in its atlas district, and identify the scene clearly inside the Oasis without changing the existing world or navigation.

## What will change

1. **Create a live BSS scene directory**
   - Add a small public-read registry for decoded BSS scenes: BITMAP height, BMP inscription, declared BSS version, object/resource counts, validation state, and last verification time.
   - Populate or refresh it only after BitmapWin successfully fetches and decodes real on-chain BSS data. No scene content or status will be invented.
   - Keep writes server-only; visitors can read valid scene summaries.

2. **Show scenes in district chapters**
   - Load verified scene summaries for the chapter’s exact block range.
   - Add an **ON-CHAIN SCENES** section with one entry per BSS BITMAP, including version and object/resource counts.
   - Each entry links to the BITMAP land page and provides a **DROP IN 3D** action that opens the Oasis on that BITMAP.
   - Show a restrained empty state when no BSS scene has been discovered in that district yet.

3. **Label the scene in the Oasis**
   - Add a lightweight world-space label above a successfully decoded BSS scene.
   - The label will show the BITMAP number and BSS version/object count, stay readable from useful camera distances, and not block world controls or raycasting.
   - Keep it inside the existing 3D scene component so it appears only when a real scene is rendered.

4. **Verify**
   - Confirm 156700.BITMAP registers from its real BMP, appears in its district chapter, links to its land page and Oasis location, and shows its in-world label.
   - Check desktop and phone layouts, selective tests, current preview errors, and the generated build.

## Technical details
- Extend the existing BSS server loader rather than adding another decoder or world format.
- Use the existing district range helpers and TanStack server functions.
- Database access follows public read / server-only write rules with explicit grants and row-level security.
- Preserve the current storybook/terminal visual system and multilingual behavior.
