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
  // The data API caps every response at 1,000 rows, so page through the
  // (height-only) trade log until a short page says we have seen it all.
  const heights = new Set<number>();
  const PAGE = 1_000;
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await supabase
      .from("trades")
      .select("bitmap_height")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) heights.add(row.bitmap_height);
    if (!data || data.length < PAGE) break;
  }
  return heights.size;
}

export const tradedBitmapCountQuery = () =>
  queryOptions({
    queryKey: ["trades", "traded-count"],
    queryFn: fetchTradedBitmapCount,
    staleTime: 120_000,
  });

/** Exact count of confirmed paid sales — a real purchase, not a plain transfer. */
export async function fetchPaidSalesCount(): Promise<number> {
  const { count, error } = await supabase
    .from("trades")
    .select("txid", { count: "exact", head: true })
    .gt("price_sats", 0);
  if (error) throw error;
  return count ?? 0;
}

export const paidSalesCountQuery = () =>
  queryOptions({
    queryKey: ["trades", "paid-sales-count"],
    queryFn: fetchPaidSalesCount,
    staleTime: 120_000,
  });

/**
 * Every real paid sale (a traced transfer that paid the seller). Used by the
 * trend explorer to chart observed floor and average prices over time.
 */
export async function fetchPaidSales(): Promise<TradeRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .gt("price_sats", 0)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return normalise(data as TradeRow[] | null);
}

export const paidSalesQuery = () =>
  queryOptions({
    queryKey: ["trades", "paid-sales"],
    queryFn: fetchPaidSales,
    staleTime: 60_000,
  });

/** Every traced trade whose bitmap height falls inside a range (club). */
export async function fetchTradesInRange(min: number, max: number): Promise<TradeRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .gte("bitmap_height", min)
    .lte("bitmap_height", max)
    .order("block_height", { ascending: true, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return normalise(data as TradeRow[] | null);
}

export const tradesInRangeQuery = (min: number, max: number) =>
  queryOptions({
    queryKey: ["trades", "range", min, max],
    queryFn: () => fetchTradesInRange(min, max),
    staleTime: 60_000,
  });

/** Best timestamp we hold for a traced trade. */
export function tradeTime(row: TradeRow): string {
  return row.block_time ?? row.created_at;
}
