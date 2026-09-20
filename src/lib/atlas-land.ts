/** A real, indexed BITMAP claim: the inscription and the holder behind a block. */
export type AtlasClaim = {
  height: number;
  inscriptionId: string;
  ownerAddress: string | null;
  isValid: boolean;
};

/**
 * The block heights the atlas is showing for a camera window, sampled on a
 * grid so the number of rows read stays bounded at every zoom level.
 */
export function sampleVisibleHeights(
  camera: { zoom: number; x: number; y: number },
  side: number,
  atlasSide: number,
  maxHeight: number,
  atlasToBlock: (x: number, y: number) => number,
): number[] {
  const left = Math.max(0, -camera.x / camera.zoom);
  const top = Math.max(0, -camera.y / camera.zoom);
  const span = Math.min(1, 1 / camera.zoom);
  const heights = new Set<number>();
  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) {
      const x = (left + ((col + 0.5) / side) * span) * atlasSide;
      const y = (top + ((row + 0.5) / side) * span) * atlasSide;
      const height = atlasToBlock(x, y);
      if (height >= 0 && height <= maxHeight) heights.add(height);
    }
  }
  return [...heights];
}
