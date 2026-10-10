/**
 * FLORA SOLIDS — block-grown hedges, flowers and trees are real ground.
 * BlockFloraLayer registers every cube here; the walker stands on their tops
 * and slides along anything taller than a step.
 */
type Box = { x: number; z: number; h: number; y0: number; y1: number };

const CELL = 0.02;
const grid = new Map<string, Box[]>();
const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

export function setFloraSolids(boxes: Box[]) {
  grid.clear();
  for (const b of boxes) {
    const k = key(b.x, b.z);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(b);
  }
}

function near(x: number, z: number, r: number, fn: (b: Box) => void) {
  if (grid.size === 0) return;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const b of grid.get(`${cx + i},${cz + j}`) ?? [])
        if (Math.abs(x - b.x) < b.h + r && Math.abs(z - b.z) < b.h + r) fn(b);
}

/** Highest flora top under (x,z) reachable from `feet` (step-up allowed), or null. */
export function floraSurface(x: number, z: number, feet: number | null, stepUp: number): number | null {
  let best: number | null = null;
  near(x, z, 0, (b) => {
    if (feet != null && b.y1 > feet + stepUp) return;
    if (best == null || b.y1 > best) best = b.y1;
  });
  return best;
}

/** True when a flora cube taller than a step blocks the body. */
export function floraWallAt(x: number, z: number, feet: number, height: number, radius: number, stepUp: number) {
  let hit = false;
  near(x, z, radius, (b) => {
    if (!hit && b.y1 > feet + stepUp && b.y0 < feet + height) hit = true;
  });
  return hit;
}
