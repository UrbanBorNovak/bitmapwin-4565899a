import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProvenanceEvent, ProofLevel } from "@/lib/passport";

export type TerritoryChronicle = {
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  buildRecords: number;
  installRecords: number;
  events: ProvenanceEvent[];
};

function toEvent(row: any): ProvenanceEvent {
  return {
    id: row.id,
    sourceKey: row.source_key,
    eventType: row.event_type,
    actorWallet: row.actor_wallet,
    bitmapHeight: row.bitmap_height === null ? null : Number(row.bitmap_height),
    sourceType: row.source_type,
    sourceId: row.source_id,
    proofLevel: row.proof_level as ProofLevel,
    title: row.title,
    summary: row.summary,
    metadata: row.metadata ?? {},
    occurredAt: row.occurred_at,
  };
}

/** Public, privacy-safe evidence for one BITMAP. Visitor identities are never selected. */
export const territoryChronicleQuery = (height: number) =>
  queryOptions({
    queryKey: ["territory-chronicle", height],
    queryFn: async (): Promise<TerritoryChronicle> => {
      const [stats, events, builds, installs] = await Promise.all([
        supabase
          .from("bitmap_view_stats")
          .select("total_views, unique_visitors, last_viewed_at")
          .eq("bitmap_height", height)
          .maybeSingle(),
        supabase
          .from("provenance_events")
          .select("id, source_key, event_type, actor_wallet, bitmap_height, source_type, source_id, proof_level, title, summary, metadata, occurred_at")
          .eq("bitmap_height", height)
          .eq("visibility", "public")
          .in("event_type", ["build", "deployment", "visit"])
          .order("occurred_at", { ascending: false })
          .limit(80),
        supabase
          .from("provenance_events")
          .select("id", { count: "exact", head: true })
          .eq("bitmap_height", height)
          .eq("visibility", "public")
          .eq("event_type", "build"),
        supabase
          .from("provenance_events")
          .select("id", { count: "exact", head: true })
          .eq("bitmap_height", height)
          .eq("visibility", "public")
          .eq("event_type", "deployment"),
      ]);
      for (const result of [stats, events, builds, installs]) {
        if (result.error) throw result.error;
      }
      const allEvents = (events.data ?? []).map(toEvent);
      const milestoneEvents = allEvents.filter((item) => item.eventType !== "visit");
      const recentArrivals = allEvents.filter((item) => item.eventType === "visit").slice(0, 6);
      return {
        totalViews: Number(stats.data?.total_views ?? 0),
        uniqueVisitors: Number(stats.data?.unique_visitors ?? 0),
        lastViewedAt: stats.data?.last_viewed_at ?? null,
        buildRecords: builds.count ?? 0,
        installRecords: installs.count ?? 0,
        events: [...milestoneEvents, ...recentArrivals]
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .slice(0, 24),
      };
    },
    staleTime: 20_000,
  });