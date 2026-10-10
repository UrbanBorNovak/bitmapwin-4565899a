/**
 * BLOCK FLORA — the living surface of each BITMAP, read straight from its block.
 *
 * Nothing here is stored or invented. Every value comes from public chain facts:
 *  - height → halving era → plant palette and archetype
 *  - transaction count → understory density (busy blocks are lush, sparse
 *    blocks are open meadow with one champion tree)
 *  - block hash (when known) → bloom colour and layout seed
 *  - chain age (tip − height) → maturity: a block grows for one year of
 *    Bitcoin time (52,560 blocks), visibly advancing every 144 blocks (~1 day)
 *
 * The same block always grows the same garden for everyone.
 */

export const BLOCKS_PER_DAY = 144;
/** One year of Bitcoin time from freshly mined to fully grown. */
export const FULL_FLORA_BLOCKS = BLOCKS_PER_DAY * 365;

export type FloraArchetype = "primordial" | "hardwood" | "alpine" | "orchard" | "bloom";

export type BlockFlora = {
  height: number;
  archetype: FloraArchetype;
  /** 0 → 1, chain-time maturity. */
  maturity: number;
  /** Whole Bitcoin days this BITMAP has been growing. */
  daysGrowing: number;
  /** 0 → 1 understory density from the block's transaction count. */
  density: number;
  /** Low-traffic blocks raise one large champion tree. */
  champion: boolean;
  leaf: string;
  leaf2: string;
  trunk: string;
  bloom: string;
  seed: number;
};

const ERA: Record<FloraArchetype, { leaf: string; leaf2: string; trunk: string }> = {
  primordial: { leaf: "#3f6b2e", leaf2: "#567d36", trunk: "#4a3220" },
  hardwood: { leaf: "#4f8a34", leaf2: "#6a9f3f", trunk: "#5a3d24" },
  alpine: { leaf: "#2f5a3a", leaf2: "#3f7048", trunk: "#4e3520" },
  orchard: { leaf: "#7fb24a", leaf2: "#93c25a", trunk: "#6b4a2c" },
  bloom: { leaf: "#6fae52", leaf2: "#8cc56a", trunk: "#5f4430" },
};

const BLOOMS = ["#f7931a", "#ffd166", "#ef476f", "#f4f1de", "#7ad7f0", "#c77dff", "#ff8fab", "#00f0ff"];

export function archetypeFor(height: number): FloraArchetype {
  if (height < 210_000) return "primordial";
  if (height < 420_000) return "hardwood";
  if (height < 630_000) return "alpine";
  if (height < 840_000) return "orchard";
  return "bloom";
}

export function floraMaturity(height: number, tip: number) {
  if (!tip || height > tip) return 0;
  const days = Math.floor((tip - height) / BLOCKS_PER_DAY);
  return Math.min(1, (days * BLOCKS_PER_DAY) / FULL_FLORA_BLOCKS);
}

function seedFrom(height: number, hash?: string | null) {
  if (hash && hash.length >= 8) {
    const v = Number.parseInt(hash.slice(-8), 16);
    if (Number.isFinite(v)) return v >>> 0;
  }
  return (Math.imul(height ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
}

export function floraFor(height: number, tip: number, txCount?: number | null, hash?: string | null): BlockFlora {
  const archetype = archetypeFor(height);
  const tones = ERA[archetype];
  const seed = seedFrom(height, hash);
  const tx = txCount ?? null;
  // log scale: 1 tx → 0, ~4,000 tx → 1
  const density = tx == null ? 0.45 : Math.max(0, Math.min(1, Math.log10(Math.max(1, tx)) / 3.6));
  const days = !tip || height > tip ? 0 : Math.floor((tip - height) / BLOCKS_PER_DAY);
  return {
    height,
    archetype,
    maturity: floraMaturity(height, tip),
    daysGrowing: days,
    density,
    champion: tx != null && tx <= 10,
    ...tones,
    bloom: BLOOMS[seed % BLOOMS.length]!,
    seed,
  };
}
