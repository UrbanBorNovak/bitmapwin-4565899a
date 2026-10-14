/**
 * Guardian genome exactly as the on-chain Master Delegate V7 (and World++) computes it:
 * dnaOf() seeds xorshift from h32(hash+":"+height) and draws in this order:
 * score, hue, hue2 spread, shape, NAME_A, NAME_B, hp, bite, speed, armor, horn, wing, spine, pat, gait.
 */
const SHAPES = ["quadruped", "hexapod", "serpent", "biped", "avian", "floater", "arachnid", "centaur"] as const;
const NAME_A = ["VOID", "SOLAR", "OBSIDIAN", "GLASS", "CYBER", "ORPHAN", "EMBER", "FROST", "IRON", "HOLLOW"];
const NAME_B = ["WYRM", "GRYPHON", "BEHEMOTH", "PHANTOM", "RAM", "LEVIATHAN", "SENTINEL", "STALKER", "WARDEN", "SERAPH"];

function h32(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export type V7Genome = {
  sh: (typeof SHAPES)[number]; ra: "COMMON" | "RARE" | "EPIC" | "MYTHIC"; nm: string;
  body: string; accent: string; seg: number; bulk: number; horn: number;
  wing: boolean; spine: boolean; pat: boolean; gait: number;
};

export function v7Genome(height: number, blockHash: string, txs: number, size: number): V7Genome {
  const r = rng(h32(blockHash + ":" + height));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const score = r();
  const ra = score > 0.97 ? "MYTHIC" : score > 0.88 ? "EPIC" : score > 0.65 ? "RARE" : "COMMON";
  const hue = Math.floor(r() * 360), hue2 = (hue + 90 + Math.floor(r() * 120)) % 360;
  const sh = pick(SHAPES);
  const nm = pick(NAME_A) + " " + pick(NAME_B);
  r(); r(); r(); r(); // hp, bite, speed, armor
  return {
    sh, ra, nm,
    body: `hsl(${hue},62%,46%)`, accent: `hsl(${hue2},88%,58%)`,
    seg: Math.max(3, Math.min(7, 3 + Math.floor(txs / 900))),
    bulk: Math.max(0.85, Math.min(1.35, 0.85 + size / 3000000)),
    horn: Math.floor(r() * 4), wing: r() > 0.7, spine: r() > 0.5, pat: r() > 0.4, gait: 0.7 + r() * 0.6,
  };
}

export function onchainGuardianName(height: number, blockHash: string): string {
  return v7Genome(height, blockHash, 0, 0).nm;
}
