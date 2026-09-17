import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemId } from "./world-skills";

/**
 * THE GOODS MARKET — where the ore your crews dig and the things you craft turn
 * into BIT. Prices are not fixed: every item has a baseline stock, and the price
 * moves with how much of it the market is holding. Buying drains the shelves and
 * lifts the price; selling floods them and pushes it down. Stock, prices and the
 * trade log are shared platform state; the goods themselves come out of the
 * personal backpack kept in the visitor's own browser.
 */

/** What the market pays compared to what it charges. */
export const SELL_SPREAD = 0.78;

export type MarketGood = {
  itemId: ItemId;
  basePrice: number;
  baselineStock: number;
  stock: number;
  boughtTotal: number;
  soldTotal: number;
  buyPrice: number;
  sellPrice: number;
  /** How far the price sits above (or below) its baseline, as a share. */
  drift: number;
  updatedAt: string;
};

export type MarketTrade = {
  id: string;
  itemId: ItemId;
  address: string;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  totalCoins: number;
  createdAt: string;
};

/** The same curve the database prices with, so the screen never lies. */
export function priceOf(basePrice: number, baselineStock: number, stock: number): number {
  const pressure = Math.pow(Math.max(baselineStock, 1) / Math.max(stock, 1), 0.6);
  return Math.max(1, Math.round(basePrice * Math.min(4, Math.max(0.3, pressure))));
}

export function sellPriceOf(basePrice: number, baselineStock: number, stock: number): number {
  return Math.max(1, Math.round(priceOf(basePrice, baselineStock, stock + 1) * SELL_SPREAD));
}

/** What a whole order costs (or pays), walking the price as stock moves. */
export function quoteOrder(
  good: MarketGood,
  side: "buy" | "sell",
  quantity: number,
): { filled: number; total: number; unitPrice: number } {
  let stock = good.stock;
  let total = 0;
  let filled = 0;
  while (filled < quantity) {
    if (side === "buy") {
      if (stock <= 0) break;
      total += priceOf(good.basePrice, good.baselineStock, stock);
      stock -= 1;
    } else {
      total += sellPriceOf(good.basePrice, good.baselineStock, stock);
      stock += 1;
    }
    filled += 1;
  }
  return { filled, total, unitPrice: filled > 0 ? Math.round(total / filled) : 0 };
}

type GoodRow = {
  item_id: string;
  base_price: number;
  baseline_stock: number;
  stock: number;
  bought_total: number;
  sold_total: number;
  updated_at: string;
};

function mapGood(row: GoodRow): MarketGood {
  const basePrice = Number(row.base_price);
  const baselineStock = Number(row.baseline_stock);
  const stock = Number(row.stock);
  const buyPrice = priceOf(basePrice, baselineStock, stock);
  return {
    itemId: row.item_id as ItemId,
    basePrice,
    baselineStock,
    stock,
    boughtTotal: Number(row.bought_total),
    soldTotal: Number(row.sold_total),
    buyPrice,
    sellPrice: sellPriceOf(basePrice, baselineStock, stock),
    drift: basePrice > 0 ? buyPrice / basePrice - 1 : 0,
    updatedAt: row.updated_at,
  };
}

export const goodsMarketQuery = () =>
  queryOptions({
    queryKey: ["goods-market"],
    queryFn: async (): Promise<MarketGood[]> => {
      const { data, error } = await supabase
        .from("goods_market")
        .select("item_id, base_price, baseline_stock, stock, bought_total, sold_total, updated_at")
        .order("base_price", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as GoodRow[]).map(mapGood);
    },
    staleTime: 10_000,
  });

export const goodsTradesQuery = (limit = 30) =>
  queryOptions({
    queryKey: ["goods-trades", limit],
    queryFn: async (): Promise<MarketTrade[]> => {
      const { data, error } = await supabase
        .from("goods_trades")
        .select("id, item_id, address, side, quantity, unit_price, total_coins, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        itemId: row.item_id as ItemId,
        address: row.address,
        side: row.side === "buy" ? "buy" : "sell",
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        totalCoins: Number(row.total_coins),
        createdAt: row.created_at,
      }));
    },
    staleTime: 10_000,
  });
