import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DISPATCH_COLS, toDispatch } from "@/lib/guardian-dispatch";

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
