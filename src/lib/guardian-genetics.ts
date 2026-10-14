/**
 * Guardian pedigree breeding: a pure, deterministic crossover of two on-chain
 * Guardian genomes. The same sire + dam inscription ids always hatch the same pet,
 * so anyone can re-derive (and verify) an offspring from its inscribed metadata.
 */
import type { OnchainG } from "@/lib/onchain-guardian";

/** Fixed service tribute paid inside the pet's reveal transaction. */
export const PET_SERVICE_FEE = 546;
/** Pets stand at companion scale next to block Guardians. */
export const PET_SCALE = 0.45;

const SHAPES = ["quadruped", "hexapod", "serpent", "biped", "avian", "floater", "arachnid", "centaur"] as const;
const RANK = { COMMON: 0, RARE: 1, EPIC: 2, MYTHIC: 3 } as const;
const RANKS = ["COMMON", "RARE", "EPIC", "MYTHIC"] as const;

function h32(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** Hue (0–359) of an `hsl(h,…)` or hex colour. */
export function hueOf(c: string): number {
  const m = /hsl\(\s*(-?\d+(?:\.\d+)?)/i.exec(c);
  if (m) return ((Math.round(Number(m[1])) % 360) + 360) % 360;
  const hex = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!hex) return 0;
  const n = parseInt(hex[1]!, 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((Math.round(h * 60) % 360) + 360) % 360;
}

/** Shortest-arc blend of two hues. */
export function blendHue(a: number, b: number, k: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return ((Math.round(a + d * k) % 360) + 360) % 360;
}

export type PetParent = { inscriptionId: string; height: number; genome: OnchainG; gen?: number };

export type PetGenome = OnchainG & {
  gen: number;
  chimera: boolean;
  mutations: string[];
  /** Share of traits that came straight from one parent (0–100). */
  purity: number;
  hue: number;
  hue2: number;
};

/** Mendelian allele: both carry → 95%, one carries → 50%, neither → 4% mutation. */
function allele(a: boolean, b: boolean, r: () => number) {
  const p = a && b ? 0.95 : a || b ? 0.5 : 0.04;
  return { on: r() < p, mutated: !a && !b };
}

export function breedPet(sire: PetParent, dam: PetParent): PetGenome {
  if (sire.inscriptionId === dam.inscriptionId) throw new Error("A GUARDIAN CANNOT BREED WITH ITSELF");
  const r = rng(h32(sire.inscriptionId + ":" + dam.inscriptionId + ":GEN"));
  const S = sire.genome, D = dam.genome, mutations: string[] = [];
  let inherited = 0;

  // Body plan: 45% sire, 45% dam, 10% chimera (a third plan from both indices).
  const sr = r();
  let sh: OnchainG["sh"], chimera = false;
  if (sr < 0.45) { sh = S.sh; inherited++; }
  else if (sr < 0.9) { sh = D.sh; inherited++; }
  else {
    const i = SHAPES.indexOf(S.sh as never), j = SHAPES.indexOf(D.sh as never);
    sh = SHAPES[(Math.max(0, i) + Math.max(0, j) + 1) % SHAPES.length]!;
    chimera = true; mutations.push("CHIMERA PLAN");
  }

  // Pigment: blend toward a random point between parents, ±15° harmonic drift.
  const drift = () => Math.floor(r() * 31) - 15;
  const hue = (blendHue(hueOf(S.body), hueOf(D.body), r()) + drift() + 360) % 360;
  const hue2 = (blendHue(hueOf(S.accent), hueOf(D.accent), r()) + drift() + 360) % 360;

  const wing = allele(S.wing, D.wing, r), spine = allele(S.spine, D.spine, r), pat = allele(S.pat, D.pat, r);
  if (wing.on && wing.mutated) mutations.push("SPONTANEOUS WINGS");
  if (spine.on && spine.mutated) mutations.push("SPONTANEOUS SPINES");
  if (pat.on && pat.mutated) mutations.push("SPONTANEOUS MARKINGS");
  inherited += [wing, spine, pat].filter((x) => !x.mutated).length;

  // Horns follow the higher-rarity parent (ties: coin flip).
  const lead = RANK[S.ra] === RANK[D.ra] ? (r() < 0.5 ? S : D) : RANK[S.ra] > RANK[D.ra] ? S : D;
  let horn = lead.horn;
  if (r() < 0.08) { horn = (horn + 1) % 4; mutations.push("HORN SHIFT"); } else inherited++;

  // Rarity: the lower parent's rank, with a small chance to rise one step.
  let rank = Math.min(RANK[S.ra], RANK[D.ra]);
  if (r() < 0.12 && rank < 3) { rank++; mutations.push("RARITY ASCENT"); }

  const avg = (a: number, b: number) => (a + b) / 2;
  const traits = 6;
  return {
    h: sire.height,
    sh, ra: RANKS[rank]!,
    body: `hsl(${hue},62%,46%)`, accent: `hsl(${hue2},88%,58%)`,
    hue, hue2,
    seg: Math.max(3, Math.min(7, Math.round(avg(S.seg, D.seg)))),
    bulk: Math.max(0.85, Math.min(1.35, avg(S.bulk, D.bulk))),
    horn, wing: wing.on, spine: spine.on, pat: pat.on,
    gait: Math.min(1.6, avg(S.gait, D.gait) * 1.15),
    gen: Math.max(sire.gen ?? 0, dam.gen ?? 0) + 1,
    chimera, mutations,
    purity: Math.round((Math.min(inherited, traits) / traits) * 100),
  };
}

/** Compact on-chain metadata (Tag 5) — enough for anyone to re-derive the pet. */
export function petMetadata(sire: PetParent, dam: PetParent, pet: PetGenome) {
  return {
    p: "BITMAPWIN-PET",
    v: 1,
    g: pet.gen,
    sire: sire.inscriptionId,
    dam: dam.inscriptionId,
    sh: pet.sh,
    ra: pet.ra,
    c: [pet.hue, pet.hue2],
  };
}

/** Real per-trait odds for a pairing, read from the same rules breedPet uses. */
export function breedOdds(S: OnchainG, D: OnchainG) {
  const p = (a: boolean, b: boolean) => (a && b ? 0.95 : a || b ? 0.5 : 0.04);
  const ascent = Math.min(RANK[S.ra], RANK[D.ra]) < 3 ? 0.12 : 0;
  const chimera = 0.1;
  return {
    chimera, wings: p(S.wing, D.wing), spines: p(S.spine, D.spine), markings: p(S.pat, D.pat),
    hornShift: 0.08, rarityAscent: ascent,
    /** Jackpot = chimera body plan AND a rarity ascent in the same hatch. */
    jackpot: chimera * ascent,
  };
}
