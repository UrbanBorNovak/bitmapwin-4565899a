import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChainTrade, TradeTrace } from "@/lib/trades";

/**
 * Persistence for real on-chain bitmap trades. Rows only ever come from traced
 * Bitcoin transactions — nothing here is synthetic.
 */

export type TradeRow = {
  txid: string;
  bitmap_height: number;
  inscription_id: string | null;
  seller_address: string | null;
  buyer_address: string | null;
  price_sats: number;
  block_height: number | null;
  block_time: string | null;
  hop: number;
  created_at: string;
};

function toRow(trade: ChainTrade) {
  return {
    txid: trade.txid,
    bitmap_height: trade.bitmapHeight,
    inscription_id: trade.inscriptionId,
    seller_address: trade.sellerAddress,
    buyer_address: trade.buyerAddress,
    price_sats: trade.priceSats,
    block_height: trade.blockHeight,
    block_time: trade.blockTime,
    hop: trade.hop,
  };
}

/** Upserts every traced transfer, keyed by its Bitcoin transaction id. */
export async function saveTrades(traces: TradeTrace[]): Promise<number> {
  const rows = traces.flatMap((trace) => trace.trades.map(toRow));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("trades").upsert(rows, { onConflict: "txid" });
  if (error) throw error;
  return rows.length;
}

function normalise(rows: TradeRow[] | null): TradeRow[] {
  return (rows ?? []).map((row) => ({ ...row, price_sats: Number(row.price_sats) }));
}

export async function fetchTradesForHeights(heights: number[]): Promise<TradeRow[]> {
  if (heights.length === 0) return [];
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .in("bitmap_height", heights)
    .order("hop", { ascending: true });
  if (error) throw error;
  return normalise(data as TradeRow[] | null);
}

export async function fetchTradesForHeight(height: number): Promise<TradeRow[]> {
  return fetchTradesForHeights([height]);
}

export async function fetchRecentTrades(limit = 60): Promise<TradeRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("block_height", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return normalise(data as TradeRow[] | null);
}

/** Latest transfer per bitmap height (highest hop wins). */
export function latestByHeight(rows: TradeRow[]): Map<number, TradeRow> {
  const map = new Map<number, TradeRow>();
  for (const row of rows) {
    const current = map.get(row.bitmap_height);
    if (!current || row.hop > current.hop) map.set(row.bitmap_height, row);
  }
  return map;
}

/** Latest transfer that actually paid the seller (a sale, not a plain move). */
export function latestSaleByHeight(rows: TradeRow[]): Map<number, TradeRow> {
  const map = new Map<number, TradeRow>();
  for (const row of rows) {
    if (row.price_sats <= 0) continue;
    const current = map.get(row.bitmap_height);
    if (!current || row.hop > current.hop) map.set(row.bitmap_height, row);
  }
  return map;
}

export const tradesForHeightQuery = (height: number) =>
  queryOptions({
    queryKey: ["trades", "height", height],
    queryFn: () => fetchTradesForHeight(height),
    staleTime: 30_000,
  });

export const recentTradesQuery = (limit = 60) =>
  queryOptions({
    queryKey: ["trades", "recent", limit],
    queryFn: () => fetchRecentTrades(limit),
    staleTime: 30_000,
  });

/** Distinct bitmap heights that have a real traced on-chain transfer. */
export async function fetchTradedBitmapCount(): Promise<number> {
  const { data, error } = await supabase.from("trades").select("bitmap_height");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.bitmap_height)).size;
}

export const tradedBitmapCountQuery = () =>
  queryOptions({
    queryKey: ["trades", "traded-count"],
    queryFn: fetchTradedBitmapCount,
    staleTime: 120_000,
  });
