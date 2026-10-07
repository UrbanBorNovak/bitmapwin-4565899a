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

import { useSyncExternalStore } from "react";
import { STRIDE, WORLD_CELL, WORLD_GRID, WORLD_UNITS } from "./player-state";
import { BLOCK_STATS_MAX_HEIGHT, fetchBlockStatsMany } from "./block-stats";
import { seaDepthAt } from "./world-sea";
import { subscribeTerrainModels, terrainModelTop } from "./world-terrain-models";

/** Spacing of the broad-relief lattice, in BITMAPs. */
const MACRO = 10;
/**
 * Tallest broad highland, in world units. Kept to a handful of avatar strides:
 * high enough to read as real hills you climb, low enough that scenery standing
 * on the base plane still sits on the land.
 */
const MACRO_AMP = STRIDE * 7.7;
/** Extra lift on the highest regions so polar ground reads as peaks. */
const PEAK_AMP = STRIDE * 4.5;
/** Dune ripple height across low desert ground. */
const DUNE_AMP = STRIDE * 1.1;
/** Extra rise a single busy BITMAP adds. */
const MICRO_AMP = STRIDE * 1.2;
/** How deep the sea floor drops below the water line. */
const SEA_DROP = STRIDE * 1.6;
/** Transaction count that counts as a fully busy block. */
const BUSY_TX = 3200;

/** Highest point the land ever reaches — used for shading and map ranges. */
export const MAX_RELIEF = MACRO_AMP * 1.12 + PEAK_AMP + MICRO_AMP;

/** height → activity 0…1, real rows only. */
const real = new Map<number, number>();
/** Heights whose real row has arrived, or was confirmed absent. */
const settled = new Set<number>();
/** Latest visible window, nearest cells first. Replaced as the player travels. */
let pending: number[] = [];
const pendingSet = new Set<number>();
const fetching = new Set<number>();

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

// An inscribed landform arriving changes the walk surface, so everything that
// stands on the ground rebuilds exactly as it does for new block rows.
subscribeTerrainModels(bump);

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
 * The plain block-shaped land, without the inscribed landforms on top. The
 * displaced terrain mesh draws this, so the sand never bulges up through an
 * inscribed hill.
 */
export function baseGroundY(x: number, z: number) {
  const fx = (x + WORLD_UNITS / 2) / WORLD_CELL - 0.5;
  const fz = z / WORLD_CELL - 0.5;
  const macro = bilinear(fx / MACRO, fz / MACRO, macroActivity);
  const micro = bilinear(fx, fz, activityOfCell);
  // Elevation profiles by region: high ground sharpens into peaks (polar),
  // low ground carries dune ripples (desert), mid ground stays rolling meadow.
  const peak = smooth(clamp((macro - 0.55) / 0.3, 0, 1));
  const lowland = 1 - smooth(clamp((macro - 0.22) / 0.2, 0, 1));
  const meadow = 1 - peak - lowland;
  const ripple = Math.sin(x * 6.3 + Math.sin(z * 2.7) * 2.2) * 0.5 + 0.5;
  const valley = Math.sin(x * 0.9 + 1.3) * Math.sin(z * 0.7 + 0.4);
  const land =
    macro * MACRO_AMP +
    peak * macro * macro * PEAK_AMP +
    lowland * ripple * ripple * DUNE_AMP +
    Math.max(0, meadow) * valley * MACRO_AMP * 0.12 +
    micro * MICRO_AMP;
  // Water sits at zero: the sea bed dips under it and the shore eases down.
  const hit = seaDepthAt(x, z);
  const depth = hit ? clamp(hit.depth, 0, 1) : 0;
  return Math.max(0, land) * (1 - depth) - depth * SEA_DROP;
}

/**
 * The surface height at a world point, in world units. Everything that stands
 * on the ground reads this — avatars, rides, props, the camera — including the
 * inscribed hills and mountains, which are walkable ground like any other.
 */
export function groundY(x: number, z: number) {
  const base = baseGroundY(x, z);
  const landform = terrainModelTop(x, z, baseGroundY);
  return landform > base ? landform : base;
}

/**
 * Shared liquid plane. Sea beds dip below this; boats and islands stay here.
 * Kept just above the base plane: low enough to sit inside the terrain cut,
 * but with enough separation to avoid flicker and remain visibly liquid.
 */
export function waterSurfaceY(_x?: number, _z?: number) {
  return STRIDE * 0.045;
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

async function drainTerrainQueue() {
  if (inFlight || pending.length === 0) return;
  const batch = pending.splice(0, 900);
  for (const height of batch) {
    pendingSet.delete(height);
    fetching.add(height);
  }

  inFlight = true;
  try {
    const rows = await fetchBlockStatsMany(batch);
    for (const height of batch) settled.add(height);
    for (const [height, stats] of rows) {
      const activity = clamp(Math.log1p(stats.txCount) / Math.log1p(BUSY_TX), 0, 1);
      real.set(height, activity);
    }
    if (rows.size > 0) bump();
  } catch {
    // Failed rows remain unsettled, so entering this region again can retry them.
  } finally {
    for (const height of batch) fetching.delete(height);
    inFlight = false;
    if (pending.length > 0) void drainTerrainQueue();
  }
}

/**
 * Stream the real block rows that shape the land around a point. Called as the
 * player moves. The complete visible window is queued nearest-first and drained
 * in bounded batches, so movement cannot drop a request while another is in
 * flight and every visible BITMAP eventually receives its real chain relief.
 */
export async function requestTerrainAround(x: number, z: number, cells = 96) {
  const col0 = Math.round((x + WORLD_UNITS / 2) / WORLD_CELL);
  const row0 = Math.round(z / WORLD_CELL);
  const key = `${Math.floor(col0 / 8)}:${Math.floor(row0 / 8)}`;
  if (key === lastRequest) return;

  const wanted: Array<{ height: number; distance: number }> = [];
  const wantedSet = new Set<number>();
  const push = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= WORLD_GRID || row >= WORLD_GRID) return;
    const height = row * WORLD_GRID + col;
    if (
      height > BLOCK_STATS_MAX_HEIGHT ||
      settled.has(height) ||
      fetching.has(height) ||
      wantedSet.has(height)
    ) return;
    wantedSet.add(height);
    wanted.push({ height, distance: Math.hypot(col - col0, row - row0) });
  };

  // Broad lattice first: it carries the shape of the whole region.
  const mi = Math.round(col0 / MACRO);
  const mj = Math.round(row0 / MACRO);
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) push((mi + i) * MACRO, (mj + j) * MACRO);
  }
  // Then every visible BITMAP. Real terrain no longer skips alternating cells.
  const half = Math.floor(cells / 2);
  for (let j = -half; j <= half; j += 1) {
    for (let i = -half; i <= half; i += 1) push(col0 + i, row0 + j);
  }

  lastRequest = key;
  wanted.sort((a, b) => a.distance - b.distance);

  // Replace stale queued work with the latest visible window. The active batch
  // is allowed to finish; everything else now follows the player.
  pending = [];
  pendingSet.clear();
  for (const item of wanted) {
    if (settled.has(item.height) || fetching.has(item.height) || pendingSet.has(item.height)) continue;
    pending.push(item.height);
    pendingSet.add(item.height);
  }
  await drainTerrainQueue();
}


/**
 * Re-render on every change to the land shape — a streamed block row or an
 * inscribed landform registering its slopes. Scenery that reads `groundY` while
 * it renders uses this, so trees, flowers, shrooms and props climb onto a hill
 * the moment that hill becomes ground instead of staying on the old flat plain.
 */
export function useTerrainVersion() {
  return useSyncExternalStore(subscribeTerrain, terrainVersion, terrainVersion);
}
