/**
 * Walkable boxes: Inscribed World primitives drawn in the Oasis register their
 * world-space boxes here so feet stand on floors and roofs, and tall boxes act as walls.
 */
export type WorldBox = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

const groups = new Map<string, WorldBox[]>();

export function setBoxes(key: string, boxes: WorldBox[] | null) {
  if (boxes?.length) groups.set(key, boxes); else groups.delete(key);
}

function* under(x: number, z: number, r = 0) {
  for (const list of groups.values()) for (const b of list) {
    if (x >= b.x0 - r && x <= b.x1 + r && z >= b.z0 - r && z <= b.z1 + r) yield b;
  }
}

/** Top of the highest box whose top is reachable from `feetY` (null = no box here). */
export function boxSurfaceAt(x: number, z: number, feetY: number | null, stepUp: number, radius = 0): number | null {
  const limit = feetY == null ? Infinity : feetY + stepUp;
  let best: number | null = null;
  // `radius` is the foot stance: thin seams between slabs are bridged instead of dropped through.
  for (const b of under(x, z, radius)) if (b.y1 <= limit && (best == null || b.y1 > best)) best = b.y1;
  return best;
}

/** True when a box blocks the body (half-width `radius`) between step height and head height. */
export function boxWallAt(x: number, z: number, feetY: number, height: number, stepUp: number, radius = 0): boolean {
  const lo = feetY + stepUp, hi = feetY + height;
  for (const b of under(x, z, radius)) if (b.y1 > lo && b.y0 < hi) return true;
  return false;
}

/**
 * Nearest spot to (x, z) where the body is not embedded in a box, spiralling
 * outward ring by ring. Used right after spawning: structure models load after
 * the player is placed, so a spawn point can land inside one. Returns null when
 * everything within `maxRadius` is solid.
 */
export function clearSpotNear(
  x: number,
  z: number,
  feetY: number,
  height: number,
  stepUp: number,
  radius = 0,
  maxRadius = 0.02,
): [number, number] | null {
  if (!boxWallAt(x, z, feetY, height, stepUp, radius)) return [x, z];
  const step = Math.max(radius * 2, 0.002);
  for (let r = step; r <= maxRadius; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
      if (!boxWallAt(cx, cz, feetY, height, stepUp, radius)) return [cx, cz];
    }
  }
  return null;
}

/**
 * BLINK destination: try the full distance ahead, then shorter hops back
 * toward the caster, taking the first spot (or its nearest clear neighbour)
 * where the body is not embedded. Null = every hop is solid, so stay put.
 */
export function blinkTarget(
  x: number,
  z: number,
  yaw: number,
  distance: number,
  feetAt: (x: number, z: number) => number,
  height: number,
  stepUp: number,
  radius = 0,
  search = 0.02,
): [number, number] | null {
  for (let f = 1; f >= 0.25; f -= 0.25) {
    const tx = x + Math.sin(yaw) * distance * f;
    const tz = z + Math.cos(yaw) * distance * f;
    const spot = clearSpotNear(tx, tz, feetAt(tx, tz), height, stepUp, radius, search);
    if (spot) return spot;
  }
  return null;
}
