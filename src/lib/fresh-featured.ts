import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inhabitedBitmapsFn } from "@/lib/inhabited.functions";
import { fetchRegistryParcel, type RegistryParcel } from "@/lib/registry";

export type FreshKind = "guardian" | "build";
export type FreshFeatured = { parcel: RegistryParcel; kind: FreshKind; at: string };

/** Newest on-chain inscribed Guardians and verified voxel builds, as registry BITMAPs. */
export const freshFeaturedQuery = () =>
  queryOptions({
    queryKey: ["home", "fresh-featured"],
    queryFn: async (): Promise<FreshFeatured[]> => {
      const [g, b] = await Promise.all([
        // Chain truth: Guardian children of the collection root, oldest first.
        inhabitedBitmapsFn().catch(() => []),
        supabase
          .from("bitmap_forge_builds")
          .select("bitmap_height, verified_at")
          .order("verified_at", { ascending: false })
          .limit(4),
      ]);
      const picks: { height: number; kind: FreshKind; at: string }[] = [];
      for (const r of [...g].reverse().slice(0, 3)) picks.push({ height: r.height, kind: "guardian", at: r.inscriptionId });
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
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}
