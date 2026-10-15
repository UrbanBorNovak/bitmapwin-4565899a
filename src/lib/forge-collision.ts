/**
 * Walkable Land Forge builds: the inscribed build shown in the Oasis registers
 * its blocks here so feet stand on floors/roofs and tall blocks act as walls.
 */
import { FORGE_SPAN } from "./voxel-populate";

type Build = { ox: number; oy: number; oz: number; unit: number; span: number; cols: Map<number, number[]> };
let active: Build | null = null;

const key = (x: number, z: number) => x * 4096 + z;

export function setForgeCollision(
  blocks: { dx: number; dy: number; dz: number }[] | null,
  origin?: [number, number, number],
  unit?: number,
  span: number = FORGE_SPAN,
) {
  if (!blocks?.length || !origin || !unit) { active = null; return; }
  const cols = new Map<number, number[]>();
  for (const b of blocks) {
    const k = key(b.dx, b.dz);
    const c = cols.get(k);
    if (c) c.push(b.dy); else cols.set(k, [b.dy]);
  }
  for (const c of cols.values()) c.sort((a, b) => a - b);
  active = { ox: origin[0], oy: origin[1], oz: origin[2], unit, span, cols };
}

function column(wx: number, wz: number) {
  if (!active) return null;
  const cx = Math.floor((wx - active.ox) / active.unit + active.span / 2 + 0.5);
  const cz = Math.floor((wz - active.oz) / active.unit + active.span / 2 + 0.5);
  return active.cols.get(key(cx, cz)) ?? null;
}

/** Top of the highest block whose top is reachable from `feetY` (null = no build here). */
export function forgeSurfaceAt(wx: number, wz: number, feetY: number | null, stepUp: number): number | null {
  const col = column(wx, wz);
  if (!col || !active) return null;
  const limit = feetY == null ? Infinity : feetY + Math.max(stepUp, active.unit * 1.05);
  let best: number | null = null;
  for (const y of col) {
    const top = active.oy + (y + 1) * active.unit;
    if (top <= limit) best = top; else break;
  }
  return best;
}

/** True when a build block blocks the body between knee and head height. */
export function forgeWallAt(wx: number, wz: number, feetY: number, height: number): boolean {
  const col = column(wx, wz);
  if (!col || !active) return false;
  const lo = feetY + active.unit * 1.05;
  const hi = feetY + height;
  for (const y of col) {
    const bottom = active.oy + y * active.unit;
    const top = bottom + active.unit;
    if (top > lo && bottom < hi) return true;
  }
  return false;
}
