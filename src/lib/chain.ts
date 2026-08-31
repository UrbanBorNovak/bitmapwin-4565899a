/** Shared, browser-safe types for real Bitcoin chain data. */

/** A plain-text `<height>.bitmap` inscription found on chain. */
export type BitmapClaim = {
  inscriptionId: string;
  claimedHeight: number;
  inscribedInBlock: number;
  /** true = first ever claim (valid), false = later duplicate, null = unverifiable here. */
  valid: boolean | null;
};

export type BitmapStatus = "valid" | "unclaimed" | "unknown";

export type ChainBlock = {
  height: number;
  hash: string;
  timestamp: number;
  txCount: number;
  size: number;
  weight: number;
  medianFee: number | null;
  miner: string | null;
  inscriptionCount: number;
  inscriptionCountIsMinimum: boolean;
  sampleInscriptions: string[];
  /** Bitmap theory status of THIS block's own `<height>.bitmap`. */
  bitmapStatus: BitmapStatus;
  bitmapInscriptionId: string | null;
  bitmapInscribedInBlock: number | null;
  /** Bitmap claims inscribed inside this block (may target older heights). */
  bitmapClaims: BitmapClaim[];
  scanWindow: { from: number; to: number };
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function shortId(id: string): string {
  return id.length <= 16 ? id : `${id.slice(0, 8)}…${id.slice(-6)}`;
}

export function timeAgoFromUnix(seconds: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - seconds * 1000) / 60000));
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours === 1 ? "" : "S"} AGO`;
  const days = Math.round(hours / 24);
  return `${days} DAY${days === 1 ? "" : "S"} AGO`;
}
