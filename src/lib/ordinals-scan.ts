/** Browser-safe types for inscriptions scanned directly from the chain. */

export type ChainInscription = {
  /** `<txid>i<n>` */
  id: string;
  txid: string;
  inputIndex: number;
  blockHeight: number;
  contentType: string | null;
  bodyBytes: number;
  /** Present only for small text payloads. */
  bodyText: string | null;
  isBitmapClaim: boolean;
  bitmapHeight: number | null;
};

export type ScannedBlock = {
  height: number;
  hash: string;
  timestamp: number;
  txCount: number;
  /** How many transactions of the block were actually scanned. */
  scannedTxCount: number;
  /** Real per-transaction vsizes of the scanned transactions (drives the render). */
  vsizes: number[];
  inscriptions: ChainInscription[];
};

/** `<height>.bitmap` and nothing else. */
export function parseBitmapText(text: string | null): number | null {
  if (!text) return null;
  const match = /^(0|[1-9][0-9]*)\.bitmap$/.exec(text.trim());
  return match ? Number(match[1]) : null;
}
