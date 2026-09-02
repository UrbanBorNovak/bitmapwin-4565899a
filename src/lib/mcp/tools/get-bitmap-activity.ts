import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

type Event = {
  type: string;
  timestamp: string;
  actor?: string | null;
  amountSats?: number | null;
  amountBtc?: number | null;
  detail?: string | null;
};

const btc = (sats: number | null | undefined) =>
  sats === null || sats === undefined ? null : Number((sats / 1e8).toFixed(8));

export default defineTool({
  name: "get_bitmap_activity",
  title: "Get bitmap activity",
  description:
    "Timeline of what is happening to one bitmap: visits, bids, on-chain trades, build updates, lease offers and leases, chat and BIT events — newest first.",
  inputSchema: {
    height: z.number().int().nonnegative().describe("Bitcoin block height of the bitmap, e.g. 420690."),
    limit: z.number().int().min(1).max(200).optional().describe("Max events to return (default 50)."),
    types: z
      .array(z.string())
      .optional()
      .describe("Filter to these event types: visit, bid, trade, build_update, lease_offer, lease, chat, coin_event."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ height, limit, types }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const take = limit ?? 50;

    const [views, stats, bids, trades, build, leaseOffers, leases, chat, coinEvents] = await Promise.all([
      supabase
        .from("bitmap_views")
        .select("viewer_address, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("bitmap_view_stats")
        .select("total_views, unique_visitors, last_viewed_at")
        .eq("bitmap_height", height)
        .maybeSingle(),
      supabase
        .from("bids")
        .select("price_sats, bidder_address, status, note, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("trades")
        .select("txid, price_sats, seller_address, buyer_address, block_time, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("parcel_pages")
        .select("title, build_kind, owner_address, created_at, updated_at")
        .eq("bitmap_height", height)
        .maybeSingle(),
      supabase
        .from("lease_offers")
        .select("rate_sats_per_day, rate_coins_per_day, min_days, max_days, status, owner_address, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("leases")
        .select("lessee_address, days, total_sats, total_coins, status, starts_at, ends_at, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("bitmap_chat_messages")
        .select("sender_address, body, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
      supabase
        .from("coin_events")
        .select("kind, title, status, prize_coins, entry_cost, host_address, ends_at, created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: false })
        .limit(take),
    ]);

    const firstError = [views, bids, trades, leaseOffers, leases, chat, coinEvents].find((r) => r.error)?.error;
    if (firstError) return errorResult(firstError.message);

    const events: Event[] = [];

    for (const v of views.data ?? [])
      events.push({ type: "visit", timestamp: v.created_at, actor: v.viewer_address ?? null });

    for (const b of bids.data ?? [])
      events.push({
        type: "bid",
        timestamp: b.created_at,
        actor: b.bidder_address,
        amountSats: b.price_sats,
        amountBtc: btc(b.price_sats),
        detail: b.note ? `${b.status} — ${b.note}` : b.status,
      });

    for (const t of trades.data ?? [])
      events.push({
        type: "trade",
        timestamp: t.block_time ?? t.created_at,
        actor: t.buyer_address,
        amountSats: t.price_sats,
        amountBtc: btc(t.price_sats),
        detail: `${t.seller_address ?? "?"} -> ${t.buyer_address ?? "?"} (${t.txid})`,
      });

    if (build.data)
      events.push({
        type: "build_update",
        timestamp: build.data.updated_at,
        actor: build.data.owner_address,
        detail: `${build.data.build_kind}${build.data.title ? ` — ${build.data.title}` : ""}`,
      });

    for (const o of leaseOffers.data ?? [])
      events.push({
        type: "lease_offer",
        timestamp: o.created_at,
        actor: o.owner_address,
        amountSats: o.rate_sats_per_day,
        amountBtc: btc(o.rate_sats_per_day),
        detail: `${o.status} · ${o.rate_coins_per_day} BIT/day · ${o.min_days}-${o.max_days} days`,
      });

    for (const l of leases.data ?? [])
      events.push({
        type: "lease",
        timestamp: l.created_at,
        actor: l.lessee_address,
        amountSats: l.total_sats,
        amountBtc: btc(l.total_sats),
        detail: `${l.status} · ${l.days} days · ${l.total_coins} BIT · ${l.starts_at} -> ${l.ends_at}`,
      });

    for (const m of chat.data ?? [])
      events.push({
        type: "chat",
        timestamp: m.created_at,
        actor: m.sender_address ?? null,
        detail: m.body.slice(0, 200),
      });

    for (const e of coinEvents.data ?? [])
      events.push({
        type: "coin_event",
        timestamp: e.created_at,
        actor: e.host_address,
        detail: `${e.kind} · ${e.title} · ${e.status} · prize ${e.prize_coins} BIT · entry ${e.entry_cost} BIT${
          e.ends_at ? ` · ends ${e.ends_at}` : ""
        }`,
      });

    const wanted = types && types.length > 0 ? new Set(types) : null;
    const timeline = events
      .filter((e) => (wanted ? wanted.has(e.type) : true))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, take);

    const openBids = (bids.data ?? []).filter((b) => b.status === "open");
    const payload = {
      bitmap: height,
      name: `${height}.bitmap`,
      summary: {
        totalViews: stats.data?.total_views ?? 0,
        uniqueVisitors: stats.data?.unique_visitors ?? 0,
        lastViewedAt: stats.data?.last_viewed_at ?? null,
        openBids: openBids.length,
        topBidSats: openBids[0] ? Math.max(...openBids.map((b) => b.price_sats)) : null,
        trades: (trades.data ?? []).length,
        build: build.data ? { kind: build.data.build_kind, title: build.data.title } : null,
        leaseAvailable: (leaseOffers.data ?? []).some((o) => o.status === "open"),
        activeLeases: (leases.data ?? []).filter((l) => l.status === "active").length,
      },
      events: timeline,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
