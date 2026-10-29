/**
 * Cartographic Luck: every BITMAP block owns one fixed Puzzle #71 slice,
 * slice = SHA-256("bitmapwin:puzzle71:cartographic:<height>") mod SLICE_COUNT.
 * Anyone can re-derive it; scouting it only earns a Jumbotron badge.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { SLICE_COUNT, SLICE_SIZE, sliceStart } from "@/lib/puzzle-pool";

export const MAX_BLOCK_HEIGHT = 2_000_000;
export const isBlockHeight = (h: unknown): h is number => Number.isSafeInteger(h) && (h as number) >= 0 && (h as number) <= MAX_BLOCK_HEIGHT;

export function cartographicSlice(height: number) {
  const d = sha256(new TextEncoder().encode(`bitmapwin:puzzle71:cartographic:${height}`));
  let n = 0n;
  for (const b of d) n = (n << 8n) | BigInt(b);
  const index = n % SLICE_COUNT;
  const start = sliceStart(index);
  return { index, startHex: start.toString(16), endHex: (start + SLICE_SIZE - 1n).toString(16) };
}
