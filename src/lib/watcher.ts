/**
 * Client-safe types for the real-chain trade watcher. The watcher itself runs
 * server-side in `watcher.server.ts`; only these shapes cross the boundary.
 */

export type WatchEvent = {
  bitmapHeight: number;
  inscriptionId: string | null;
  /** Transaction that moved the inscription satoshi. */
  txid: string;
  sellerAddress: string | null;
  buyerAddress: string | null;
  priceSats: number;
  blockHeight: number | null;
  blockTime: string | null;
  hop: number;
  /** A payment back to the previous holder was found in the same transaction. */
  isSale: boolean;
};

export type WatchResult = {
  watched: number;
  /** Parcels whose holding output turned out to be spent. */
  spends: number;
  /** Transfers that were not in the registry before this pass. */
  events: WatchEvent[];
  savedTrades: number;
  closedOffers: number;
  checkedAt: string;
};
