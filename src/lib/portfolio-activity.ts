import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PortfolioClient = SupabaseClient<Database>;

export type BitmapPulse = {
  height: number;
  name: string;
  watched: boolean;
  held: boolean;
  visits: number;
  previousVisits: number;
  visitChangePct: number | null;
  uniqueVisitors: number;
  totalViews: number;
  newBids: number;
  topBidSats: number | null;
  trades: number;
  tradeVolumeSats: number;
  buildUpdated: boolean;
  buildKind: string | null;
  buildTitle: string | null;
  leaseStarted: number;
  leaseExpiresInDays: number | null;
  leaseOffered: boolean;
  coinEvents: number;
  chatMessages: number;
  score: number;
  headline: string;
  highlights: string[];
};

export type PortfolioActivity = {
  windowHours: number;
  since: string;
  addresses: string[];
  bitmaps: number;
  totals: {
    visits: number;
    newBids: number;
    topBidSats: number | null;
    trades: number;
    buildUpdates: number;
    leasesExpiringSoon: number;
    coinEvents: number;
  };
  pulses: BitmapPulse[];
  attention: { height: number; name: string; reason: string }[];
};

const num = (v: unknown) => Number(v ?? 0);

function pct(now: number, before: number): number | null {
  if (before === 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

/**
 * Aggregated "what happened to my properties" stream. Reads only real rows
 * already recorded by the app (views, bids, trades, builds, leases, chat, BIT
 * events) and groups them per bitmap so an agent (or the dashboard) can decide
 * what deserves attention.
 */
export async function fetchPortfolioActivity(
  client: PortfolioClient,
  opts: {
    addresses: string[];
    heldHeights: number[];
    watchedHeights?: number[];
    windowHours?: number;
    limit?: number;
  },
): Promise<PortfolioActivity> {
  const windowHours = opts.windowHours ?? 24;
  const limit = opts.limit ?? 25;
  const addresses = [...new Set(opts.addresses.filter(Boolean))];
  const held = new Set(opts.heldHeights.filter((h) => Number.isFinite(h)));
  const watched = new Set((opts.watchedHeights ?? []).filter((h) => Number.isFinite(h)));
  const heights = [...new Set([...held, ...watched])].slice(0, 300);

  const sinceMs = Date.now() - windowHours * 3_600_000;
  const since = new Date(sinceMs).toISOString();
  const prevSince = new Date(sinceMs - windowHours * 3_600_000).toISOString();
  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString();

  const empty: PortfolioActivity = {
    windowHours,
    since,
    addresses,
    bitmaps: 0,
    totals: {
      visits: 0,
      newBids: 0,
      topBidSats: null,
      trades: 0,
      buildUpdates: 0,
      leasesExpiringSoon: 0,
      coinEvents: 0,
    },
    pulses: [],
    attention: [],
  };
  if (heights.length === 0) return empty;

  const [views, stats, bids, trades, builds, leases, offers, coinEvents, chat] = await Promise.all([
    client
      .from("bitmap_views")
      .select("bitmap_height, created_at")
      .in("bitmap_height", heights)
      .gte("created_at", prevSince)
      .limit(20_000),
    client
      .from("bitmap_view_stats")
      .select("bitmap_height, total_views, unique_visitors")
      .in("bitmap_height", heights),
    client
      .from("bids")
      .select("bitmap_height, price_sats, status, created_at")
      .in("bitmap_height", heights)
      .gte("created_at", since)
      .limit(2_000),
    client
      .from("trades")
      .select("bitmap_height, price_sats, created_at")
      .in("bitmap_height", heights)
      .gte("created_at", since)
      .limit(2_000),
    client
      .from("parcel_pages")
      .select("bitmap_height, build_kind, title, updated_at")
      .in("bitmap_height", heights),
    client
      .from("leases")
      .select("bitmap_height, status, created_at, ends_at")
      .in("bitmap_height", heights)
      .or(`created_at.gte.${since},and(status.eq.active,ends_at.lte.${soon})`)
      .limit(2_000),
    client
      .from("lease_offers")
      .select("bitmap_height, status")
      .in("bitmap_height", heights)
      .eq("status", "open")
      .limit(2_000),
    client
      .from("coin_events")
      .select("bitmap_height, created_at")
      .in("bitmap_height", heights)
      .gte("created_at", since)
      .limit(2_000),
    client
      .from("bitmap_chat_messages")
      .select("bitmap_height, created_at")
      .in("bitmap_height", heights)
      .gte("created_at", since)
      .limit(2_000),
  ]);

  const firstError = [views, stats, bids, trades, builds, leases, offers, coinEvents, chat].find(
    (r) => r.error,
  )?.error;
  if (firstError) throw new Error(firstError.message);

  const map = new Map<number, BitmapPulse>();
  const pulse = (height: number): BitmapPulse => {
    const existing = map.get(height);
    if (existing) return existing;
    const created: BitmapPulse = {
      height,
      name: `${height}.bitmap`,
      watched: watched.has(height),
      held: held.has(height),
      visits: 0,
      previousVisits: 0,
      visitChangePct: null,
      uniqueVisitors: 0,
      totalViews: 0,
      newBids: 0,
      topBidSats: null,
      trades: 0,
      tradeVolumeSats: 0,
      buildUpdated: false,
      buildKind: null,
      buildTitle: null,
      leaseStarted: 0,
      leaseExpiresInDays: null,
      leaseOffered: false,
      coinEvents: 0,
      chatMessages: 0,
      score: 0,
      headline: "",
      highlights: [],
    };
    map.set(height, created);
    return created;
  };

  for (const row of views.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    if (new Date(row.created_at).getTime() >= sinceMs) p.visits += 1;
    else p.previousVisits += 1;
  }
  for (const row of stats.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    p.totalViews = num(row.total_views);
    p.uniqueVisitors = num(row.unique_visitors);
  }
  for (const row of bids.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    p.newBids += 1;
    const price = num(row.price_sats);
    if (p.topBidSats === null || price > p.topBidSats) p.topBidSats = price;
  }
  for (const row of trades.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    p.trades += 1;
    p.tradeVolumeSats += num(row.price_sats);
  }
  for (const row of builds.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    p.buildKind = row.build_kind;
    p.buildTitle = row.title ?? null;
    if (new Date(row.updated_at).getTime() >= sinceMs) p.buildUpdated = true;
  }
  for (const row of leases.data ?? []) {
    const p = pulse(num(row.bitmap_height));
    if (new Date(row.created_at).getTime() >= sinceMs) p.leaseStarted += 1;
    if (row.status === "active") {
      const days = Math.ceil((new Date(row.ends_at).getTime() - Date.now()) / 86_400_000);
      if (days >= 0 && (p.leaseExpiresInDays === null || days < p.leaseExpiresInDays))
        p.leaseExpiresInDays = days;
    }
  }
  for (const row of offers.data ?? []) pulse(num(row.bitmap_height)).leaseOffered = true;
  for (const row of coinEvents.data ?? []) pulse(num(row.bitmap_height)).coinEvents += 1;
  for (const row of chat.data ?? []) pulse(num(row.bitmap_height)).chatMessages += 1;

  const pulses = [...map.values()];
  for (const p of pulses) {
    p.visitChangePct = pct(p.visits, p.previousVisits);
    p.score =
      p.newBids * 50 +
      p.trades * 40 +
      (p.leaseExpiresInDays !== null && p.leaseExpiresInDays <= 7 ? 35 : 0) +
      (p.buildUpdated ? 15 : 0) +
      p.visits * 2 +
      p.coinEvents * 10 +
      p.chatMessages * 3;

    const highlights: string[] = [];
    if (p.visits > 0) highlights.push(`+${p.visits} visit${p.visits === 1 ? "" : "s"}`);
    if (p.newBids > 0) highlights.push(`+${p.newBids} bid${p.newBids === 1 ? "" : "s"}`);
    if (p.trades > 0) highlights.push(`${p.trades} on-chain trade${p.trades === 1 ? "" : "s"}`);
    if (p.buildUpdated) highlights.push("build updated");
    if (p.leaseStarted > 0) highlights.push("lease started");
    if (p.leaseExpiresInDays !== null && p.leaseExpiresInDays <= 7)
      highlights.push(`lease ends in ${p.leaseExpiresInDays} day${p.leaseExpiresInDays === 1 ? "" : "s"}`);
    if (p.coinEvents > 0) highlights.push(`${p.coinEvents} BIT event${p.coinEvents === 1 ? "" : "s"}`);
    if (p.chatMessages > 0) highlights.push(`${p.chatMessages} chat message${p.chatMessages === 1 ? "" : "s"}`);
    if (p.visitChangePct !== null && p.visitChangePct >= 50 && p.visits >= 3)
      highlights.push(`activity up ${p.visitChangePct}%`);
    p.highlights = highlights;
    p.headline = highlights[0] ?? "quiet";
  }

  pulses.sort((a, b) => b.score - a.score || a.height - b.height);
  const ranked = pulses.filter((p) => p.score > 0).slice(0, limit);

  const attention = ranked
    .map((p) => {
      if (p.newBids > 0)
        return { height: p.height, name: p.name, reason: `new bidder — ${p.newBids} new bid(s)` };
      if (p.leaseExpiresInDays !== null && p.leaseExpiresInDays <= 7)
        return { height: p.height, name: p.name, reason: `lease ending in ${p.leaseExpiresInDays} day(s)` };
      if (p.trades > 0) return { height: p.height, name: p.name, reason: "traded on chain" };
      if (p.visitChangePct !== null && p.visitChangePct >= 50 && p.visits >= 3)
        return { height: p.height, name: p.name, reason: `activity up ${p.visitChangePct}%` };
      return null;
    })
    .filter((v): v is { height: number; name: string; reason: string } => v !== null)
    .slice(0, 5);

  const allTopBids = pulses.map((p) => p.topBidSats).filter((v): v is number => v !== null);
  return {
    windowHours,
    since,
    addresses,
    bitmaps: heights.length,
    totals: {
      visits: pulses.reduce((s, p) => s + p.visits, 0),
      newBids: pulses.reduce((s, p) => s + p.newBids, 0),
      topBidSats: allTopBids.length > 0 ? Math.max(...allTopBids) : null,
      trades: pulses.reduce((s, p) => s + p.trades, 0),
      buildUpdates: pulses.filter((p) => p.buildUpdated).length,
      leasesExpiringSoon: pulses.filter(
        (p) => p.leaseExpiresInDays !== null && p.leaseExpiresInDays <= 7,
      ).length,
      coinEvents: pulses.reduce((s, p) => s + p.coinEvents, 0),
    },
    pulses: ranked,
    attention,
  };
}
