/**
 * Client-safe types for the settlement watcher. The watcher runs server-side in
 * `settlement-watcher.server.ts`; only these shapes cross the RPC boundary.
 */

export type SettlementEventKind =
  /** The buyer's transaction spent the reveal output and is confirmed. */
  | "settled"
  /** The spend is in the mempool but not mined yet. */
  | "pending"
  /** A buyer PSBT exists but nothing has hit the chain yet. */
  | "awaiting-broadcast";

export type SettlementEvent = {
  offerId: string;
  bitmapHeight: number | null;
  inscriptionId: string | null;
  outpoint: string;
  kind: SettlementEventKind;
  /** Transaction that spent the offer's inscription output, when known. */
  spendingTxid: string | null;
  confirmedHeight: number | null;
  sellerAddress: string | null;
  /** Holder resolved by re-tracing the inscription satoshi after the spend. */
  ownerAddress: string | null;
  askPriceSats: number;
  /** Price actually paid on chain, when a payment back to the seller was found. */
  salePriceSats: number | null;
  transfers: number;
  note: string;
};

export type SettlementWatchResult = {
  watched: number;
  settled: number;
  pending: number;
  savedTrades: number;
  events: SettlementEvent[];
  checkedAt: string;
};
