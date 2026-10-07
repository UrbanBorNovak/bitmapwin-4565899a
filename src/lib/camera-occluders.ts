/**
 * Solid things the third-person camera must not sink into. VoxelTrees registers
 * each canopy as a vertical cylinder; the chase camera's spring arm shortens
 * whenever its line from the avatar would pass through one.
 */
export type Occluder = { x: number; z: number; r: number; bottom: number; top: number };

let occluders: Occluder[] = [];

export function setTreeOccluders(list: Occluder[]) {
  occluders = list;
}

/**
 * Fraction (0–1) of the segment from→to that stays clear of registered canopies.
 * Samples the segment, so it is cheap and good enough for a smoothed camera.
 */
export function clearFraction(
  fx: number, fy: number, fz: number,
  tx: number, ty: number, tz: number,
  pad: number,
): number {
  if (!occluders.length) return 1;
  const minX = Math.min(fx, tx) - pad, maxX = Math.max(fx, tx) + pad;
  const minZ = Math.min(fz, tz) - pad, maxZ = Math.max(fz, tz) + pad;
  const near: Occluder[] = [];
  for (const o of occluders) {
    if (o.x + o.r < minX || o.x - o.r > maxX || o.z + o.r < minZ || o.z - o.r > maxZ) continue;
    near.push(o);
  }
  if (!near.length) return 1;
  const STEPS = 16;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = fx + (tx - fx) * t, y = fy + (ty - fy) * t, z = fz + (tz - fz) * t;
    for (const o of near) {
      if (y < o.bottom - pad || y > o.top + pad) continue;
      const rr = o.r + pad;
      if ((x - o.x) ** 2 + (z - o.z) ** 2 < rr * rr) return Math.max(0, (i - 1) / STEPS);
    }
  }
  return 1;
}
