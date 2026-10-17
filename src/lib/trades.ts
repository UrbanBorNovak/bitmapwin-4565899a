import { formatInUnit, priceUnit } from "@/lib/price-unit";
/**
 * Real on-chain trade model. A "trade" is a confirmed Bitcoin transaction that
 * moved a bitmap's inscription satoshi from one holder to another. When the
 * spending transaction also pays the previous holder, that payment is the sale
 * price — this is the standard ordinal PSBT sale shape.
 */

export type ChainTrade = {
  /** Transaction that moved the inscription. */
  txid: string;
  bitmapHeight: number;
  inscriptionId: string | null;
  sellerAddress: string | null;
  buyerAddress: string | null;
  /** Sats paid to the previous holder in the same transaction (0 = plain transfer). */
  priceSats: number;
  blockHeight: number | null;
  /** ISO timestamp of the confirming block, when known. */
  blockTime: string | null;
  /** Transfer number, 1 = first move after the reveal. */
  hop: number;
};

export type TradeTrace = {
  bitmapHeight: number;
  /** Reveal transaction of the claim. */
  revealTxid: string;
  inscriptionId: string | null;
  /** Address currently holding the inscription satoshi. */
  ownerAddress: string | null;
  /** Number of confirmed transfers found. */
  transfers: number;
  trades: ChainTrade[];
};

export const SATS_PER_BTC = 100_000_000;

export function satsToBtc(sats: number | null | undefined): number | null {
  if (sats === null || sats === undefined || sats <= 0) return null;
  return sats / SATS_PER_BTC;
}

export function formatSats(sats: number | null | undefined): string {
  if (!sats || sats <= 0) return "TRANSFER (NO PAYMENT)";
  return formatInUnit(sats, priceUnit.effective(), priceUnit.usdRate());
}
