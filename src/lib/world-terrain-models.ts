/**
 * TERRAIN MODELS — inscribed landforms that are part of the ground itself.
 *
 * A handful of inscribed hills and mountains stand on fixed BITMAPS forever.
 * Unlike the inscribed buildings, these are not obstacles: once a model is
 * loaded, its top surface is sampled into a small height grid and registered
 * here, and `groundY` in `world-terrain` lifts the walkable surface to match.
 * That makes everything that reads the ground — avatars, rides, animals, trees,
 * grass, builds — sit and walk on the landform instead of passing through it.
 *
 * Positions are given in BITMAPS out from the genesis plaza and the model height
 * (`span`) in BITMAPS too, so the layout survives any change to world scale.
 */

import { WORLD_CELL } from "./player-state";
import { PLAZA } from "./world-landmarks";

export type TerrainModelSpec = {
  id: string;
  label: string;
  inscription: string;
  /** offset from the genesis plaza, in BITMAPS */
  cell: [number, number];
  /** height of the landform, in BITMAPS */
  span: number;
  yaw: number;
};

/** Permanent landforms. Fixed cells: they never move for anybody, ever. */
export const TERRAIN_MODELS: TerrainModelSpec[] = [
  {
    id: "rocky-mountain",
    label: "ROCKY MOUNTAIN",
    inscription: "e4d98b1238facb936f24c57298b425869bf343c134fea33d862c57b4744efd42i0",
    cell: [-32, 34],
    span: 3.2,
    yaw: 0.4,
  },
  {
    id: "green-mountain",
    label: "GREEN MOUNTAIN",
    inscription: "16957e91d9a75779ae558998cf1b98ef1258095c94fad8cb5ea8802b1e80d7b2i0",
    cell: [30, 28],
    span: 2.8,
    yaw: -0.9,
  },
  {
    id: "green-mountain-shore",
    label: "GREEN MOUNTAIN SHORE",
    inscription: "db35b207b9a173e01e9d63ffbb81f27df651ea0f3538382d7305d6dc12ca8ceci0",
    cell: [-34, -24],
    span: 2.4,
    yaw: 1.8,
  },
  {
    id: "green-hill",
    label: "GREEN HILL",
    inscription: "c0706037ac9ba2b2b15f227b5cda727cd85175b635de6ad19324e65bf96c1dadi0",
    cell: [22, -20],
    span: 1.6,
    yaw: -0.3,
  },
  {
    id: "green-hill-beach",
    label: "GREEN HILL BEACH",
    inscription: "4da063cec2b236154a76f970621c9803767c75c6e0dccaaff4d82e4342c23254i0",
    cell: [-20, 18],
    span: 1.5,
    yaw: 2.6,
  },
];

/** A landform's spot in world units. */
export function terrainModelSpot(spec: TerrainModelSpec) {
  return {
    x: PLAZA.x + spec.cell[0] * WORLD_CELL,
    z: PLAZA.z + spec.cell[1] * WORLD_CELL,
  };
}

/** A sampled top surface: a square height grid centred on the landform. */
type Surface = {
  x: number;
  z: number;
  /** half width of the sampled square, in world units */
  half: number;
  res: number;
  /** height above the landform's base, row-major, `res * res` samples */
  heights: Float32Array;
};

const surfaces = new Map<string, Surface>();

let version = 0;
const listeners = new Set<() => void>();

export function terrainModelsVersion() {
  return version;
}

export function subscribeTerrainModels(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function bump() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Publish a landform's walkable top surface. */
export function registerTerrainModelSurface(id: string, surface: Surface) {
  surfaces.set(id, surface);
  bump();
}

export function dropTerrainModelSurface(id: string) {
  if (surfaces.delete(id)) bump();
}

/** True while at least one landform surface is live. */
export function terrainModelsLoaded() {
  return surfaces.size;
}

function sample(surface: Surface, x: number, z: number) {
  const span = surface.half * 2;
  const fx = ((x - surface.x + surface.half) / span) * (surface.res - 1);
  const fz = ((z - surface.z + surface.half) / span) * (surface.res - 1);
  if (fx < 0 || fz < 0 || fx > surface.res - 1 || fz > surface.res - 1) return 0;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const at = (ci: number, cj: number) => {
    const col = ci < 0 ? 0 : ci > surface.res - 1 ? surface.res - 1 : ci;
    const row = cj < 0 ? 0 : cj > surface.res - 1 ? surface.res - 1 : cj;
    return surface.heights[row * surface.res + col] ?? 0;
  };
  const a = at(i, j);
  const b = at(i + 1, j);
  const c = at(i, j + 1);
  const d = at(i + 1, j + 1);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/**
 * Walkable height of the tallest landform covering a point, or `-Infinity`
 * when no landform stands there. `baseAt` gives the plain terrain height, which
 * is where each landform's base rests.
 */
export function terrainModelTop(
  x: number,
  z: number,
  baseAt: (x: number, z: number) => number,
) {
  let top = -Infinity;
  for (const surface of surfaces.values()) {
    if (
      x < surface.x - surface.half ||
      x > surface.x + surface.half ||
      z < surface.z - surface.half ||
      z > surface.z + surface.half
    ) continue;
    const lift = sample(surface, x, z);
    if (lift <= 0) continue;
    const y = baseAt(surface.x, surface.z) + lift;
    if (y > top) top = y;
  }
  return top;
}
