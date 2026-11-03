import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFIGS, isBuildKind, parseBuildConfig, type BuildKind } from "@/lib/build-sdk";
import { recordParcelBuildFn } from "@/lib/passport.functions";
import { saveWalletProfileFn } from "@/lib/profiles.functions";
import { assertSafeExternalUrl } from "@/lib/safe-url";

/**
 * Wallet profiles, owner-customised parcel pages and parcel visitor stats.
 * Ownership is enforced in the UI against the connected wallet plus the
 * on-chain owner of the parcel (no server-side identity on this app).
 */

export type WalletProfile = {
  address: string;
  displayName: string | null;
  editableDisplayName: string | null;
  residencyName: string | null;
  residencyNameInscriptionId: string | null;
  bio: string | null;
  avatarInscriptionId: string | null;
  /** Self-declared X handle; not verified against X. */
  xHandle: string | null;
  /** Set only after a public proof tweet was checked server-side. */
  xVerifiedTweetId?: string | null;
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

export type BitmapVisit = {
  id: string;
  viewerAddress: string | null;
  createdAt: string;
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
  const { recordBitmapViewFn } = await import("@/lib/views.functions");
  await recordBitmapViewFn({ data: { height, visitor, address } });
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

export async function fetchRecentBitmapVisits(height: number, limit = 8): Promise<BitmapVisit[]> {
  const { data, error } = await supabase
    .from("bitmap_views")
    .select("id, viewer_address, created_at")
    .eq("bitmap_height", height)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    viewerAddress: row.viewer_address,
    createdAt: row.created_at,
  }));
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
    .select("address, display_name, residency_name, residency_name_inscription_id, bio, avatar_inscription_id, x_handle, x_verified_tweet_id, updated_at")
    .eq("address", address)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    address: string; display_name: string | null; residency_name: string | null;
    residency_name_inscription_id: string | null; bio: string | null;
    avatar_inscription_id: string | null; x_handle: string | null; updated_at: string | null;
  };
  return {
    address: row.address,
    displayName: row.residency_name ?? row.display_name,
    editableDisplayName: row.display_name,
    residencyName: row.residency_name,
    residencyNameInscriptionId: row.residency_name_inscription_id,
    bio: row.bio,
    avatarInscriptionId: row.avatar_inscription_id,
    xHandle: (data as { x_handle?: string | null }).x_handle ?? null,
    xVerifiedTweetId: (data as { x_verified_tweet_id?: string | null }).x_verified_tweet_id ?? null,
    updatedAt: row.updated_at,
  };
}

export async function saveProfile(input: {
  address: string;
  displayName: string | null;
  bio: string | null;
  avatarInscriptionId: string | null;
  xHandle?: string | null;
}) {
  await saveWalletProfileFn({ data: input });
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
      link_url: assertSafeExternalUrl(input.linkUrl),
      banner_inscription_id: input.bannerInscriptionId,
    },
    { onConflict: "bitmap_height" },
  );
  if (error) throw error;
  // The build becomes a landmark with a provenance pin on the atlas. History is
  // a bonus, never a blocker: a signed-out or failed record must not lose the build.
  try {
    await recordParcelBuildFn({
      data: { bitmapHeight: input.bitmapHeight, buildKind: kind, title: input.title },
    });
  } catch {
    /* history recording is best-effort */
  }
}

/** Batch profile lookup so lists can show real builder names, not addresses. */
export async function fetchProfiles(addresses: string[]): Promise<Map<string, WalletProfile>> {
  const unique = Array.from(new Set(addresses.filter((a) => a !== "")));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("wallet_profiles")
    .select("address, display_name, residency_name, residency_name_inscription_id, bio, avatar_inscription_id, updated_at")
    .in("address", unique);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      row.address,
      {
        address: row.address,
        displayName: row.residency_name ?? row.display_name,
        editableDisplayName: row.display_name,
        residencyName: row.residency_name,
        residencyNameInscriptionId: row.residency_name_inscription_id,
        bio: row.bio,
        avatarInscriptionId: row.avatar_inscription_id,
        xHandle: null,
        updatedAt: row.updated_at,
      } satisfies WalletProfile,
    ]),
  );
}

export const profilesQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["wallet-profiles", [...addresses].sort()],
    queryFn: () => fetchProfiles(addresses),
    enabled: addresses.length > 0,
    staleTime: 60_000,
  });

export const recentBitmapVisitsQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap-visits", height],
    queryFn: () => fetchRecentBitmapVisits(height),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });


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
