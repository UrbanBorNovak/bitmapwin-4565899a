/**
 * DMT Blueprint (BW-MATTER-1 draft lore): a suggested build style for a block,
 * read only from block facts with integer maths. It is a creative prompt for
 * Land Forge / Tiny Studio builders — it never changes any inscription or Guardian.
 */
import type { MatterInput, MatterProfile } from "@/lib/bw-matter";

export type EraTradition = { era: number; name: string; style: string; forms: string[]; palette: string[] };

export const ERA_TRADITIONS: EraTradition[] = [
  { era: 0, name: "PRIMORDIAL", style: "Megalithic & sacred", forms: ["Monolith", "Sun circle", "Altar shrine"], palette: ["#2b2b30", "#ffd700", "#f7931a", "#8a7f6a"] },
  { era: 1, name: "TRANSITION", style: "Metallurgic citadels", forms: ["Bastion", "Colonnade", "Refinery tower"], palette: ["#708090", "#b87333", "#3f8f7a", "#00e5ff"] },
  { era: 2, name: "REFRACTORY", style: "Prismatic spires & forges", forms: ["Prism spire", "Geode vault", "Kinetic forge"], palette: ["#00ffff", "#4f5b66", "#39ff14", "#ced0dd"] },
  { era: 3, name: "CRYSTALLINE", style: "Void gates & resonators", forms: ["Rift gate", "Resonator ring", "Hypercube"], palette: ["#14090c", "#f5f5f5", "#ff007f", "#7b1fa2"] },
  { era: 4, name: "SYNTHETIC", style: "Lattice arcologies & reactors", forms: ["Lattice arcology", "Plasma reactor", "Event horizon dome"], palette: ["#9ad1ff", "#ffb347", "#ff5ef0", "#111827"] },
];

export type Footprint = "SOLITARY MONOLITH" | "COURTYARD TEMPLE" | "TERRACED ZIGGURAT";

export type DmtBlueprint = {
  tradition: EraTradition;
  form: string;
  footprint: Footprint;
  terraces: number;
  /** Suggested ceiling in voxels on the 64³ canvas (8–60). */
  ceiling: number;
  core: string;
  palette: string[];
};

const CORES = ["Floating cube", "Open geode", "Burning hearth", "Hanging prism", "Sunken well", "Twin pillars", "Orb cradle", "Spiral stair"];

export function dmtBlueprint(b: MatterInput, m: MatterProfile): DmtBlueprint {
  const tradition = ERA_TRADITIONS[Math.min(m.era, ERA_TRADITIONS.length - 1)]!;
  const footprint: Footprint = b.txCount < 50 ? "SOLITARY MONOLITH" : b.txCount <= 1500 ? "COURTYARD TEMPLE" : "TERRACED ZIGGURAT";
  const terraces = Math.min(7, 1 + Math.floor(b.txCount / 500));
  const ceiling = Math.min(60, 8 + Math.floor(b.weight / 80_000));
  return {
    tradition,
    form: tradition.forms[m.stratum % 3]!,
    footprint,
    terraces,
    ceiling,
    core: CORES[b.nonce % 8]!,
    palette: [m.element.color, ...tradition.palette.slice(0, 3)],
  };
}
