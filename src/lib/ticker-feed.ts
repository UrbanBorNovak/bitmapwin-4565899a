import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * THE FLOOR IS MOVING — the live network ribbon.
 *
 * Every line is a real record: public provenance events written by the world
 * (builds, deployments, visits, claims) and real Bitcoin blocks read from
 * mempool.space. Nothing is invented and nothing is simulated — when there is
 * no activity the ribbon says so.
 */

export type TickerItem = {
  id: string;
  tag: string;
  text: string;
  height: number | null;
  at: number;
  tone: "bitcoin" | "signal" | "plain";
};

const EVENT_TAG: Record<string, { tag: string; tone: TickerItem["tone"] }> = {
  build: { tag: "BUILD", tone: "bitcoin" },
  deployment: { tag: "DEPLOY", tone: "bitcoin" },
  visit: { tag: "ARRIVAL", tone: "signal" },
  craft: { tag: "CRAFT", tone: "bitcoin" },
  sale: { tag: "SETTLED", tone: "bitcoin" },
  listing: { tag: "ASK", tone: "signal" },
  claim: { tag: "CLAIM", tone: "signal" },
};

function shortWallet(w: string | null) {
  if (!w) return null;
  return w.length <= 12 ? w : `${w.slice(0, 5)}…${w.slice(-4)}`;
}

async function fetchProvenanceItems(): Promise<TickerItem[]> {
  const { data } = await supabase
    .from("provenance_events")
    .select("id, event_type, bitmap_height, title, summary, actor_wallet, occurred_at")
    .eq("visibility", "public")
    .order("occurred_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((row) => {
    const meta = EVENT_TAG[row.event_type] ?? { tag: String(row.event_type).replace(/_/g, " ").toUpperCase(), tone: "plain" as const };
    const who = shortWallet(row.actor_wallet);
    const land = row.bitmap_height == null ? null : `${Number(row.bitmap_height).toLocaleString("en-US")}.BITMAP`;
    const parts = [who, land, (row.title || row.summary || "").toUpperCase()].filter(Boolean);
    return {
      id: `prov:${row.id}`,
      tag: meta.tag,
      tone: meta.tone,
      text: parts.join(" · "),
      height: row.bitmap_height == null ? null : Number(row.bitmap_height),
      at: new Date(row.occurred_at as string).getTime(),
    };
  });
}

type MempoolBlock = { id: string; height: number; timestamp: number; tx_count: number; extras?: { pool?: { name?: string } | null } };

async function fetchBlockItems(): Promise<TickerItem[]> {
  try {
    const res = await fetch("https://mempool.space/api/v1/blocks", { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const blocks = (await res.json()) as MempoolBlock[];
    return blocks.slice(0, 8).map((b) => ({
      id: `block:${b.id}`,
      tag: "BLOCK",
      tone: "signal" as const,
      text: `#${b.height.toLocaleString("en-US")} MINED BY ${(b.extras?.pool?.name ?? "UNKNOWN POOL").toUpperCase()} · ${b.tx_count.toLocaleString("en-US")} TXS`,
      height: b.height,
      at: b.timestamp * 1000,
    }));
  } catch {
    return [];
  }
}

export async function fetchTickerItems(): Promise<TickerItem[]> {
  const [prov, blocks] = await Promise.all([fetchProvenanceItems(), fetchBlockItems()]);
  return [...prov, ...blocks].sort((a, b) => b.at - a.at).slice(0, 36);
}

export const tickerQuery = () =>
  queryOptions({
    queryKey: ["ticker", "floor"],
    queryFn: fetchTickerItems,
    staleTime: 20_000,
    refetchInterval: 45_000,
    retry: 1,
  });
