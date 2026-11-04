import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchRegistryParcel, type RegistryParcel } from "@/lib/registry";

export type FreshKind = "guardian" | "build";
export type FreshFeatured = { parcel: RegistryParcel; kind: FreshKind; at: string };

/** Newest on-chain inscribed Guardians and verified voxel builds, as registry BITMAPs. */
export const freshFeaturedQuery = () =>
  queryOptions({
    queryKey: ["home", "fresh-featured"],
    queryFn: async (): Promise<FreshFeatured[]> => {
      const [g, b] = await Promise.all([
        supabase
          .from("bitmon_guardians")
          .select("block_height, stats, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("bitmap_forge_builds")
          .select("bitmap_height, verified_at")
          .order("verified_at", { ascending: false })
          .limit(4),
      ]);
      const picks: { height: number; kind: FreshKind; at: string }[] = [];
      for (const r of g.data ?? []) {
        const s = (r.stats ?? {}) as Record<string, unknown>;
        if (typeof s["inscription"] !== "string") continue;
        picks.push({ height: r.block_height, kind: "guardian", at: r.created_at });
        if (picks.length >= 3) break;
      }
      for (const r of b.data ?? []) picks.push({ height: r.bitmap_height, kind: "build", at: r.verified_at });
      const seen = new Set<number>();
      const unique = picks.filter((p) => (seen.has(p.height) ? false : (seen.add(p.height), true)));
      const parcels = await Promise.all(unique.map((p) => fetchRegistryParcel(p.height).catch(() => null)));
      return unique.flatMap((p, i) => (parcels[i] ? [{ parcel: parcels[i]!, kind: p.kind, at: p.at }] : []));
    },
    staleTime: 60_000,
  });

/** Fisher–Yates shuffle with Math.random — a different order on every visit. */
export function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
