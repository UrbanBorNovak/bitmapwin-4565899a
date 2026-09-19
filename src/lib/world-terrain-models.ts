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

function resFor(span: number) {
  return span >= 3 ? 56 : span >= 1.8 ? 40 : 28;
}

/**
 * Lay the landforms out as a range: gentle swells close in, taller peaks
 * further out, each ring turned a different way and sized differently. Fixed
 * seeds mean the whole range is permanent and identical for everybody.
 */
function layout(): TerrainModelSpec[] {
  const out: TerrainModelSpec[] = [];
  const taken: { cell: [number, number]; span: number }[] = [];
  // ring radius in BITMAPS, how many landforms sit on it, and their size band
  const rings: { radius: number; count: number; low: number; high: number; kind: Source["kind"] }[] = [
    { radius: 16, count: 6, low: 0.9, high: 1.5, kind: "swell" },
    { radius: 27, count: 8, low: 1.3, high: 2.2, kind: "swell" },
    { radius: 40, count: 9, low: 1.8, high: 3.4, kind: "peak" },
    { radius: 58, count: 10, low: 2.8, high: 5.4, kind: "peak" },
    { radius: 78, count: 8, low: 4, high: 7.5, kind: "peak" },
  ];

  let seed = 7;
  for (const ring of rings) {
    const pool = SOURCES.filter((source) => source.kind === ring.kind);
    for (let i = 0; i < ring.count; i++) {
      seed += 1;
      const wobble = (rand(seed * 3.1) - 0.5) * 0.6;
      const angle = (i / ring.count) * Math.PI * 2 + wobble;
      const reach = ring.radius * (0.86 + rand(seed * 5.7) * 0.32);
      const cell: [number, number] = [
        Math.round(Math.cos(angle) * reach),
        Math.round(Math.sin(angle) * reach),
      ];
      const span = ring.low + rand(seed * 9.3) * (ring.high - ring.low);
      // Keep landforms from growing into each other.
      const clash = taken.some((other) => {
        const dx = other.cell[0] - cell[0];
        const dz = other.cell[1] - cell[1];
        const gap = (other.span + span) * 0.75 + 3;
        return dx * dx + dz * dz < gap * gap;
      });
      if (clash) continue;
      const source = pool[i % pool.length] ?? SOURCES[0]!;
      taken.push({ cell, span });
      out.push({
        id: `${source.key}-${ring.radius}-${i}`,
        label: source.label,
        inscription: source.inscription,
        cell,
        span: Math.round(span * 100) / 100,
        yaw: rand(seed * 13.7) * Math.PI * 2,
        res: resFor(span),
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
