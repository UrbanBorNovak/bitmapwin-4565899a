/**
 * Procedural creature genome. Pure: grown only from a block's public hash,
 * height, tx count and size, so the same BITMAP always yields the same design.
 * Goes beyond the 8 lore species: 8 body plans × parts × patterns × palettes.
 */
import { guardianFromBlock, type BlockDnaSource, type GuardianDna } from "@/lib/bitmon";
import { onchainGuardianName } from "@/lib/onchain-name";

export type BodyPlan = "QUADRUPED" | "HEXAPOD" | "SERPENT" | "BIPED" | "AVIAN" | "FLOATER" | "ARACHNID" | "CENTAUR";
export type HornStyle = "NONE" | "SPIKE" | "CURL" | "ANTLER" | "CROWN";
export type Pattern = "PLAIN" | "STRIPES" | "SPOTS" | "PLATES" | "CIRCUIT";

export type CreatureMorph = {
  height: number;
  seed: string;
  name: string;
  code: string;
  plan: BodyPlan;
  segments: number;
  bodyLen: number;
  bodyWide: number;
  bodyTall: number;
  legPairs: number;
  legLen: number;
  headSize: number;
  neckLen: number;
  eyes: number;
  horns: HornStyle;
  hornCount: number;
  wings: 0 | 2 | 4;
  wingSpan: number;
  tailSegs: number;
  spines: number;
  pattern: Pattern;
  primary: string;
  secondary: string;
  glow: string;
  gait: number;
};

const PLANS: BodyPlan[] = ["QUADRUPED", "HEXAPOD", "SERPENT", "BIPED", "AVIAN", "FLOATER", "ARACHNID", "CENTAUR"];
const HORNS: HornStyle[] = ["NONE", "SPIKE", "CURL", "ANTLER", "CROWN"];
const PATTERNS: Pattern[] = ["PLAIN", "STRIPES", "SPOTS", "PLATES", "CIRCUIT"];
const PREFIX = ["GLASS", "EMBER", "HASH", "RUST", "LUMEN", "MERKLE", "TAPROOT", "NONCE", "CINDER", "FROST", "SATOSHI", "ORPHAN", "WITNESS", "SIGIL", "DUNE", "ECHO"];
const CORE: Record<BodyPlan, string[]> = {
  QUADRUPED: ["STALKER", "HOUND", "RAM", "LYNX"],
  HEXAPOD: ["MANTID", "CRAWLER", "BEETLE", "WARDEN"],
  SERPENT: ["COIL", "LEVIATHAN", "ADDER", "WORM"],
  BIPED: ["SENTINEL", "RAPTOR", "KNIGHT", "OGRE"],
  AVIAN: ["ROC", "HARPY", "KESTREL", "PHOENIX"],
  FLOATER: ["WISP", "JELLY", "LANTERN", "SPECTRE"],
  ARACHNID: ["WEAVER", "TARANTULA", "SCUTTLER", "BROODMOTHER"],
  CENTAUR: ["CHAMPION", "HERALD", "LANCER", "OUTRIDER"],
};

/** Deterministic PRNG (mulberry32) seeded from the full block hash. */
function rng(seedHex: string) {
  let a = 0;
  for (let i = 0; i < seedHex.length; i += 8) a = (a ^ parseInt(seedHex.slice(i, i + 8) || "0", 16)) >>> 0;
  a = (a ^ Math.imul(seedHex.length, 0x9e3779b1)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function morphFromBlock(src: BlockDnaSource): CreatureMorph {
  return morphFromDna(guardianFromBlock(src));
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** The collection design of a Guardian: body plan from its block DNA, colours from its Guardian palette. */
export function morphFromDna(dna: GuardianDna): CreatureMorph {
  const hash = dna.dnaHash.toLowerCase();
  const src = { height: dna.height, hash, txCount: Math.pow(Math.max(0, dna.hp / 1.2 - 120) / 18, 2), size: Math.max(0, dna.armor - 10) * 50_000 };
  const r = rng(hash + src.height.toString(16));
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const range = (lo: number, hi: number) => lo + r() * (hi - lo);

  const plan = pick(PLANS);
  // Busy blocks grow longer bodies; big blocks grow bulk.
  const load = Math.min(1, Math.sqrt(Math.max(1, src.txCount)) / 70);
  const bulk = Math.min(1, src.size / 2_000_000);
  const legPairs =
    plan === "HEXAPOD" ? 3 : plan === "ARACHNID" ? 4 : plan === "CENTAUR" ? 2 : plan === "BIPED" || plan === "AVIAN" ? 1 : plan === "QUADRUPED" ? 2 : 0;
  const wings: 0 | 2 | 4 = plan === "AVIAN" ? 2 : plan === "SERPENT" || plan === "ARACHNID" ? 0 : r() < 0.12 ? 4 : r() < 0.28 ? 2 : 0;
  const horns = pick(HORNS);
  const prefix = pick(PREFIX);

  return {
    height: src.height,
    seed: hash.slice(-16),
    name: (() => { const local = `${prefix} ${pick(CORE[plan])}`; return dna.blockHash ? onchainGuardianName(dna.height, dna.blockHash) : local; })(),
    code: `${plan.slice(0, 3)}-${hash.slice(-6).toUpperCase()}`,
    plan,
    segments: plan === "SERPENT" ? 5 + Math.round(load * 5) : 1 + Math.round(load * 2),
    bodyLen: range(0.7, 1.1) + load * 0.4,
    bodyWide: range(0.35, 0.6) + bulk * 0.25,
    bodyTall: range(0.3, 0.5) + bulk * 0.2,
    legPairs,
    legLen: range(0.3, 0.6),
    headSize: range(0.26, 0.42),
    neckLen: plan === "CENTAUR" || plan === "BIPED" ? range(0.1, 0.25) : range(0, 0.3),
    eyes: 1 + Math.floor(r() * (plan === "ARACHNID" ? 6 : 4)),
    horns,
    hornCount: horns === "NONE" ? 0 : horns === "CROWN" ? 5 : 2,
    wings,
    wingSpan: range(0.6, 1.2),
    tailSegs: plan === "FLOATER" ? 4 + Math.floor(r() * 4) : Math.floor(r() * 6),
    spines: Math.floor(r() * 7),
    pattern: pick(PATTERNS),
    primary: dna.body,
    secondary: shade(dna.body, 0.55),
    glow: dna.accent,
    gait: range(1.2, 3),
  };
}
