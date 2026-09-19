import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RankPlayer } from "@/lib/ranks";

/**
 * PLAYER SHARES — anyone can buy a stake in a ranked soul with BIT.
 *
 * A share price has two halves. The BASE VALUE is earned: it is built only
 * from what the player really did (level, fame, kills, builds, districts
 * walked, BIT earned). DEMAND is the market: every share bought lifts the
 * price, every share sold drops it, capped at four times base value.
 *
 * Holders are paid: whenever the player is credited BIT, a tenth of that
 * credit is split between shareholders in proportion to the shares they hold.
 * All of the maths below mirrors the database functions exactly, so the screen
 * never quotes a number the ledger would refuse.
 */

/** What the market pays back compared to the asking price. */
export const SHARE_SELL_SPREAD = 0.9;
/** Share of every BIT credit that flows to shareholders. */
export const DIVIDEND_CUT = 0.1;
/** Hard ceiling on how far demand can lift the base value. */
export const DEMAND_CAP = 4;
export const MAX_SHARES_PER_TRADE = 500;

export type PlayerStock = {
  playerId: string;
  sharesIssued: number;
  bitRaised: number;
  dividendsPaid: number;
  lastPrice: number;
  updatedAt: string;
};

export type ShareHolding = {
  id: string;
  playerId: string;
  holderAddress: string;
  shares: number;
  costBasis: number;
  dividendsEarned: number;
  updatedAt: string;
};

export type ShareTrade = {
  id: string;
  playerId: string;
  address: string;
  side: "buy" | "sell";
  shares: number;
  unitPrice: number;
  totalCoins: number;
  sharesIssuedAfter: number;
  createdAt: string;
};

export type ShareDividend = {
  id: string;
  playerId: string;
  totalCoins: number;
  holders: number;
  sharesIssued: number;
  sourceReason: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ rules */

/** Earned half of the price: the player's own record, nothing invented. */
export function baseValueOf(p: RankPlayer): number {
  return Math.max(
    25,
    Math.floor(
      p.level * 30 +
        p.fame / 12 +
        p.pvpKills * 15 +
        p.pkKills * 5 +
        p.buildsMaintained * 25 +
        p.districtsVisited * 3 +
        p.bitEarned / 250,
    ),
  );
}

export function sharePrice(base: number, issued: number): number {
  return Math.max(1, Math.round(base * Math.min(DEMAND_CAP, 1 + Math.max(issued, 0) * 0.01)));
}

export function demandMultiplier(issued: number): number {
  return Math.min(DEMAND_CAP, 1 + Math.max(issued, 0) * 0.01);
}

/** Walks the price share by share, the same way the database does. */
export function quoteShares(
  base: number,
  issued: number,
  side: "buy" | "sell",
  shares: number,
): { filled: number; total: number; unitPrice: number } {
  let total = 0;
  let filled = 0;
  for (let i = 0; i < shares; i++) {
    if (side === "buy") total += sharePrice(base, issued + i);
    else total += Math.max(1, Math.floor(sharePrice(base, issued - i - 1) * SHARE_SELL_SPREAD));
    filled += 1;
  }
  return { filled, total, unitPrice: filled > 0 ? Math.round(total / filled) : 0 };
}

/* ------------------------------------------------------------------- data */

type StockRow = {
  player_id: string;
  shares_issued: number;
  bit_raised: number;
  dividends_paid: number;
  last_price: number;
  updated_at: string;
};

function toStock(row: StockRow): PlayerStock {
  return {
    playerId: row.player_id,
    sharesIssued: Number(row.shares_issued),
    bitRaised: Number(row.bit_raised),
    dividendsPaid: Number(row.dividends_paid),
    lastPrice: Number(row.last_price),
    updatedAt: row.updated_at,
  };
}

export const playerStockQuery = (playerId: string | null) =>
  queryOptions({
    queryKey: ["player-stock", playerId],
    enabled: Boolean(playerId),
    staleTime: 15_000,
    queryFn: async (): Promise<PlayerStock | null> => {
      const { data, error } = await supabase
        .from("player_stock")
        .select("player_id, shares_issued, bit_raised, dividends_paid, last_price, updated_at")
        .eq("player_id", playerId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toStock(data as StockRow) : null;
    },
  });

export const shareHoldersQuery = (playerId: string | null) =>
  queryOptions({
    queryKey: ["player-share-holders", playerId],
    enabled: Boolean(playerId),
    staleTime: 15_000,
    queryFn: async (): Promise<ShareHolding[]> => {
      const { data, error } = await supabase
        .from("player_share_holdings")
        .select("id, player_id, holder_address, shares, cost_basis, dividends_earned, updated_at")
        .eq("player_id", playerId as string)
        .gt("shares", 0)
        .order("shares", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        playerId: row.player_id as string,
        holderAddress: row.holder_address as string,
        shares: Number(row.shares),
        costBasis: Number(row.cost_basis),
        dividendsEarned: Number(row.dividends_earned),
        updatedAt: row.updated_at as string,
      }));
    },
  });

export const shareTradesQuery = (playerId: string | null, limit = 120) =>
  queryOptions({
    queryKey: ["player-share-trades", playerId, limit],
    enabled: Boolean(playerId),
    staleTime: 15_000,
    queryFn: async (): Promise<ShareTrade[]> => {
      const { data, error } = await supabase
        .from("player_share_trades")
        .select(
          "id, player_id, address, side, shares, unit_price, total_coins, shares_issued_after, created_at",
        )
        .eq("player_id", playerId as string)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        playerId: row.player_id as string,
        address: row.address as string,
        side: row.side as "buy" | "sell",
        shares: Number(row.shares),
        unitPrice: Number(row.unit_price),
        totalCoins: Number(row.total_coins),
        sharesIssuedAfter: Number(row.shares_issued_after),
        createdAt: row.created_at as string,
      }));
    },
  });

export const shareDividendsQuery = (playerId: string | null, limit = 12) =>
  queryOptions({
    queryKey: ["player-share-dividends", playerId, limit],
    enabled: Boolean(playerId),
    staleTime: 30_000,
    queryFn: async (): Promise<ShareDividend[]> => {
      const { data, error } = await supabase
        .from("player_share_dividends")
        .select("id, player_id, total_coins, holders, shares_issued, source_reason, created_at")
        .eq("player_id", playerId as string)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        playerId: row.player_id as string,
        totalCoins: Number(row.total_coins),
        holders: Number(row.holders),
        sharesIssued: Number(row.shares_issued),
        sourceReason: (row.source_reason as string | null) ?? null,
        createdAt: row.created_at as string,
      }));
    },
  });

/** Every stake a set of addresses holds, for "my portfolio" readouts. */
export const myHoldingsQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["player-share-mine", [...addresses].sort()],
    enabled: addresses.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<ShareHolding[]> => {
      const { data, error } = await supabase
        .from("player_share_holdings")
        .select("id, player_id, holder_address, shares, cost_basis, dividends_earned, updated_at")
        .in("holder_address", addresses)
        .gt("shares", 0);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        playerId: row.player_id as string,
        holderAddress: row.holder_address as string,
        shares: Number(row.shares),
        costBasis: Number(row.cost_basis),
        dividendsEarned: Number(row.dividends_earned),
        updatedAt: row.updated_at as string,
      }));
    },
  });
