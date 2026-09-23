/**
 * IDENTITY estate: the real holdings and history behind one Passport.
 * Everything here is read from indexed on-chain land and recorded app history —
 * nothing is invented or backfilled.
 */
import { blueprintFromManifest, blueprintSummary } from "@/lib/blueprint";

import type { EstateLand, EstateBuild, EstateVisit, EstateBlueprint, EstateTimelineEntry, PassportEstate } from "@/lib/passport-estate";
export type { EstateLand, EstateBuild, EstateVisit, EstateBlueprint, EstateTimelineEntry, PassportEstate };

const EMPTY: PassportEstate = { wallet: null, land: [], builds: [], visits: [], blueprints: [], timeline: [] };

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
      : Promise.resolve({ data: [] as any[] }),
    client.from("player_builds").select("id, bitmap_height, kind, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    client.from("world_structures").select("id, bitmap_height, kind, created_at").eq("builder_user_id", userId).order("created_at", { ascending: false }).limit(200),
    wallet
      ? client.from("parcel_pages").select("bitmap_height, build_kind, title, updated_at").eq("owner_address", wallet).order("updated_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as any[] }),
    wallet
      ? client.from("bitmap_views").select("bitmap_height, created_at").eq("viewer_address", wallet).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as any[] }),
    client.from("extenders").select("id, slug, name, created_at").eq("creator_user_id", userId).limit(60),
    client.from("extender_deployments").select("id, extender_id, bitmap_height, created_at").eq("deployed_by_user_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);
  for (const result of [land, playerBuilds, structures, pages, views, extenders, deployments]) {
    if (result.error) throw result.error;
  }

  const landRows: EstateLand[] = (land.data ?? []).map((row: any) => ({
    height: Number(row.block_height),
    inscriptionId: row.inscription_id ?? null,
  }));

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

  return { ...EMPTY, wallet, land: landRows, builds, visits, blueprints, timeline };
}
