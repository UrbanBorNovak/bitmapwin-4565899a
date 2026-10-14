/**
 * Guardian name exactly as the on-chain Land Forge Master V2 (World++) prints it:
 * dnaOf() seeds xorshift from h32(hash+":"+height) and draws
 * score, hue, hue2 (2 draws), shape, then NAME_A, NAME_B.
 */
const NAME_A = ["VOID", "SOLAR", "OBSIDIAN", "GLASS", "CYBER", "ORPHAN", "EMBER", "FROST", "IRON", "HOLLOW"];
const NAME_B = ["WYRM", "GRYPHON", "BEHEMOTH", "PHANTOM", "RAM", "LEVIATHAN", "SENTINEL", "STALKER", "WARDEN", "SERAPH"];

function h32(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function onchainGuardianName(height: number, blockHash: string): string {
  const r = rng(h32(blockHash + ":" + height));
  r(); r(); r(); r(); // score, hue, hue2 (offset + spread)
  r(); // shape
  const a = NAME_A[Math.floor(r() * NAME_A.length)]!;
  const b = NAME_B[Math.floor(r() * NAME_B.length)]!;
  return `${a} ${b}`;
}
