/**
 * IDENTITY estate: the real holdings and history behind one Passport.
 * Everything here is read from indexed on-chain land and recorded app history —
 * nothing is invented or backfilled.
 */
import { blueprintFromManifest, blueprintSummary } from "@/lib/blueprint";

import type { ChainProof, GameStats, EstateLand, EstateBuild, EstateVisit, EstateBlueprint, EstateTimelineEntry, PassportEstate } from "@/lib/passport-estate";
export type { EstateLand, EstateBuild, EstateVisit, EstateBlueprint, EstateTimelineEntry, PassportEstate };

const EMPTY_GAME: GameStats = { level: null, fame: null, pvpKills: 0, deaths: 0, districtsVisited: 0, buildsMaintained: 0, matches: 0, wins: 0, losses: 0, bestStreak: 0, bitBalance: 0, bitEarned: 0 };
const EMPTY: PassportEstate = { chain: [], game: EMPTY_GAME, wallet: null, land: [], builds: [], visits: [], blueprints: [], timeline: [] };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readPassportEstate(userId: string): Promise<PassportEstate> {
  const client = await db();
  const links = await client
    .from("wallet_links")
    .select("address")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(1);
  if (links.error) throw links.error;
  const wallet = links.data?.[0]?.address ?? null;

  const [land, playerBuilds, structures, pages, views, extenders, deployments] = await Promise.all([
    wallet
      ? client.from("bitmap_index").select("block_height, inscription_id, genesis_height").eq("owner_address", wallet).eq("is_valid", true).order("block_height", { ascending: true }).limit(400)
      : Promise.resolve({ data: [] as any[], error: null }),
    client.from("player_builds").select("id, bitmap_height, kind, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    client.from("world_structures").select("id, bitmap_height, kind, created_at").eq("builder_user_id", userId).order("created_at", { ascending: false }).limit(200),
    wallet
      ? client.from("parcel_pages").select("bitmap_height, build_kind, title, updated_at").eq("owner_address", wallet).order("updated_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as any[], error: null }),
    wallet
      ? client.from("bitmap_views").select("bitmap_height, created_at").eq("viewer_address", wallet).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as any[], error: null }),
    client.from("extenders").select("id, slug, name, created_at").eq("creator_user_id", userId).limit(60),
    client.from("extender_deployments").select("id, extender_id, bitmap_height, created_at").eq("deployed_by_user_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);
  for (const result of [land, playerBuilds, structures, pages, views, extenders, deployments]) {
    if (result.error) throw result.error;
  }

  const landRows: EstateLand[] = (land.data ?? []).map((row: any) => ({
    height: Number(row.block_height),
    inscriptionId: row.inscription_id ?? null,
    totalViews: 0,
    uniqueVisitors: 0,
    buildRecords: 0,
    installRecords: 0,
    lastActivityAt: null,
  }));

  if (landRows.length > 0) {
    const heights = landRows.map((row) => row.height);
    const [viewStats, territoryEvents] = await Promise.all([
      client
        .from("bitmap_view_stats")
        .select("bitmap_height, total_views, unique_visitors, last_viewed_at")
        .in("bitmap_height", heights),
      client
        .from("provenance_events")
        .select("bitmap_height, event_type, occurred_at")
        .in("bitmap_height", heights)
        .eq("visibility", "public")
        .in("event_type", ["build", "deployment"])
        .limit(5000),
    ]);
    if (viewStats.error) throw viewStats.error;
    if (territoryEvents.error) throw territoryEvents.error;
    const statsByHeight = new Map((viewStats.data ?? []).map((row: any) => [Number(row.bitmap_height), row]));
    const eventsByHeight = new Map<number, { builds: number; installs: number; latest: string | null }>();
    for (const row of territoryEvents.data ?? []) {
      const height = Number((row as any).bitmap_height);
      const current = eventsByHeight.get(height) ?? { builds: 0, installs: 0, latest: null };
      if ((row as any).event_type === "build") current.builds += 1;
      if ((row as any).event_type === "deployment") current.installs += 1;
      const occurredAt = (row as any).occurred_at as string;
      if (!current.latest || occurredAt > current.latest) current.latest = occurredAt;
      eventsByHeight.set(height, current);
    }
    for (const row of landRows) {
      const stats = statsByHeight.get(row.height) as any;
      const events = eventsByHeight.get(row.height);
      row.totalViews = Number(stats?.total_views ?? 0);
      row.uniqueVisitors = Number(stats?.unique_visitors ?? 0);
      row.buildRecords = events?.builds ?? 0;
      row.installRecords = events?.installs ?? 0;
      row.lastActivityAt = [stats?.last_viewed_at ?? null, events?.latest ?? null]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    }
  }

  const builds: EstateBuild[] = [
    ...(playerBuilds.data ?? []).map((row: any) => ({ id: `pb-${row.id}`, height: Number(row.bitmap_height), kind: String(row.kind), source: "OASIS BUILD", createdAt: row.created_at })),
    ...(structures.data ?? []).map((row: any) => ({ id: `ws-${row.id}`, height: Number(row.bitmap_height), kind: String(row.kind), source: "WORLD STRUCTURE", createdAt: row.created_at })),
    ...(pages.data ?? []).map((row: any) => ({ id: `pp-${row.bitmap_height}`, height: Number(row.bitmap_height), kind: String(row.build_kind ?? "page"), source: "LANDMARK PAGE", createdAt: row.updated_at })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const visitMap = new Map<number, EstateVisit>();
  for (const row of views.data ?? []) {
    const height = Number((row as any).bitmap_height);
    const at = (row as any).created_at as string;
    const current = visitMap.get(height);
    if (current) {
      current.visits += 1;
      if (at > current.lastAt) current.lastAt = at;
    } else visitMap.set(height, { height, visits: 1, lastAt: at });
  }
  const visits = [...visitMap.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const none = Promise.resolve({ data: [] as any[], error: null });
  const [trades, rank, play, coins] = await Promise.all([
    wallet ? client.from("trades").select("txid, bitmap_height, buyer_address, seller_address, price_sats, block_height, block_time").or(`buyer_address.eq.${wallet},seller_address.eq.${wallet}`).order("block_height", { ascending: false }).limit(100) : none,
    client.from("rank_players").select("level, fame, pvp_kills, deaths, districts_visited, builds_maintained, wallet").or(wallet ? `user_id.eq.${userId},wallet.eq.${wallet}` : `user_id.eq.${userId}`).limit(5),
    client.from("play_profiles").select("matches, wins, losses, best_streak").eq("user_id", userId).limit(1),
    wallet ? client.from("coin_balances").select("balance, earned_total").eq("address", wallet).limit(1) : none,
  ]);
  for (const r of [trades, rank, play, coins]) if (r.error) throw r.error;
  const chain: ChainProof[] = (trades.data ?? []).map((t: any) => ({
    txid: t.txid, height: Number(t.bitmap_height), side: t.buyer_address === wallet ? "BUY" : "SELL",
    priceSats: Number(t.price_sats ?? 0), blockHeight: t.block_height === null ? null : Number(t.block_height), at: t.block_time ?? null,
  }));
  const r0: any = (rank.data ?? [])[0]; const p0: any = (play.data ?? [])[0]; const c0: any = (coins.data ?? [])[0];
  const game: GameStats = {
    level: r0 ? Number(r0.level) : null, fame: r0 ? Number(r0.fame) : null,
    pvpKills: Number(r0?.pvp_kills ?? 0), deaths: Number(r0?.deaths ?? 0), districtsVisited: Number(r0?.districts_visited ?? 0), buildsMaintained: Number(r0?.builds_maintained ?? 0),
    matches: Number(p0?.matches ?? 0), wins: Number(p0?.wins ?? 0), losses: Number(p0?.losses ?? 0), bestStreak: Number(p0?.best_streak ?? 0),
    bitBalance: Number(c0?.balance ?? 0), bitEarned: Number(c0?.earned_total ?? 0),
  };

  const extenderRows = extenders.data ?? [];
  const versions = extenderRows.length
    ? await client
        .from("extender_versions")
        .select("id, extender_id, semver, manifest, published_at, status")
        .in("extender_id", extenderRows.map((row: any) => row.id))
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200)
    : { data: [] as any[] };
  if ("error" in versions && versions.error) throw versions.error;

  const deploymentRows = deployments.data ?? [];
  const blueprints: EstateBlueprint[] = [];
  for (const version of versions.data ?? []) {
    const blueprint = blueprintFromManifest((version as any).manifest);
    if (!blueprint) continue;
    const extender = extenderRows.find((row: any) => row.id === (version as any).extender_id);
    if (!extender) continue;
    if (blueprints.some((b) => b.slug === (extender as any).slug)) continue;
    blueprints.push({
      id: (version as any).id,
      slug: (extender as any).slug,
      name: blueprint.name || (extender as any).name,
      semver: (version as any).semver,
      pieces: blueprint.pieces.length,
      summary: blueprintSummary(blueprint),
      publishedAt: (version as any).published_at ?? (extender as any).created_at,
      deployments: deploymentRows.filter((row: any) => row.extender_id === (extender as any).id).length,
    });
  }

  const timeline: EstateTimelineEntry[] = [
    ...builds.map((build) => ({
      id: `t-${build.id}`,
      at: build.createdAt,
      kind: "build" as const,
      height: build.height,
      title: "BUILT",
      detail: `${build.kind.replaceAll("-", " ").toUpperCase()} · ${build.source}`,
    })),
    ...visits.slice(0, 60).map((visit) => ({
      id: `t-visit-${visit.height}`,
      at: visit.lastAt,
      kind: "visit" as const,
      height: visit.height,
      title: "VISITED",
      detail: `${visit.visits} RECORDED ENTR${visit.visits === 1 ? "Y" : "IES"}`,
    })),
    ...blueprints.map((blueprint) => ({
      id: `t-bp-${blueprint.id}`,
      at: blueprint.publishedAt,
      kind: "blueprint" as const,
      height: null,
      title: "BLUEPRINT PUBLISHED",
      detail: `${blueprint.name} v${blueprint.semver} · ${blueprint.pieces} PIECES`,
    })),
    ...deploymentRows.map((row: any) => ({
      id: `t-dep-${row.id}`,
      at: row.created_at,
      kind: "deployment" as const,
      height: Number(row.bitmap_height),
      title: "EXPERIENCE DEPLOYED",
      detail: "EXTENDER ACTIVATED ON LAND",
    })),
  ]
    .filter((entry) => Boolean(entry.at))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 120);

  // Holder Epoch: genesis heights of held land + this wallet's latest traced buy.
  let epoch: PassportEstate["epoch"] = null;
  if (wallet && (land.data ?? []).length) {
    const tip = await fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.text() : "")).then((t) => Number(t)).catch(() => 0);
    if (tip > 0) {
      const { computeHolderEpoch } = await import("@/lib/holder-epoch");
      const purchases = new Map<number, number>();
      for (const t of trades.data ?? []) {
        if ((t as any).buyer_address !== wallet || (t as any).block_height == null) continue;
        const h = Number((t as any).bitmap_height); const b = Number((t as any).block_height);
        if ((purchases.get(h) ?? 0) < b) purchases.set(h, b);
      }
      epoch = computeHolderEpoch(tip, (land.data ?? []).map((r: any) => ({ height: Number(r.block_height), genesisHeight: r.genesis_height == null ? null : Number(r.genesis_height) })), purchases);
      try {
        const { readLandBoosts } = await import("@/lib/land-epoch.server");
        const boosts = await readLandBoosts(epoch.lands.map((l) => l.height));
        for (const l of epoch.lands) { const b = boosts.get(l.height); if (b) l.boost = b; }
      } catch { /* boosts are optional decoration */ }
    }
  }
  return { ...EMPTY, chain, game, wallet, land: landRows, builds, visits, blueprints, timeline, epoch };
}
