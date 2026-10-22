/** Toon stage collisions (stage units): characters are circles, voxel furniture is floor footprints. */
export type Body = { x: number; z: number; r: number };
export type Foot = { x: number; z: number; w: number; d: number };
export const ACTOR_R = 2.4;

/** Push (x, z) out of every other body and every footprint so it never overlaps them. */
export function separate(x: number, z: number, r: number, bodies: Iterable<Body>, foots: Foot[]): [number, number] {
  const list = [...bodies];
  for (let k = 0; k < 4; k++) {
    for (const b of list) {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz), min = r + b.r;
      if (d >= min) continue;
      if (d < 1e-6) { x += min; continue; }
      x += (dx / d) * (min - d); z += (dz / d) * (min - d);
    }
    for (const f of foots) {
      const hx = f.w / 2 + r, hz = f.d / 2 + r, ox = hx - Math.abs(x - f.x), oz = hz - Math.abs(z - f.z);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) x += Math.sign(x - f.x || 1) * ox; else z += Math.sign(z - f.z || 1) * oz;
    }
  }
  return [x, z];
}

export function overlaps(x: number, z: number, r: number, bodies: Iterable<Body>, foots: Foot[]): boolean {
  for (const b of bodies) if (Math.hypot(x - b.x, z - b.z) < r + b.r) return true;
  return foots.some((f) => Math.abs(x - f.x) < f.w / 2 + r && Math.abs(z - f.z) < f.d / 2 + r);
}

/** Floor footprints of the named voxel film sets (matches BiternamSets geometry). */
export const SET_FOOTPRINTS: Record<string, Foot[]> = {
  cafe: [{ x: 5, z: -18, w: 51, d: 9 }, { x: -38, z: 10, w: 7, d: 22 }, { x: -28, z: 10, w: 9, d: 12 }, { x: 38, z: -20, w: 8, d: 6 },
    ...[-14, -2, 10, 22].map((x) => ({ x, z: -10, w: 4, d: 4 }))],
  batcave: [{ x: -8, z: -20, w: 30, d: 8 }, { x: -40, z: 4, w: 7, d: 12 }, { x: -32, z: 4, w: 7, d: 12 }],
  vault: [-36, -24, 24, 36].map((x) => ({ x, z: -8, w: 7, d: 7 })),
  chinatown: [{ x: -12, z: -24, w: 2, d: 2 }, { x: 12, z: -24, w: 2, d: 2 }],
};
