# Full 1,000 × 1,000 BITMAP World

## Goal
Render all 1,000,000 district cells in the 3D map at once, including mined and future districts, while keeping exact hover/click lookup for every cell.

## Changes
- Replace the current zoom-window/coarse overview block renderer with one GPU-instanced mesh containing all 1,000,000 district blocks.
- Encode each district's row, column, mined state, deterministic height, and orange treatment in the instance data so the world remains one efficient draw path rather than one million React elements.
- Keep exact coordinate-to-block mapping across the complete 1,000 × 1,000 terrain; clicking any cell opens its `<height>.BITMAP`, club, block number, and holder state.
- Allow future cells above the live chain tip to be inspected, clearly marking them as not mined yet and avoiding links to nonexistent BITMAP detail pages.
- Preserve visible-range owner coloring, connected-wallet highlighting, live visitor beacons, chat, camera controls, and the orange energy layer.
- Update status copy so the interface clearly reports that all 1,000,000 districts are loaded.

## Validation
- Verify the project builds cleanly.
- Open `/map` in the browser and confirm the complete square world renders without a blank frame or runtime/network errors.
- Test selection in both mined and future portions of the grid and confirm the computed BITMAP number and club are correct.
