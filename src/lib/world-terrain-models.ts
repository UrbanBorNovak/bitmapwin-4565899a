/**
 * TERRAIN MODELS — inscribed landforms that are part of the ground itself.
 *
 * Inscribed hills and mountains are distributed across the complete Oasis.
 * Unlike the inscribed buildings, these are not obstacles: once a model is
 * loaded, its top surface is sampled into a small height grid and registered
 * here, and `groundY` in `world-terrain` lifts the walkable surface to match.
 * That makes everything that reads the ground — avatars, rides, animals, trees,
 * grass, builds — sit and walk on the landform instead of passing through it.
 *
 * Positions are given in BITMAPS from the genesis plaza and the model height
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
  /**
   * Footprint width of the landform, in BITMAPS. Sizing by the ground it covers
   * rather than by height is what keeps a landform climbable: the model's own
   * proportions then decide how tall it stands, so a hill never turns into a
   * vertical wall you cannot walk up.
   */
  width: number;
  yaw: number;
  /** height-grid resolution — big landforms get a finer walk surface */
  res: number;
};

type Source = {
  key: string;
  label: string;
  inscription: string;
  /** "peak" landforms rise far out, "swell" ones ripple close to the plaza */
  kind: "peak" | "swell";
};

const SOURCES: Source[] = [
  {
    key: "rocky-mountain",
    label: "ROCKY MOUNTAIN",
    inscription: "e4d98b1238facb936f24c57298b425869bf343c134fea33d862c57b4744efd42i0",
    kind: "peak",
  },
  {
    key: "green-mountain",
    label: "GREEN MOUNTAIN",
    inscription: "16957e91d9a75779ae558998cf1b98ef1258095c94fad8cb5ea8802b1e80d7b2i0",
    kind: "peak",
  },
  {
    key: "green-mountain-shore",
    label: "GREEN MOUNTAIN SHORE",
    inscription: "db35b207b9a173e01e9d63ffbb81f27df651ea0f3538382d7305d6dc12ca8ceci0",
    kind: "peak",
  },
  {
    key: "green-hill",
    label: "GREEN HILL",
    inscription: "c0706037ac9ba2b2b15f227b5cda727cd85175b635de6ad19324e65bf96c1dadi0",
    kind: "swell",
  },
  {
    key: "green-hill-beach",
    label: "GREEN HILL BEACH",
    inscription: "4da063cec2b236154a76f970621c9803767c75c6e0dccaaff4d82e4342c23254i0",
    kind: "swell",
  },
];

/** Deterministic noise, so every player sees the same range of landforms. */
function rand(seed: number) {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Walk-grid resolution. One sample every couple of BITMAPS is enough for a
 * smooth slope once the grid is interpolated, and keeps the sampling cheap.
 */
function resFor(width: number) {
  return width >= 22 ? 40 : width >= 12 ? 32 : 24;
}

/**
 * Divide the full 1,000 × 1,000 BITMAP Oasis into broad territories and place
 * one varied landform in every territory. The old radial layout was centred on
 * the north-edge genesis plaza, which crowded every model into one tiny area
 * and even sent half of the ring outside the world. This field reaches from the
 * north approach to the far south and from the west wall to the east wall.
 *
 * Every source recurs throughout the field instead of being confined to a ring.
 * Fixed seeds keep every position, size and rotation permanent for all players.
 */
function layout(): TerrainModelSpec[] {
  // All inscribed landforms stand OUTSIDE the 1,000 × 1,000 BITMAP grid,
  // ringing it like a horizon: the grid (x -500..500, z 0..1000 from the
  // plaza) stays open for parcels, builds and Guardians.
  const out: TerrainModelSpec[] = [];
  const perSide = 16;
  const sides = 4;
  for (let side = 0; side < sides; side++) {
    for (let i = 0; i < perSide; i++) {
      const seed = 101 + side * perSide + i;
      const source = SOURCES[(seed * 3) % SOURCES.length] ?? SOURCES[0]!;
      const low = source.kind === "peak" ? 16 : 7;
      const high = source.kind === "peak" ? 30 : 14;
      const width = low + rand(seed * 9.3) * (high - low);
      // Keep the whole footprint beyond the grid edge.
      const gap = width / 2 + 8 + rand(seed * 5.7) * 40;
      const along = -540 + (1080 / perSide) * (i + 0.5) + (rand(seed * 3.1) - 0.5) * 30;
      let cell: [number, number];
      if (side === 0) cell = [Math.round(along), Math.round(-gap)];
      else if (side === 1) cell = [Math.round(along), Math.round(1000 + gap)];
      else if (side === 2) cell = [Math.round(-500 - gap), Math.round(500 + along)];
      else cell = [Math.round(500 + gap), Math.round(500 + along)];
      out.push({
        id: `${source.key}-${side}-${i}`,
        label: source.label,
        inscription: source.inscription,
        cell,
        width: Math.round(width * 100) / 100,
        yaw: rand(seed * 13.7) * Math.PI * 2,
        res: resFor(width),
      });
    }
  }
  return out;
}

/** Permanent landforms. Fixed cells: they never move for anybody, ever. */
export const TERRAIN_MODELS: TerrainModelSpec[] = layout();

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
