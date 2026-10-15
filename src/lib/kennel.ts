/**
 * On-demand Guardian kennels: a BITMAP holder opens a kennel whose supply is
 * capped by the block's real transaction count. Nothing is pre-inscribed — each
 * pup is derived from (parent genome, block height, pup index) and inscribed only
 * when a buyer pays, with the holder's price paid inside the reveal transaction.
 */
import type { OnchainG } from "@/lib/onchain-guardian";
import { hueOf, type PetGenome } from "@/lib/guardian-genetics";

export const KENNEL_MIN_PRICE = 1_000;
export const KENNEL_MAX_PRICE = 1_000_000;
/** Site service output paid in every pup reveal, beside the holder's price. */
export const KENNEL_SITE_FEE = 546;

/** Supply equals the block's transaction count — never more. */
export function kennelSupply(txCount: number): number {
  return Math.max(0, Math.floor(txCount));
}

export function validKennelPrice(sats: number): boolean {
  return Number.isInteger(sats) && sats >= KENNEL_MIN_PRICE && sats <= KENNEL_MAX_PRICE;
}

function h32(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** Deterministic pup #index of a block's Guardian: same inputs, same pup, anywhere. */
export function kennelPup(parent: OnchainG, height: number, index: number): PetGenome {
  const r = rng(h32(`${height}:${index}:KENNEL`));
  const mutations: string[] = [];
  const hue = (hueOf(parent.body) + Math.floor(r() * 61) - 30 + 360) % 360;
  const hue2 = (hueOf(parent.accent) + Math.floor(r() * 61) - 30 + 360) % 360;
  const flip = (on: boolean, label: string) => { if (r() < 0.1) { mutations.push(label); return !on; } return on; };
  return {
    ...parent,
    h: height,
    body: `hsl(${hue},62%,46%)`, accent: `hsl(${hue2},88%,58%)`, hue, hue2,
    wing: flip(parent.wing, "WING SWAP"), spine: flip(parent.spine, "SPINE SWAP"), pat: flip(parent.pat, "MARKING SWAP"),
    bulk: Math.max(0.85, Math.min(1.35, parent.bulk * (0.9 + r() * 0.2))),
    gen: 1, chimera: false, mutations,
    purity: Math.round(((3 - mutations.length) / 3) * 100),
  };
}

export function kennelMetadata(height: number, index: number, parentInscription: string | null, pup: PetGenome) {
  return { p: "BITMAPWIN-KENNEL", v: 1, h: height, i: index, parent: parentInscription, sh: pup.sh, ra: pup.ra, c: [pup.hue, pup.hue2] };
}
