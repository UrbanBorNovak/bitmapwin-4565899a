import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LandStatus = {
  build: { inscriptionId: string; voxels: number } | null;
  guardian: { inscriptionId: string; species: string } | null;
};

/** Chain-verified build + inscribed Guardian per BITMAP, read from the public directories. */
export const landStatusQuery = (heights: number[]) =>
  queryOptions({
    queryKey: ["land-status", [...heights].sort((a, b) => a - b)],
    enabled: heights.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [b, g] = await Promise.all([
        supabase.from("bitmap_forge_builds").select("bitmap_height, inscription_id, block_count").in("bitmap_height", heights),
        supabase.from("bitmon_guardians").select("block_height, species, stats").in("block_height", heights),
      ]);
      const out = new Map<number, LandStatus>();
      const get = (h: number) => out.get(h) ?? (out.set(h, { build: null, guardian: null }), out.get(h)!);
      for (const r of b.data ?? []) get(Number(r.bitmap_height)).build = { inscriptionId: r.inscription_id, voxels: Number(r.block_count) };
      for (const r of g.data ?? []) {
        const ins = (r.stats as Record<string, unknown> | null)?.["inscription"];
        if (typeof ins === "string") get(Number(r.block_height)).guardian = { inscriptionId: ins, species: r.species };
      }
      return out;
    },
  });
