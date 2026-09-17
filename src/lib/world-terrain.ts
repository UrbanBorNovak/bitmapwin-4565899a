/**
 * WORLD TERRAIN — the land shape, derived from real BITMAP block activity.
 *
 * Every district's ground height comes from how busy its block actually was:
 * the transaction count in `block_stats` (real block data for heights
 * 0…839,999). Busy blocks stand up as mesas and ridges, quiet blocks stay flat
 * plain. The field is the sum of two scales:
 *
 *   • MACRO — one sample every 16 BITMAPs, interpolated. Broad highlands and
 *     basins, gentle enough to walk and drive up.
 *   • MICRO — per-BITMAP relief on top, so a single busy block still reads as
 *     its own rise inside a region.
 *
 * Elevation is authoritative for presentation and traversal: `groundY(x, z)` is
 * the surface every avatar, ride and camera sits on. Player physics keep `y` as
 * height ABOVE the ground, so jumping, flying and falling are unchanged — the
 * renderer adds the terrain under them.
 *
 * Real rows stream in around the player in batches; until a row has arrived (or
 * for heights beyond the dataset) a deterministic fallback keeps the land shape
 * identical on every client, so nobody ever stands on different ground.
 */

import { STRIDE, WORLD_CELL, WORLD_GRID, WORLD_UNITS } from "./player-state";
import { BLOCK_STATS_MAX_HEIGHT, fetchBlockStatsMany } from "./block-stats";
import { seaDepthAt } from "./world-sea";

/** Spacing of the broad-relief lattice, in BITMAPs. */
const MACRO = 10;
/**
 * Tallest broad highland, in world units. Kept to a handful of avatar strides:
 * high enough to read as real hills you climb, low enough that scenery standing
 * on the base plane still sits on the land.
 */
const MACRO_AMP = STRIDE * 2.2;
/** Extra rise a single busy BITMAP adds. */
const MICRO_AMP = STRIDE * 0.8;
/** How deep the sea floor drops below the water line. */
const SEA_DROP = STRIDE * 1.6;
/** Transaction count that counts as a fully busy block. */
const BUSY_TX = 3200;

/** Highest point the land ever reaches — used for shading and map ranges. */
export const MAX_RELIEF = MACRO_AMP + MICRO_AMP;

/** height → activity 0…1, real rows only. */
const real = new Map<number, number>();
/** heights we already asked for (present or known-missing) — never refetched. */
const asked = new Set<number>();

let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  for (const listener of listeners) listener();
}

export function terrainVersion() {
  return version;
}

export function subscribeTerrain(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How many real block rows the terrain is currently shaped by. */
export function terrainRowsLoaded() {
  return real.size;
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Stable pseudo-random 0…1 — identical on every client, forever. */
function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Stand-in activity for a district whose row has not arrived (or does not
 * exist). Later blocks trend busier, exactly like the real chain, so the
 * fallback blends into the real data instead of contradicting it.
 */
function fallbackActivity(height: number) {
  const era = clamp(height / 900_000, 0, 1);
  const noise = hash(height) * 0.55 + hash(Math.floor(height / MACRO) + 7.3) * 0.45;
  return clamp(0.18 + era * 0.42 + (noise - 0.5) * 0.5, 0, 1);
}

/** Real transaction count of a district, when the row has streamed in. */
export function districtActivity(height: number): number | null {
  return real.get(height) ?? null;
}

function activityOfCell(col: number, row: number) {
  const c = clamp(col, 0, WORLD_GRID - 1);
  const r = clamp(row, 0, WORLD_GRID - 1);
  const height = r * WORLD_GRID + c;
  return real.get(height) ?? fallbackActivity(height);
}

function macroActivity(mi: number, mj: number) {
  return activityOfCell(mi * MACRO, mj * MACRO);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function bilinear(
  fx: number,
  fz: number,
  sample: (i: number, j: number) => number,
) {
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = smooth(fx - i);
  const tz = smooth(fz - j);
  const a = sample(i, j);
  const b = sample(i + 1, j);
  const c = sample(i, j + 1);
  const d = sample(i + 1, j + 1);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/** Land relief 0…1 at a world point, before the sea is cut into it. */
export function reliefAt(x: number, z: number) {
  const fx = (x + WORLD_UNITS / 2) / WORLD_CELL - 0.5;
  const fz = z / WORLD_CELL - 0.5;
  const macro = bilinear(fx / MACRO, fz / MACRO, macroActivity);
  const micro = bilinear(fx, fz, activityOfCell);
  return clamp(macro * 0.78 + micro * 0.22, 0, 1);
}

/**
 * The surface height at a world point, in world units. Everything that stands
 * on the ground reads this — avatars, rides, props, the camera.
 */
export function groundY(x: number, z: number) {
  const fx = (x + WORLD_UNITS / 2) / WORLD_CELL - 0.5;
  const fz = z / WORLD_CELL - 0.5;
  const macro = bilinear(fx / MACRO, fz / MACRO, macroActivity);
  const micro = bilinear(fx, fz, activityOfCell);
  const land = macro * MACRO_AMP + micro * MICRO_AMP;
  // Water sits at zero: the sea bed dips under it and the shore eases down.
  const hit = seaDepthAt(x, z);
  const depth = hit ? clamp(hit.depth, 0, 1) : 0;
  return land * (1 - depth) - depth * SEA_DROP;
}

/** Uphill steepness 0…1 at a point, for shading and footing feedback. */
export function slopeAt(x: number, z: number) {
  const step = WORLD_CELL * 0.5;
  const dx = groundY(x + step, z) - groundY(x - step, z);
  const dz = groundY(x, z + step) - groundY(x, z - step);
  return clamp(Math.hypot(dx, dz) / (step * 2) / 1.2, 0, 1);
}

let inFlight = false;
let lastRequest = "";

/**
 * Stream the real block rows that shape the land around a point. Called as the
 * player moves; each call fetches at most one batch and only rows never asked
 * for before, so walking the world never re-hits the database.
 */
export async function requestTerrainAround(x: number, z: number, cells = 96) {
  if (inFlight) return;
  const col0 = Math.round((x + WORLD_UNITS / 2) / WORLD_CELL);
  const row0 = Math.round(z / WORLD_CELL);
  const key = `${Math.floor(col0 / 8)}:${Math.floor(row0 / 8)}`;
  if (key === lastRequest) return;

  const wanted: number[] = [];
  const push = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= WORLD_GRID || row >= WORLD_GRID) return;
    const height = row * WORLD_GRID + col;
    if (height > BLOCK_STATS_MAX_HEIGHT || asked.has(height)) return;
    asked.add(height);
    wanted.push(height);
  };

  // Broad lattice first: it carries the shape of the whole region.
  const mi = Math.round(col0 / MACRO);
  const mj = Math.round(row0 / MACRO);
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) push((mi + i) * MACRO, (mj + j) * MACRO);
  }
  // Then the districts you can actually see, every other cell.
  const half = Math.floor(cells / 2);
  for (let j = -half; j <= half; j += 2) {
    for (let i = -half; i <= half; i += 2) {
      if (wanted.length >= 900) break;
      push(col0 + i, row0 + j);
    }
    if (wanted.length >= 900) break;
  }

  lastRequest = key;
  if (wanted.length === 0) return;

  inFlight = true;
  try {
    const rows = await fetchBlockStatsMany(wanted.slice(0, 900));
    if (rows.size === 0) return;
    for (const [height, stats] of rows) {
      const activity = clamp(Math.log1p(stats.txCount) / Math.log1p(BUSY_TX), 0, 1);
      real.set(height, activity);
    }
    bump();
  } catch {
    // A failed batch just leaves those districts on the deterministic shape.
  } finally {
    inFlight = false;
  }
}
