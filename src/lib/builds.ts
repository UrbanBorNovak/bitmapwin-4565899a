import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ParcelPage } from "@/lib/profiles";

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
};

export type BuildDelegate = {
  id: string;
  bitmapHeight: number;
  ownerAddress: string;
  delegateAddress: string;
  note: string | null;
  createdAt: string;
};

export async function fetchBuilds(limit = 60): Promise<BuildEntry[]> {
  const { data, error } = await supabase
    .from("parcel_pages")
    .select(
      "bitmap_height, owner_address, title, description, link_url, banner_inscription_id, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const pages = (data ?? []).map((row) => ({
    bitmapHeight: Number(row.bitmap_height),
    ownerAddress: row.owner_address,
    title: row.title,
    description: row.description,
    linkUrl: row.link_url,
    bannerInscriptionId: row.banner_inscription_id,
    updatedAt: row.updated_at,
  })) satisfies ParcelPage[];

  if (pages.length === 0) return [];

  const { data: stats, error: statsError } = await supabase
    .from("bitmap_view_stats")
    .select("bitmap_height, total_views, unique_visitors, last_viewed_at")
    .in("bitmap_height", pages.map((p) => p.bitmapHeight));
  if (statsError) throw statsError;

  const byHeight = new Map(
    (stats ?? []).map((s) => [Number(s.bitmap_height), s] as const),
  );

  return pages
    .map((page) => {
      const stat = byHeight.get(page.bitmapHeight);
      return {
        page,
        totalViews: stat ? Number(stat.total_views) : 0,
        uniqueVisitors: stat ? Number(stat.unique_visitors) : 0,
        lastViewedAt: stat?.last_viewed_at ?? null,
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

export const buildsQuery = (limit = 60) =>
  queryOptions({ queryKey: ["builds", limit], queryFn: () => fetchBuilds(limit), staleTime: 30_000 });

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
    v: 1,
    bitmap: `${page.bitmapHeight}.bitmap`,
    owner: page.ownerAddress,
    title: page.title ?? null,
    description: page.description ?? null,
    link: page.linkUrl ?? null,
    banner: page.bannerInscriptionId ?? null,
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
