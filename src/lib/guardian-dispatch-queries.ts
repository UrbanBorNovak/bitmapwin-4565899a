import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DISPATCH_COLS, toDispatch } from "@/lib/guardian-dispatch";

export type RecentGuardianRaid = {
  id: string;
  attackerHeight: number;
  defenderHeight: number;
  winnerHeight: number;
  spoils: number;
  resolvedAt: string;
};

/** Every Guardian currently out on a commanded route, visible to all players. */
export const liveDispatchesQuery = () =>
  queryOptions({
    queryKey: ["guardian-dispatches", "live"],
    queryFn: async () => {
      const { data } = await supabase
        .from("guardian_dispatches")
        .select(DISPATCH_COLS)
        .is("recalled_at", null)
        .or(`repeat.eq.true,ends_at.gt.${new Date().toISOString()}`)
        .limit(300);
      return (data ?? []).map(toDispatch);
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

/** Recent public outcomes, used for winner markers on the shared Oasis land. */
export const recentGuardianRaidsQuery = () =>
  queryOptions({
    queryKey: ["guardian-raids", "recent", "oasis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardian_raids")
        .select("id, attacker_height, defender_height, winner_height, spoils, resolved_at")
        .order("resolved_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row): RecentGuardianRaid => ({
        id: row.id,
        attackerHeight: Number(row.attacker_height),
        defenderHeight: Number(row.defender_height),
        winnerHeight: Number(row.winner_height),
        spoils: Number(row.spoils),
        resolvedAt: row.resolved_at,
      }));
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
