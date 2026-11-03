/**
 * BW-MATTER-1 (draft): a symbolic element for every Bitcoin block, read only
 * from block facts. Height picks the element (halving era × 8 strata of
 * 26,250 blocks); tx density picks the phase. Labels are app lore, not chemistry.
 */
export type MatterElement = { symbol: string; z: number; name: string; color: string; era: number };

export const ERA_NAMES = ["PRIMORDIAL AGE", "TRANSITION AGE", "REFRACTORY AGE", "CRYSTALLINE AGE"] as const;

const E = (symbol: string, z: number, name: string, color: string, era: number): MatterElement => ({ symbol, z, name, color, era });

export const BW_MATTER_TABLE: MatterElement[] = [
  E("Ae", 0, "Aetherium", "#ff9ff3", 0), E("Ch", 1, "Chronite", "#f7931a", 0), E("Au", 79, "Native Gold", "#ffd700", 0), E("El", 80, "Electrum", "#f0e68c", 0),
  E("Ad", 119, "Adamantite", "#3fe0d0", 0), E("Or", 120, "Orichalcum", "#ff7f50", 0), E("Cs", 121, "Celestite", "#b0e0e6", 0), E("Op", 122, "Nether-Opal", "#dda0dd", 0),
  E("Pt", 78, "Platinum", "#e5e4e2", 1), E("Ag", 47, "Silver", "#c0c0c0", 1), E("Cu", 29, "Copper", "#b87333", 1), E("Fe", 26, "Meteoric Iron", "#708090", 1),
  E("Co", 27, "Cobalt", "#0047ab", 1), E("Ni", 28, "Nickel", "#727472", 1), E("Bi", 83, "Bismuth", "#00e5ff", 1), E("Ti", 22, "Titanium", "#878787", 1),
  E("C", 6, "Diamond", "#00ffff", 2), E("W", 74, "Tungsten", "#4f5b66", 2), E("U", 92, "Uraninite", "#39ff14", 2), E("Pd", 46, "Palladium", "#ced0dd", 2),
  E("Os", 76, "Osmium", "#2f4f4f", 2), E("Ir", 77, "Iridium", "#a9a9a9", 2), E("Cr", 24, "Chromium", "#e6e8fa", 2), E("Mo", 42, "Molybdenum", "#556b2f", 2),
  E("Gr", 106, "Graphene", "#a0a0a0", 3), E("Si", 14, "Quartz", "#f5f5f5", 3), E("Ob", 107, "Obsidian", "#8b0000", 3), E("Te", 52, "Tellurium", "#8a9ea7", 3),
  E("Ge", 32, "Germanium", "#687178", 3), E("By", 108, "Beryl", "#50c878", 3), E("Fx", 109, "Flux-Alloy", "#ff007f", 3), E("Ty", 110, "Tachyonite", "#7b1fa2", 3),
];

export type MatterPhase = "AMORPHOUS ORE" | "POLYCRYSTALLINE INGOT" | "FLAWLESS CRYSTAL";

export type MatterInput = { height: number; txCount: number; size: number; weight: number; nonce: number };

export type MatterProfile = {
  index: number;
  era: number;
  stratum: number;
  element: MatterElement;
  sizeKB: number;
  /** Transactions per whole KB, ×100 integer (e.g. 244 = 2.44 TX/KB). */
  density100: number;
  phase: MatterPhase;
  hp: number;
  atk: number;
  def: number;
  /** Speed ×100 integer (100–170). */
  spd100: number;
};

export function eraOf(height: number) {
  return Math.min(3, Math.floor(height / 210_000));
}

export function stratumOf(height: number) {
  // The last era never wraps: everything from 813,750 up stays in stratum 7.
  return Math.min(7, Math.floor((height - eraOf(height) * 210_000) / 26_250));
}

export function matterIndex(height: number) {
  return eraOf(height) * 8 + stratumOf(height);
}

/** Integer-only derivation, identical on every client. */
export function deriveMatter(b: MatterInput): MatterProfile {
  const era = eraOf(b.height), stratum = stratumOf(b.height), index = era * 8 + stratum;
  const sizeKB = Math.max(1, Math.floor(b.size / 1024));
  const density100 = Math.floor((b.txCount * 100) / sizeKB);
  const phase: MatterPhase = density100 >= 250 ? "FLAWLESS CRYSTAL" : density100 >= 80 ? "POLYCRYSTALLINE INGOT" : "AMORPHOUS ORE";
  return {
    index, era, stratum, element: BW_MATTER_TABLE[index]!, sizeKB, density100, phase,
    hp: 120 + Math.min(2800, Math.floor((b.txCount * 22) / 10)),
    atk: 35 + Math.floor((density100 * 14) / 100),
    def: 40 + Math.floor(b.weight / 40_000) + era * 12,
    spd100: 100 + Math.floor(((b.nonce % 100) * 100) / 140),
  };
}

export const fmt100 = (n: number) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
