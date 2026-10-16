/**
 * SEA MASSES — the open water the boats belong on.
 *
 * The desert is broken up by inland seas, each roughly twenty by thirty
 * BITMAPS, never the same shape twice: the outline is an ellipse pushed in and
 * out by a couple of sine terms, so every coast reads differently. Everything
 * here is derived from the world seed, so every visitor sees the same water in
 * the same place without a byte of network traffic.
 *
 * Boats sail here and nowhere else; wheels and boots stop at the deep edge.
 */

import { WORLD_CELL, WORLD_UNITS } from "./player-state";

/** World units across one BITMAP (one district cell). */
const BITMAP = WORLD_CELL;

export type SeaMass = {
  id: number;
  /** centre in world units */
  x: number;
  z: number;
  /** half-width and half-depth in world units */
  rx: number;
  rz: number;
  /** outline wobble phase and amounts */
  phase: number;
  wob3: number;
  wob5: number;
};

/** Cheap deterministic hash in 0..1 — same value on every client, forever. */
function seed(n: number, salt: number) {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** How many inland seas the world carries. */
const SEA_COUNT = 44;

function buildSeas(): SeaMass[] {
  const seas: SeaMass[] = [];
  const half = WORLD_UNITS / 2;
  for (let i = 0; i < SEA_COUNT; i++) {
    // Roughly 20 x 30 BITMAPS, varied per sea so no two coasts match.
    const wide = (17 + seed(i, 1) * 11) * BITMAP;
    const deep = (25 + seed(i, 2) * 15) * BITMAP;
    const turned = seed(i, 3) > 0.5;
    const rx = (turned ? deep : wide) / 2;
    const rz = (turned ? wide : deep) / 2;
    const x = (seed(i, 4) * 2 - 1) * (half - rx - BITMAP * 4);
    const z = rz + BITMAP * 4 + seed(i, 5) * (WORLD_UNITS - (rz + BITMAP * 4) * 2);
    seas.push({
      id: i,
      x,
      z,
      rx,
      rz,
      phase: seed(i, 6) * Math.PI * 2,
      wob3: 0.08 + seed(i, 7) * 0.12,
      wob5: 0.03 + seed(i, 8) * 0.08,
    });
  }
  // Southern seas: the same coasts mirrored below the equator, so the
  // genesis districts have water in sight too.
  const north = seas.length;
  for (let i = 0; i < north; i++) {
    const src = seas[i]!;
    seas.push({ ...src, id: north + i, x: -src.x, z: -src.z, phase: src.phase + 1.3 });
  }
  return seas;
}

export const SEAS: SeaMass[] = buildSeas();

/** The wobbled radius of one sea at a bearing, in normalised units. */
export function seaRadiusAt(sea: SeaMass, angle: number) {
  return (
    1 +
    sea.wob3 * Math.sin(angle * 3 + sea.phase) +
    sea.wob5 * Math.sin(angle * 5 - sea.phase * 1.7)
  );
}

/**
 * How deep the water is under a point: 0 at the shoreline, 1 at the middle of
 * the sea, and null on dry land.
 */
export function seaDepthAt(x: number, z: number): { sea: SeaMass; depth: number } | null {
  for (const sea of SEAS) {
    const dx = (x - sea.x) / sea.rx;
    const dz = (z - sea.z) / sea.rz;
    const spread = Math.hypot(dx, dz);
    if (spread > 1.3) continue;
    const edge = seaRadiusAt(sea, Math.atan2(dz, dx));
    const ratio = spread / edge;
    if (ratio < 1) return { sea, depth: 1 - ratio };
  }
  return null;
}

/** Any water at all — this is where a boat may sail. */
export function isSea(x: number, z: number) {
  return seaDepthAt(x, z) !== null;
}

/** Past the wadeable shelf: no boots and no wheels beyond here. */
export function isDeepSea(x: number, z: number) {
  const hit = seaDepthAt(x, z);
  return hit !== null && hit.depth > 0.1;
}

/** Find the nearest dry point around a water-blocked spot. */
export function dryLandNear(x: number, z: number, radius: number, salt = 0) {
  if (!isSea(x, z)) return { x, z };
  const turns = 32;
  for (let i = 0; i < turns; i++) {
    const t = i / Math.max(1, turns - 1);
    const angle = salt * 1.618 + i * 2.399963;
    const distance = radius * (0.08 + t * 1.15);
    const px = x + Math.cos(angle) * distance;
    const pz = z + Math.sin(angle) * distance;
    if (!isSea(px, pz)) return { x: px, z: pz };
  }
  return null;
}

/** The closest sea and how far its water is, for pointing a sailor at it. */
export function nearestSea(x: number, z: number) {
  let best: SeaMass = SEAS[0]!;
  let bestDistance = Infinity;
  for (const sea of SEAS) {
    const distance = Math.hypot(x - sea.x, z - sea.z) - Math.max(sea.rx, sea.rz);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sea;
    }
  }
  return { sea: best, distance: Math.max(0, bestDistance) };
}

/** Outline of one sea as world-space XZ points, for drawing the surface. */
export function seaOutline(sea: SeaMass, segments = 72) {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const radius = seaRadiusAt(sea, angle);
    points.push([sea.x + Math.cos(angle) * sea.rx * radius, sea.z + Math.sin(angle) * sea.rz * radius]);
  }
  return points;
}
