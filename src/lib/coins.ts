import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * BIT — the platform coin. It is fully off-chain: earned every day for the
 * attention a build gets, for trading, for building and for leasing owned
 * bitmaps out, then spent inside builder raffles, giveaways and events.
 */

export const COIN = "BIT";

/** Daily emission rules. Attention on builds pays the most. */
export const EMISSION = {
  perUniqueVisitor: 12,
  perView: 2,
  perBuildMaintained: 5,
  perTrade: 150,
  perLeaseDayEarned: 20,
  perLeaseDayRented: 8,
} as const;

/** Host & Earn: share of a hosted BITMAP's visitor BIT that goes to the land holder; the rest goes to the experience's creator. */
export const HOST_SPLIT = { holderPercent: 70, creatorPercent: 30 } as const;

/** District Fiefdom Dividend: share of a BITMAP's daily visitor BIT paid pro-rata to its valid on-chain parcel holders. */
export const FIEF_SPLIT = { parcelPercent: 25 } as const;

export type CoinBalance = {
  address: string;
  balance: number;
  earnedTotal: number;
  updatedAt: string;
};

export type CoinLeaderboardEntry = {
  rank: number;
  addressLabel: string;
  balance: number;
  updatedAt: string;
};

export type CoinLedgerEntry = {
  id: string;
  address: string;
  delta: number;
  reason: string;
  ref: string | null;
  createdAt: string;
};

export type CoinEventKind = "raffle" | "giveaway" | "event";

export type CoinEvent = {
  id: string;
  kind: CoinEventKind;
  bitmapHeight: number | null;
  hostAddress: string;
  title: string;
  description: string | null;
  prize: string | null;
  prizeCoins: number;
  entryCost: number;
  maxEntries: number | null;
  status: string;
  endsAt: string | null;
  winnerAddress: string | null;
  drawnAt: string | null;
  createdAt: string;
};

export type CoinEventEntry = {
  id: string;
  eventId: string;
  address: string;
  tickets: number;
  spent: number;
  createdAt: string;
};

export const REASON_LABEL: Record<string, string> = {
  build_attention: "BUILD ATTENTION",
  build_maintained: "BUILD MAINTAINED",
  miner_yield: "BTC MINER YIELD",
  trade_reward: "TRADE",
  lease_reward_owner: "LEASE GRANTED",
  lease_reward_lessee: "LEASE TAKEN",
  lease_rent_paid: "RENT PAID",
  lease_rent_earned: "RENT EARNED",
  event_entry: "EVENT ENTRY",
  event_revenue: "EVENT REVENUE",
  event_prize_locked: "PRIZE LOCKED",
  event_prize_won: "PRIZE WON",
  event_prize_refund: "PRIZE REFUNDED",
  referral_bonus: "REFERRAL BONUS",
  referral_joined: "JOINED VIA REFERRAL",
  referral_override: "REFERRAL SHARE",
  ai_build: "AI BUILD",
  extender_purchase: "EXTENDER BOUGHT",
  inscription_donation: "INSCRIPTION DONATED",
  btc_donation: "BITCOIN DONATED",
};

export function formatBit(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} ${COIN}`;
}

export function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason.replace(/_/g, " ").toUpperCase();
}

export function isCoinEventKind(value: string): value is CoinEventKind {
  return value === "raffle" || value === "giveaway" || value === "event";
}

type BalanceRow = {
  address: string;
  balance: number;
  earned_total: number;
  updated_at: string;
};

type LeaderboardRow = {
  rank: number;
  address_label: string;
  balance: number;
  updated_at: string;
};

function mapBalance(row: BalanceRow): CoinBalance {
  return {
    address: row.address,
    balance: Number(row.balance),
    earnedTotal: Number(row.earned_total),
    updatedAt: row.updated_at,
  };
}

type EventRow = {
  id: string;
  kind: string;
  bitmap_height: number | null;
  host_address: string;
  title: string;
  description: string | null;
  prize: string | null;
  prize_coins: number;
  entry_cost: number;
  max_entries: number | null;
  status: string;
  ends_at: string | null;
  winner_address: string | null;
  drawn_at: string | null;
  created_at: string;
};

const EVENT_COLS =
  "id, kind, bitmap_height, host_address, title, description, prize, prize_coins, entry_cost, max_entries, status, ends_at, winner_address, drawn_at, created_at";

function mapEvent(row: EventRow): CoinEvent {
  return {
    id: row.id,
    kind: isCoinEventKind(row.kind) ? row.kind : "event",
    bitmapHeight: row.bitmap_height === null ? null : Number(row.bitmap_height),
    hostAddress: row.host_address,
    title: row.title,
    description: row.description,
    prize: row.prize,
    prizeCoins: Number(row.prize_coins ?? 0),
    entryCost: Number(row.entry_cost),
    maxEntries: row.max_entries === null ? null : Number(row.max_entries),
    status: row.status,
    endsAt: row.ends_at,
    winnerAddress: row.winner_address,
    drawnAt: row.drawn_at,
    createdAt: row.created_at,
  };
}

type EntryRow = {
  id: string;
  event_id: string;
  address: string;
  tickets: number;
  spent: number;
  created_at: string;
};

function mapEntry(row: EntryRow): CoinEventEntry {
  return {
    id: row.id,
    eventId: row.event_id,
    address: row.address,
    tickets: Number(row.tickets),
    spent: Number(row.spent),
    createdAt: row.created_at,
  };
}

/** BIT balances for a set of addresses (a wallet may hold several). */
export const coinBalanceQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["coin-balance", [...addresses].sort().join(",")],
    queryFn: async (): Promise<CoinBalance[]> => {
      if (addresses.length === 0) return [];
      const { data, error } = await supabase
        .from("coin_balances")
        .select("address, balance, earned_total, updated_at")
        .in("address", addresses);
      if (error) throw new Error(error.message);
      return ((data ?? []) as BalanceRow[]).map(mapBalance);
    },
    enabled: addresses.length > 0,
    staleTime: 15_000,
  });

export const coinLedgerQuery = (addresses: string[], limit = 60) =>
  queryOptions({
    queryKey: ["coin-ledger", [...addresses].sort().join(","), limit],
    queryFn: async (): Promise<CoinLedgerEntry[]> => {
      if (addresses.length === 0) return [];
      const { data, error } = await supabase
        .from("coin_ledger")
        .select("id, address, delta, reason, ref, created_at")
        .in("address", addresses)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        address: row.address,
        delta: Number(row.delta),
        reason: row.reason,
        ref: row.ref,
        createdAt: row.created_at,
      }));
    },
    enabled: addresses.length > 0,
    staleTime: 15_000,
  });

/** Top BIT holders — the platform economy leaderboard. */
export const coinLeaderboardQuery = (limit = 20) =>
  queryOptions({
    queryKey: ["coin-leaderboard", limit],
    queryFn: async (): Promise<CoinLeaderboardEntry[]> => {
      const { data, error } = await supabase
        .from("coin_leaderboard_public")
        .select("rank, address_label, balance, updated_at")
        .order("rank", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as LeaderboardRow[]).map((row) => ({
        rank: Number(row.rank),
        addressLabel: row.address_label,
        balance: Number(row.balance),
        updatedAt: row.updated_at,
      }));
    },
    staleTime: 30_000,
  });

export const coinEventsQuery = (limit = 60) =>
  queryOptions({
    queryKey: ["coin-events", limit],
    queryFn: async (): Promise<CoinEvent[]> => {
      const { data, error } = await supabase
        .from("coin_events")
        .select(EVENT_COLS)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventRow[]).map(mapEvent);
    },
    staleTime: 15_000,
  });

export const bitmapEventsQuery = (height: number) =>
  queryOptions({
    queryKey: ["coin-events", "bitmap", height],
    queryFn: async (): Promise<CoinEvent[]> => {
      const { data, error } = await supabase
        .from("coin_events")
        .select(EVENT_COLS)
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventRow[]).map(mapEvent);
    },
    staleTime: 15_000,
  });

export const eventEntriesQuery = (eventIds: string[]) =>
  queryOptions({
    queryKey: ["coin-event-entries", [...eventIds].sort().join(",")],
    queryFn: async (): Promise<CoinEventEntry[]> => {
      if (eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("coin_event_entries")
        .select("id, event_id, address, tickets, spent, created_at")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as EntryRow[]).map(mapEntry);
    },
    enabled: eventIds.length > 0,
    staleTime: 15_000,
  });

/** Most recent daily reward payouts. */
export const rewardRunsQuery = (limit = 7) =>
  queryOptions({
    queryKey: ["coin-reward-runs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_reward_runs")
        .select("run_date, awarded, recipients, created_at")
        .order("run_date", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        runDate: row.run_date,
        awarded: Number(row.awarded),
        recipients: Number(row.recipients),
        createdAt: row.created_at,
      }));
    },
    staleTime: 60_000,
  });

export type CreateCoinEventInput = {
  kind: CoinEventKind;
  bitmapHeight: number | null;
  hostAddress: string;
  title: string;
  description?: string | null;
  prize?: string | null;
  prizeCoins: number;
  entryCost: number;
  maxEntries?: number | null;
  endsAt?: string | null;
};
