/**
 * Bakes a block's on-chain Guardian blueprint into the compact byte form the
 * BWVX_ASM renderer reads: [paletteCount, r,g,b…] then 10 bytes per voxel
 * [x,y,z (int8 ×4), w,h,d (uint8 ×4), colourIdx, glow×20, part, phase×40].
 */
import type { GuardianDna } from "@/lib/bitmon";
import { blueprint, onchainGenome } from "@/lib/onchain-guardian";

const TAU = Math.PI * 2;
const s8 = (v: number) => (Math.max(-127, Math.min(127, Math.round(v * 4))) + 256) % 256;
const u8 = (v: number, k: number) => Math.max(0, Math.min(255, Math.round(v * k)));

export function bakeGuardian(dna: GuardianDna): string {
  const V = blueprint(onchainGenome(dna));
  const pal: string[] = [];
  const idx = (c: string) => { const h = c.toLowerCase(); let i = pal.indexOf(h); if (i < 0) { pal.push(h); i = pal.length - 1; } return i; };
  const body: number[] = [];
  for (const v of V) {
    const c = idx(v[6]);
    if (c > 255) continue;
    body.push(s8(v[0]), s8(v[1]), s8(v[2]), u8(v[3], 4), u8(v[4], 4), u8(v[5], 4), c, u8(v[7], 20), v[8], u8(((v[9] % TAU) + TAU) % TAU, 40));
  }
  const head = [pal.length];
  for (const h of pal) { const n = parseInt(h.slice(1, 7), 16); head.push((n >> 16) & 255, (n >> 8) & 255, n & 255); }
  let s = "";
  for (const b of [...head, ...body]) s += String.fromCharCode(b);
  return btoa(s);
}
