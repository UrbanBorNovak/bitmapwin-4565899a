export const ATLAS_ORDER = 10;
export const ATLAS_SIDE = 1 << ATLAS_ORDER;
export const ATLAS_CAPACITY = ATLAS_SIDE * ATLAS_SIDE;

export type AtlasPoint = { x: number; y: number };
export type AtlasEra = {
  key: "genesis" | "early" | "halving-1" | "halving-2" | "halving-3" | "halving-4" | "frontier" | "unmined";
  label: string;
  biome: string;
};

function rotate(side: number, x: number, y: number, rx: number, ry: number): AtlasPoint {
  if (ry !== 0) return { x, y };
  const nextX = rx === 1 ? side - 1 - x : x;
  const nextY = rx === 1 ? side - 1 - y : y;
  return { x: nextY, y: nextX };
}

/** Bitcoin block height to a locality-preserving order-10 Hilbert coordinate. */
export function blockToAtlas(height: number): AtlasPoint {
  let distance = Math.max(0, Math.min(ATLAS_CAPACITY - 1, Math.floor(height)));
  let x = 0;
  let y = 0;
  for (let side = 1; side < ATLAS_SIDE; side *= 2) {
    const rx = 1 & Math.floor(distance / 2);
    const ry = 1 & (Math.floor(distance) ^ rx);
    const rotated = rotate(side, x, y, rx, ry);
    x = rotated.x + side * rx;
    y = rotated.y + side * ry;
    distance = Math.floor(distance / 4);
  }
  return { x, y };
}

/** Hilbert coordinate back to its block-height position. */
export function atlasToBlock(inputX: number, inputY: number): number {
  let x = Math.max(0, Math.min(ATLAS_SIDE - 1, Math.floor(inputX)));
  let y = Math.max(0, Math.min(ATLAS_SIDE - 1, Math.floor(inputY)));
  let distance = 0;
  for (let side = ATLAS_SIDE / 2; side > 0; side = Math.floor(side / 2)) {
    const rx = (x & side) > 0 ? 1 : 0;
    const ry = (y & side) > 0 ? 1 : 0;
    distance += side * side * ((3 * rx) ^ ry);
    const rotated = rotate(side, x, y, rx, ry);
    x = rotated.x;
    y = rotated.y;
  }
  return distance;
}

export function atlasEra(height: number, tip: number): AtlasEra {
  if (height > tip) return { key: "unmined", label: "UNMINED", biome: "Beyond the frontier" };
  if (height >= Math.max(0, tip - 10_000)) return { key: "frontier", label: "LIVING FRONTIER", biome: "Fog and scaffolding" };
  if (height < 1_000) return { key: "genesis", label: "GENESIS / SUB-1K", biome: "Ancient stone and ruins" };
  if (height < 210_000) return { key: "early", label: "EARLY / PIZZA", biome: "Temperate islands" };
  if (height < 420_000) return { key: "halving-1", label: "FIRST HALVING", biome: "Highland forest" };
  if (height < 630_000) return { key: "halving-2", label: "SECOND HALVING", biome: "Sunlit archipelago" };
  if (height < 840_000) return { key: "halving-3", label: "THIRD HALVING", biome: "Desert mesas" };
  return { key: "halving-4", label: "FOURTH HALVING", biome: "Snowline and new growth" };
}

export function atlasScale(zoom: number) {
  if (zoom < 1.7) return "WORLD";
  if (zoom < 3.2) return "REGION";
  if (zoom < 6) return "DISTRICT";
  return "BITMAP";
}

export function parseAtlasBlock(value: string, tip = ATLAS_CAPACITY - 1): number | null {
  const cleaned = value.trim().toLowerCase().replace(/\.bitmap$/, "").replaceAll(",", "");
  if (!/^\d+$/.test(cleaned)) return null;
  const height = Number(cleaned);
  return Number.isSafeInteger(height) && height >= 0 && height <= tip ? height : null;
}