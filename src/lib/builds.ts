import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ParcelPage } from "@/lib/profiles";
import { DEFAULT_CONFIGS, isBuildKind, parseBuildConfig } from "@/lib/build-sdk";
import { fetchRuntimeDeployments } from "@/lib/extender-code";

/**
 * The public builds directory plus build delegation. A "build" is an owner-made
 * page attached to a bitmap; the directory ranks builds by real visitor counts
 * from `bitmap_view_stats`.
 */

export type BuildEntry = {
  page: ParcelPage;
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  hasActiveExtender: boolean;
  extenderNames: string[];
};

export type BuildDelegate = {
  id: string;
  bitmapHeight: number;
  ownerAddress: string;
  delegateAddress: string;
  note: string | null;
  createdAt: string;
};

export async function fetchBuilds(): Promise<BuildEntry[]> {
  const pageRows: Array<{
    bitmap_height: number; owner_address: string; title: string | null; description: string | null;
    link_url: string | null; banner_inscription_id: string | null; build_kind: string; build_config: unknown; updated_at: string | null;
  }> = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("parcel_pages")
      .select("bitmap_height, owner_address, title, description, link_url, banner_inscription_id, build_kind, build_config, updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    pageRows.push(...((data ?? []) as typeof pageRows));
    if ((data ?? []).length < pageSize) break;
  }

  const deployments = await fetchRuntimeDeployments();
  const deploymentsByHeight = new Map<number, typeof deployments>();
  for (const deployment of deployments) {
    const stack = deploymentsByHeight.get(deployment.height) ?? [];
    stack.push(deployment);
    deploymentsByHeight.set(deployment.height, stack);
  }

  const pages = pageRows.map((row) => ({
    bitmapHeight: Number(row.bitmap_height),
    ownerAddress: row.owner_address,
    title: row.title,
    description: row.description,
    linkUrl: row.link_url,
    bannerInscriptionId: row.banner_inscription_id,
    buildKind: isBuildKind(row.build_kind) ? row.build_kind : "info",
    buildConfig: parseBuildConfig(isBuildKind(row.build_kind) ? row.build_kind : "info", row.build_config),
    updatedAt: row.updated_at,
  })) satisfies ParcelPage[];

  const pageHeights = new Set(pages.map((page) => page.bitmapHeight));
  for (const deployment of deployments) {
    if (pageHeights.has(deployment.height)) continue;
    pages.push({
      bitmapHeight: deployment.height,
      ownerAddress: "",
      title: deployment.name,
      description: `ACTIVE ${deployment.category.toUpperCase()} EXTENDER`,
      linkUrl: null,
      bannerInscriptionId: null,
      buildKind: "game3d",
      buildConfig: DEFAULT_CONFIGS.game3d,
      updatedAt: null,
    });
    pageHeights.add(deployment.height);
  }

  if (pages.length === 0) return [];

  const stats: Array<{ bitmap_height: number; total_views: number; unique_visitors: number; last_viewed_at: string | null }> = [];
  for (let start = 0; start < pages.length; start += 250) {
    const { data, error } = await supabase
      .from("bitmap_view_stats")
      .select("bitmap_height, total_views, unique_visitors, last_viewed_at")
      .in("bitmap_height", pages.slice(start, start + 250).map((page) => page.bitmapHeight));
    if (error) throw error;
    stats.push(...((data ?? []) as typeof stats));
  }

  const byHeight = new Map(
    stats.map((s) => [Number(s.bitmap_height), s] as const),
  );

  return pages
    .map((page) => {
      const stat = byHeight.get(page.bitmapHeight);
      return {
        page,
        totalViews: stat ? Number(stat.total_views) : 0,
        uniqueVisitors: stat ? Number(stat.unique_visitors) : 0,
        lastViewedAt: stat?.last_viewed_at ?? null,
        hasActiveExtender: deploymentsByHeight.has(page.bitmapHeight),
        extenderNames: (deploymentsByHeight.get(page.bitmapHeight) ?? []).map((deployment) => deployment.name),
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews || b.uniqueVisitors - a.uniqueVisitors);
}

export async function fetchDelegates(height: number): Promise<BuildDelegate[]> {
  const { data, error } = await supabase
    .from("build_delegates")
    .select("id, bitmap_height, owner_address, delegate_address, note, created_at")
    .eq("bitmap_height", height)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    bitmapHeight: Number(row.bitmap_height),
    ownerAddress: row.owner_address,
    delegateAddress: row.delegate_address,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function addDelegate(input: {
  height: number;
  ownerAddress: string;
  delegateAddress: string;
  note: string | null;
}) {
  const { error } = await supabase.from("build_delegates").insert({
    bitmap_height: input.height,
    owner_address: input.ownerAddress,
    delegate_address: input.delegateAddress,
    note: input.note,
  });
  if (error) throw error;
}

export async function removeDelegate(id: string) {
  const { error } = await supabase.from("build_delegates").delete().eq("id", id);
  if (error) throw error;
}

export const buildsQuery = () =>
  queryOptions({ queryKey: ["builds", "all-public"], queryFn: fetchBuilds, staleTime: 30_000 });

/** Chain-verified Land Forge builds (server-written directory, public read). */
export type ForgeDirEntry = { height: number; inscriptionId: string; sat: string | null; archetype: string | null; blocks: number; verifiedAt: string | null };

export async function fetchForgeDirectory(): Promise<ForgeDirEntry[]> {
  const { data, error } = await supabase
    .from("bitmap_forge_builds")
    .select("bitmap_height, inscription_id, sat, archetype, block_count, verified_at")
    .order("verified_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    height: Number(r.bitmap_height), inscriptionId: r.inscription_id, sat: r.sat ?? null,
    archetype: r.archetype ?? null, blocks: Number(r.block_count ?? 0), verifiedAt: r.verified_at ?? null,
  }));
}

export const forgeDirectoryQuery = () =>
  queryOptions({ queryKey: ["builds", "forge-directory"], queryFn: fetchForgeDirectory, staleTime: 60_000 });

export const delegatesQuery = (height: number) =>
  queryOptions({
    queryKey: ["build-delegates", height],
    queryFn: () => fetchDelegates(height),
    staleTime: 15_000,
  });

/**
 * Serialises a build into the exact JSON payload that can later be inscribed
 * on-chain as a child of `<height>.bitmap`, making the build permanent.
 */
export function buildInscriptionPayload(page: ParcelPage, district?: { name: string; slug: string } | null) {
  return {
    p: "bitmap-build",
    v: 2,
    bitmap: `${page.bitmapHeight}.bitmap`,
    owner: page.ownerAddress,
    title: page.title ?? null,
    description: page.description ?? null,
    link: page.linkUrl ?? null,
    banner: page.bannerInscriptionId ?? null,
    kind: page.buildKind,
    config: page.buildConfig,
    ...(district ? { district: { name: district.name, slug: district.slug } } : {}),
  };
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
