/**
 * OASIS AIRDROPS — a satellite pod falls on every real Bitcoin block.
 *
 * The impact site is derived from the mined block height and the region the
 * traveller is standing in, so everyone in that region races to the same
 * coordinate and the pod is always within reach. Progress is device-local;
 * BIT is only paid by the server, once per account per block.
 */
import { cellX, cellZ, WORLD_GRID } from "@/lib/player-state";

/** Region side, in BITMAPS. One pod per region per block. */
export const REGION = 32;

export type Airdrop = {
  /** Ledger key — one payout per account per key. */
  key: string;
  block: number;
  height: number;
  col: number;
  row: number;
  x: number;
  z: number;
  bit: number;
  xp: number;
};

function seed(a: number, b: number) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** The pod for this block, in the region containing (col,row). Null before a block is known. */
export function airdropFor(block: number, col: number, row: number): Airdrop | null {
  if (!Number.isFinite(block) || block <= 0) return null;
  const regionCol = Math.floor(col / REGION);
  const regionRow = Math.floor(row / REGION);
  const salt = regionCol * 7919 + regionRow * 104_729;
  const dropCol = Math.min(WORLD_GRID - 1, regionCol * REGION + Math.floor(seed(block, salt) * REGION));
  const dropRow = Math.min(WORLD_GRID - 1, regionRow * REGION + Math.floor(seed(block, salt + 13) * REGION));
  // Pods only land on mined land — never past the chain tip.
  let height = dropRow * WORLD_GRID + dropCol;
  if (height > block) height = Math.max(0, block - Math.floor(seed(block, salt + 17) * REGION * WORLD_GRID));
  const finalRow = Math.floor(height / WORLD_GRID);
  const finalCol = height % WORLD_GRID;
  const bit = 50 + Math.floor(seed(block, salt + 29) * 16) * 10; // 50 – 200 BIT
  return {
    key: `${block}:${regionCol}:${regionRow}`,
    block,
    height,
    col: finalCol,
    row: finalRow,
    x: cellX(finalCol),
    z: cellZ(finalRow),
    bit,
    xp: 150,
  };
}


const KEY = "bitmapwin:oasis-airdrops";

function readClaimed(): string[] {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isAirdropClaimed(key: string) {
  return readClaimed().includes(key);
}

export function markAirdropClaimed(key: string) {
  try {
    const next = [...readClaimed().filter((k) => k !== key), key].slice(-60);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* optional */
  }
}
