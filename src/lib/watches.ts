import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WatchFlags = {
  bids: boolean;
  visits: boolean;
  builds: boolean;
  leases: boolean;
  trades: boolean;
  coins: boolean;
};

export type BitmapWatch = {
  id: string;
  height: number;
  note: string | null;
  createdAt: string;
  flags: WatchFlags;
};

export const DEFAULT_WATCH_FLAGS: WatchFlags = {
  bids: true,
  visits: true,
  builds: true,
  leases: true,
  trades: true,
  coins: true,
};

export const WATCH_FLAG_LABEL: Record<keyof WatchFlags, string> = {
  bids: "NEW BIDS",
  visits: "NEW VISITS",
  builds: "BUILD UPDATES",
  leases: "LEASE ACTIVITY",
  trades: "ON-CHAIN TRADES",
  coins: "BIT ACTIVITY",
};

type Row = {
  id: string;
  bitmap_height: number;
  note: string | null;
  created_at: string;
  watch_bids: boolean;
  watch_visits: boolean;
  watch_builds: boolean;
  watch_leases: boolean;
  watch_trades: boolean;
  watch_coins: boolean;
};

const toWatch = (r: Row): BitmapWatch => ({
  id: r.id,
  height: Number(r.bitmap_height),
  note: r.note,
  createdAt: r.created_at,
  flags: {
    bids: r.watch_bids,
    visits: r.watch_visits,
    builds: r.watch_builds,
    leases: r.watch_leases,
    trades: r.watch_trades,
    coins: r.watch_coins,
  },
});

export async function fetchMyWatches(): Promise<BitmapWatch[]> {
  const { data, error } = await supabase
    .from("bitmap_watches")
    .select("id, bitmap_height, note, created_at, watch_bids, watch_visits, watch_builds, watch_leases, watch_trades, watch_coins")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toWatch(r as Row));
}

export const myWatchesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["bitmap-watches"],
    queryFn: fetchMyWatches,
    enabled,
    staleTime: 15_000,
  });

export async function watchBitmap(
  height: number,
  flags: Partial<WatchFlags> = {},
  note?: string | null,
): Promise<BitmapWatch> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in to watch a bitmap");
  const merged = { ...DEFAULT_WATCH_FLAGS, ...flags };
  const { data, error } = await supabase
    .from("bitmap_watches")
    .upsert(
      {
        user_id: userId,
        bitmap_height: height,
        note: note ?? null,
        watch_bids: merged.bids,
        watch_visits: merged.visits,
        watch_builds: merged.builds,
        watch_leases: merged.leases,
        watch_trades: merged.trades,
        watch_coins: merged.coins,
      },
      { onConflict: "user_id,bitmap_height" },
    )
    .select("id, bitmap_height, note, created_at, watch_bids, watch_visits, watch_builds, watch_leases, watch_trades, watch_coins")
    .single();
  if (error) throw error;
  return toWatch(data as Row);
}

export async function unwatchBitmap(height: number): Promise<void> {
  const { error } = await supabase.from("bitmap_watches").delete().eq("bitmap_height", height);
  if (error) throw error;
}
