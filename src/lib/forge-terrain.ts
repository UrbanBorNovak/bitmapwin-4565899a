/**
 * LAND FORGE — decorative land masses under the build canvas.
 * Three terrain types, deterministic per BITMAP height. Purely visual:
 * they cost no voxels and are never inscribed — the buildable floor
 * always stays flat at y = 0 so every build reads the same on-chain.
 */

export type LandMass = "flat" | "island" | "mesa";

export const LAND_MASSES: { id: LandMass; name: string; blurb: string }[] = [
  { id: "flat", name: "FLATLAND", blurb: "The classic open plain. Maximum room, nothing in the way." },
  { id: "island", name: "ISLAND", blurb: "Your BITMAP rises out of the water, sloping down to a shoreline." },
  { id: "mesa", name: "MESA", blurb: "Stepped rock terraces around a high flat plateau, seeded by your block." },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Terrain surface height at cell (x, z) in 0..span-1 coordinates.
 * Always <= 0: the buildable floor at y = 0 is never raised, so builds
 * keep their exact on-chain footprint on every land mass.
 */
export function terrainHeight(mass: LandMass, x: number, z: number, height: number, span: number): number {
  if (mass === "flat") return 0;
  const cx = span / 2, cz = span / 2;
  const dx = (x + 0.5 - cx) / cx, dz = (z + 0.5 - cz) / cz;
  const d = Math.sqrt(dx * dx + dz * dz); // 0 centre → ~1.41 corner
  if (mass === "island") {
    // Flat top out to 62% of the radius, then a smooth beach falling
    // 5 blocks below the floor; beyond the canvas edge is open water.
    const shore = 0.62, deep = 1.05;
    if (d <= shore) return 0;
    const t = smooth(Math.min(1, (d - shore) / (deep - shore)));
    return -5 * t;
  }
  // mesa: deterministic terraces — a high flat core, then blocky steps
  // downward, with the step widths varied by the block's own seed.
  const rand = rng(Math.imul(height ^ 0x51ed, 2654435761));
  const step0 = 0.34 + rand() * 0.08; // plateau edge
  const stepW = 0.10 + rand() * 0.06; // terrace width
  if (d <= step0) return 0;
  const steps = Math.min(4, Math.floor((d - step0) / stepW) + 1);
  return -steps;
}
