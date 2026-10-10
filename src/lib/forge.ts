import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getForgeBuildFn } from "@/lib/forge.functions";

/** Live chain check (BITMAP page, Oasis). */
export const forgeBuildQuery = (height: number | null) =>
  queryOptions({
    queryKey: ["forge-build", height],
    queryFn: () => getForgeBuildFn({ data: { height: height as number } }),
    enabled: height !== null,
    staleTime: 15 * 60_000,
    retry: 1,
  });

/** Cheap directory read of already-verified builds (marketplace cards). */
export const forgeBuiltQuery = (height: number) =>
  queryOptions({
    queryKey: ["forge-built", height],
    queryFn: async () => {
      const { data } = await supabase.from("bitmap_forge_builds").select("inscription_id, sat").eq("bitmap_height", height).maybeSingle();
      return data ? { inscriptionId: data.inscription_id as string, sat: (data.sat as string | null) ?? null } : null;
    },
    staleTime: 10 * 60_000,
  });
