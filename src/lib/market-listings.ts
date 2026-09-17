/**
 * THE LISTING BOARD AT THE TRADING POST — the noticeboard beside the market
 * counter, where anybody can put goods up at their own price.
 *
 * Two crowds use it. Players list ore, bars, hides and relics out of their own
 * backpack. Oasis settlers work it too: their traders post their own stock at
 * whatever the market rate is that minute, and they buy up player listings that
 * are priced fairly. Everything on the board is shared platform state; the goods
 * themselves come out of the backpack kept in the visitor's own browser.
 */

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemId } from "./world-skills";

export type ListingKind = "player" | "npc";

export type MarketListing = {
  id: string;
  itemId: ItemId;
  sellerAddress: string;
  sellerKind: ListingKind;
  sellerName: string;
  quantity: number;
  filled: number;
  remaining: number;
  unitPrice: number;
  createdAt: string;
};

type ListingRow = {
  id: string;
  item_id: string;
  seller_address: string;
  seller_kind: string;
  seller_name: string;
  quantity: number;
  filled: number;
  unit_price: number;
  created_at: string;
};

function mapListing(row: ListingRow): MarketListing {
  const quantity = Number(row.quantity);
  const filled = Number(row.filled);
  return {
    id: row.id,
    itemId: row.item_id as ItemId,
    sellerAddress: row.seller_address,
    sellerKind: row.seller_kind === "npc" ? "npc" : "player",
    sellerName: row.seller_name,
    quantity,
    filled,
    remaining: Math.max(0, quantity - filled),
    unitPrice: Number(row.unit_price),
    createdAt: row.created_at,
  };
}

/** Everything currently for sale on the board, cheapest goods first. */
export const marketListingsQuery = (limit = 60) =>
  queryOptions({
    queryKey: ["market-listings", limit],
    queryFn: async (): Promise<MarketListing[]> => {
      const { data, error } = await supabase
        .from("market_listings")
        .select(
          "id, item_id, seller_address, seller_kind, seller_name, quantity, filled, unit_price, created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ListingRow[]).map(mapListing).filter((row) => row.remaining > 0);
    },
    staleTime: 8_000,
  });

/** How busy the settler traders have been on the board. */
export const settlerTradeStatsQuery = () =>
  queryOptions({
    queryKey: ["market-npc-state"],
    queryFn: async (): Promise<{ listed: number; bought: number; lastRun: string }> => {
      const { data, error } = await supabase
        .from("market_npc_state")
        .select("listed_total, bought_total, last_run")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        listed: Number(data?.listed_total ?? 0),
        bought: Number(data?.bought_total ?? 0),
        lastRun: data?.last_run ?? new Date(0).toISOString(),
      };
    },
    staleTime: 20_000,
  });
