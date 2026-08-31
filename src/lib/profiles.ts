import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFIGS, isBuildKind, parseBuildConfig, type BuildKind } from "@/lib/build-sdk";

/**
 * Wallet profiles, owner-customised parcel pages and parcel visitor stats.
 * Ownership is enforced in the UI against the connected wallet plus the
 * on-chain owner of the parcel (no server-side identity on this app).
 */

export type WalletProfile = {
  address: string;
  displayName: string | null;
  bio: string | null;
  avatarInscriptionId: string | null;
  updatedAt: string | null;
};

export type ParcelPage = {
  bitmapHeight: number;
  ownerAddress: string;
  title: string | null;
  description: string | null;
  linkUrl: string | null;
  bannerInscriptionId: string | null;
  buildKind: BuildKind;
  buildConfig: unknown;
  updatedAt: string | null;
};

export type ViewStats = {
  bitmapHeight: number;
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
};

const VISITOR_KEY = "bitmap.visitor.key";

export function inscriptionImageUrl(id: string) {
  return `https://ordinals.com/content/${id}`;
}

export function visitorKey(): string {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(VISITOR_KEY);
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, key);
  }
  return key;
}

export async function recordBitmapView(height: number, address: string | null) {
  const visitor = visitorKey();
  if (!visitor) return;
  await supabase.rpc("record_bitmap_view", {
    _height: height,
    _visitor: visitor,
    ...(address ? { _address: address } : {}),
  });
}

export async function fetchViewStats(height: number): Promise<ViewStats | null> {
  const { data, error } = await supabase
    .from("bitmap_view_stats")
    .select("bitmap_height, total_views, unique_visitors, last_viewed_at")
    .eq("bitmap_height", height)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    bitmapHeight: Number(data.bitmap_height),
    totalViews: Number(data.total_views),
    uniqueVisitors: Number(data.unique_visitors),
    lastViewedAt: data.last_viewed_at,
  };
}

export async function fetchTrending(limit = 12): Promise<ViewStats[]> {
  const { data, error } = await supabase
    .from("bitmap_view_stats")
    .select("bitmap_height, total_views, unique_visitors, last_viewed_at")
    .order("total_views", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    bitmapHeight: Number(row.bitmap_height),
    totalViews: Number(row.total_views),
    uniqueVisitors: Number(row.unique_visitors),
    lastViewedAt: row.last_viewed_at,
  }));
}

export async function fetchProfile(address: string): Promise<WalletProfile | null> {
  const { data, error } = await supabase
    .from("wallet_profiles")
    .select("address, display_name, bio, avatar_inscription_id, updated_at")
    .eq("address", address)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    address: data.address,
    displayName: data.display_name,
    bio: data.bio,
    avatarInscriptionId: data.avatar_inscription_id,
    updatedAt: data.updated_at,
  };
}

export async function saveProfile(input: {
  address: string;
  displayName: string | null;
  bio: string | null;
  avatarInscriptionId: string | null;
}) {
  const { error } = await supabase.from("wallet_profiles").upsert(
    {
      address: input.address,
      display_name: input.displayName,
      bio: input.bio,
      avatar_inscription_id: input.avatarInscriptionId,
    },
    { onConflict: "address" },
  );
  if (error) throw error;
}

export async function fetchParcelPage(height: number): Promise<ParcelPage | null> {
  const { data, error } = await supabase
    .from("parcel_pages")
    .select("bitmap_height, owner_address, title, description, link_url, banner_inscription_id, build_kind, build_config, updated_at")
    .eq("bitmap_height", height)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    bitmapHeight: Number(data.bitmap_height),
    ownerAddress: data.owner_address,
    title: data.title,
    description: data.description,
    linkUrl: data.link_url,
    bannerInscriptionId: data.banner_inscription_id,
    buildKind: isBuildKind(data.build_kind) ? data.build_kind : "info",
    buildConfig: parseBuildConfig(
      isBuildKind(data.build_kind) ? data.build_kind : "info",
      data.build_config,
    ),
    updatedAt: data.updated_at,
  };
}

export async function saveParcelPage(input: {
  bitmapHeight: number;
  ownerAddress: string;
  title: string | null;
  description: string | null;
  linkUrl: string | null;
  bannerInscriptionId: string | null;
  buildKind?: BuildKind;
  buildConfig?: unknown;
}) {
  const kind = input.buildKind ?? "info";
  const { error } = await supabase.from("parcel_pages").upsert(
    {
      build_kind: kind,
      build_config: parseBuildConfig(kind, input.buildConfig ?? DEFAULT_CONFIGS[kind]) as never,
      bitmap_height: input.bitmapHeight,
      owner_address: input.ownerAddress,
      title: input.title,
      description: input.description,
      link_url: input.linkUrl,
      banner_inscription_id: input.bannerInscriptionId,
    },
    { onConflict: "bitmap_height" },
  );
  if (error) throw error;
}

export const profileQuery = (address: string) =>
  queryOptions({
    queryKey: ["wallet-profile", address],
    queryFn: () => fetchProfile(address),
    enabled: address !== "",
    staleTime: 60_000,
  });

export const parcelPageQuery = (height: number) =>
  queryOptions({
    queryKey: ["parcel-page", height],
    queryFn: () => fetchParcelPage(height),
    staleTime: 60_000,
  });

export const viewStatsQuery = (height: number) =>
  queryOptions({
    queryKey: ["view-stats", height],
    queryFn: () => fetchViewStats(height),
    staleTime: 15_000,
  });

export const trendingQuery = (limit = 12) =>
  queryOptions({
    queryKey: ["trending-views", limit],
    queryFn: () => fetchTrending(limit),
    staleTime: 30_000,
  });
