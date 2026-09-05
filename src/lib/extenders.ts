import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * EXTENDERS — the composable packages that run on BITMAP land.
 *
 * An extender is not a model. A model is an asset; an extender is a package
 * that can carry assets, systems, configuration, dependencies, permissions and
 * persistent state, and is deployed onto one or more BITMAPs. Everything here
 * is real database state: reads are public for published records only, and
 * every write goes through `extenders.functions.ts`, which verifies live
 * on-chain ownership before touching land.
 */

export const EXTENDER_CATEGORIES = [
  { id: "games", label: "GAMES", glyph: "🎮" },
  { id: "construction", label: "CONSTRUCTION", glyph: "🏗️" },
  { id: "combat", label: "COMBAT", glyph: "⚔️" },
  { id: "world-systems", label: "WORLD SYSTEMS", glyph: "🌎" },
  { id: "economy", label: "ECONOMY", glyph: "🏪" },
  { id: "rpg", label: "RPG", glyph: "🧙" },
  { id: "vehicles", label: "VEHICLES", glyph: "🚢" },
  { id: "art", label: "ART", glyph: "🎨" },
  { id: "cities", label: "CITIES", glyph: "🏙️" },
  { id: "ai", label: "AI", glyph: "🧠" },
  { id: "dev-tools", label: "DEVELOPER TOOLS", glyph: "🧰" },
] as const;

export type ExtenderCategory = (typeof EXTENDER_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return EXTENDER_CATEGORIES.find((c) => c.id === id)?.label ?? id.toUpperCase();
}

export function categoryGlyph(id: string): string {
  return EXTENDER_CATEGORIES.find((c) => c.id === id)?.glyph ?? "🧩";
}

export const LAND_PERMISSIONS = [
  "view",
  "enter",
  "build",
  "edit",
  "deploy",
  "manage",
  "lease",
  "monetize",
] as const;
export type LandPermission = (typeof LAND_PERMISSIONS)[number];

export const SDK_VERSION = "0.1";

export type ExtenderStatus = "draft" | "published" | "archived";

export type Extender = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  creatorUserId: string;
  creatorAddress: string | null;
  iconInscriptionId: string | null;
  previewInscriptionId: string | null;
  status: ExtenderStatus;
  isAiBuilt: boolean;
  license: string;
  monetization: "free" | "paid" | "lease";
  priceSats: number;
  createdAt: string;
  updatedAt: string;
};

export type ExtenderVersion = {
  id: string;
  extenderId: string;
  semver: string;
  sdkVersion: string;
  changelog: string;
  manifest: unknown;
  status: ExtenderStatus;
  publishedAt: string | null;
  createdAt: string;
};

export type ExtenderStats = {
  extenderId: string;
  publishedVersions: number;
  activeDeployments: number;
  lastPublishedAt: string | null;
};

export type ExtenderDeployment = {
  id: string;
  extenderId: string;
  versionId: string;
  bitmapHeight: number;
  deployedByAddress: string;
  grantedVia: string;
  status: string;
  activeFrom: string;
  config: unknown;
};

export type LandGrant = {
  id: string;
  bitmapHeight: number;
  ownerAddress: string;
  granteeAddress: string;
  permissions: LandPermission[];
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const EXTENDER_COLUMNS =
  "id, slug, name, summary, description, category, tags, creator_user_id, creator_address, icon_inscription_id, preview_inscription_id, status, is_ai_built, license, monetization, price_sats, created_at, updated_at";

type ExtenderRow = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  tags: string[] | null;
  creator_user_id: string;
  creator_address: string | null;
  icon_inscription_id: string | null;
  preview_inscription_id: string | null;
  status: string;
  is_ai_built: boolean;
  license: string;
  monetization: string;
  price_sats: number;
  created_at: string;
  updated_at: string;
};

function toExtender(row: ExtenderRow): Extender {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    creatorUserId: row.creator_user_id,
    creatorAddress: row.creator_address,
    iconInscriptionId: row.icon_inscription_id,
    previewInscriptionId: row.preview_inscription_id,
    status: row.status as ExtenderStatus,
    isAiBuilt: row.is_ai_built,
    license: row.license,
    monetization: row.monetization as Extender["monetization"],
    priceSats: Number(row.price_sats),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type VersionRow = {
  id: string;
  extender_id: string;
  semver: string;
  sdk_version: string;
  changelog: string;
  manifest: unknown;
  status: string;
  published_at: string | null;
  created_at: string;
};

function toVersion(row: VersionRow): ExtenderVersion {
  return {
    id: row.id,
    extenderId: row.extender_id,
    semver: row.semver,
    sdkVersion: row.sdk_version,
    changelog: row.changelog,
    manifest: row.manifest,
    status: row.status as ExtenderStatus,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export type ExtenderFilter = {
  category?: string | "any";
  search?: string;
  aiOnly?: boolean;
  sort?: "new" | "trending" | "name";
};

/** Published extenders only — this is the public catalogue. */
export const extendersQuery = (filter: ExtenderFilter = {}) =>
  queryOptions({
    queryKey: ["extenders", filter],
    queryFn: async (): Promise<Extender[]> => {
      let query = supabase.from("extenders").select(EXTENDER_COLUMNS).eq("status", "published");
      if (filter.category && filter.category !== "any") query = query.eq("category", filter.category);
      if (filter.aiOnly) query = query.eq("is_ai_built", true);
      if (filter.search?.trim()) {
        const term = `%${filter.search.trim()}%`;
        query = query.or(`name.ilike.${term},summary.ilike.${term},slug.ilike.${term}`);
      }
      const { data, error } = await query
        .order(filter.sort === "name" ? "name" : "updated_at", { ascending: filter.sort === "name" })
        .limit(120);
      if (error) throw error;
      return (data as ExtenderRow[]).map(toExtender);
    },
    staleTime: 30_000,
  });

export const extenderStatsQuery = () =>
  queryOptions({
    queryKey: ["extender-stats"],
    queryFn: async (): Promise<Map<string, ExtenderStats>> => {
      const { data, error } = await supabase
        .from("extender_public_stats")
        .select("extender_id, published_versions, active_deployments, last_published_at");
      if (error) throw error;
      return new Map(
        (data ?? []).map((row) => [
          String(row.extender_id),
          {
            extenderId: String(row.extender_id),
            publishedVersions: Number(row.published_versions ?? 0),
            activeDeployments: Number(row.active_deployments ?? 0),
            lastPublishedAt: row.last_published_at ?? null,
          },
        ]),
      );
    },
    staleTime: 30_000,
  });

export const extenderQuery = (slug: string) =>
  queryOptions({
    queryKey: ["extender", slug],
    queryFn: async (): Promise<Extender | null> => {
      const { data, error } = await supabase
        .from("extenders")
        .select(EXTENDER_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? toExtender(data as ExtenderRow) : null;
    },
    staleTime: 30_000,
  });

export const extenderVersionsQuery = (extenderId: string | null) =>
  queryOptions({
    queryKey: ["extender-versions", extenderId],
    queryFn: async (): Promise<ExtenderVersion[]> => {
      if (!extenderId) return [];
      const { data, error } = await supabase
        .from("extender_versions")
        .select("id, extender_id, semver, sdk_version, changelog, manifest, status, published_at, created_at")
        .eq("extender_id", extenderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as VersionRow[]).map(toVersion);
    },
    enabled: Boolean(extenderId),
    staleTime: 30_000,
  });

export type VersionRequirements = {
  dependencies: { id: string; dependsOnExtenderId: string; versionRange: string; name: string | null; slug: string | null }[];
  permissions: { permission: LandPermission; reason: string }[];
};

export const versionRequirementsQuery = (versionId: string | null) =>
  queryOptions({
    queryKey: ["extender-version-requirements", versionId],
    queryFn: async (): Promise<VersionRequirements> => {
      if (!versionId) return { dependencies: [], permissions: [] };
      const [deps, perms] = await Promise.all([
        supabase
          .from("extender_dependencies")
          .select("id, depends_on_extender_id, version_range, extenders!extender_dependencies_depends_on_extender_id_fkey(name, slug)")
          .eq("version_id", versionId),
        supabase.from("extender_permissions").select("permission, reason").eq("version_id", versionId),
      ]);
      if (deps.error) throw deps.error;
      if (perms.error) throw perms.error;
      return {
        dependencies: (deps.data ?? []).map((row) => {
          const linked = row.extenders as { name: string; slug: string } | null;
          return {
            id: row.id,
            dependsOnExtenderId: row.depends_on_extender_id,
            versionRange: row.version_range,
            name: linked?.name ?? null,
            slug: linked?.slug ?? null,
          };
        }),
        permissions: (perms.data ?? []).map((row) => ({
          permission: row.permission as LandPermission,
          reason: row.reason,
        })),
      };
    },
    enabled: Boolean(versionId),
    staleTime: 30_000,
  });

/** Everything the signed-in creator owns, drafts included (RLS scopes this). */
export const myExtendersQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["my-extenders", userId],
    queryFn: async (): Promise<Extender[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("extenders")
        .select(EXTENDER_COLUMNS)
        .eq("creator_user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as ExtenderRow[]).map(toExtender);
    },
    enabled: Boolean(userId),
    staleTime: 10_000,
  });

/** Published extenders by a builder address — powers builder profiles. */
export const builderExtendersQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["builder-extenders", address],
    queryFn: async (): Promise<Extender[]> => {
      if (!address) return [];
      const { data, error } = await supabase
        .from("extenders")
        .select(EXTENDER_COLUMNS)
        .eq("creator_address", address)
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as ExtenderRow[]).map(toExtender);
    },
    enabled: Boolean(address),
    staleTime: 60_000,
  });

type DeploymentRow = {
  id: string;
  extender_id: string;
  version_id: string;
  bitmap_height: number;
  deployed_by_address: string;
  granted_via: string;
  status: string;
  active_from: string;
  config: unknown;
  extenders?: { name: string; slug: string; category: string; is_ai_built: boolean } | null;
  extender_versions?: { semver: string } | null;
};

export type DeployedExtender = ExtenderDeployment & {
  name: string;
  slug: string;
  category: string;
  isAiBuilt: boolean;
  semver: string;
};

const DEPLOYMENT_COLUMNS =
  "id, extender_id, version_id, bitmap_height, deployed_by_address, granted_via, status, active_from, config, extenders(name, slug, category, is_ai_built), extender_versions(semver)";

function toDeployment(row: DeploymentRow): DeployedExtender {
  return {
    id: row.id,
    extenderId: row.extender_id,
    versionId: row.version_id,
    bitmapHeight: Number(row.bitmap_height),
    deployedByAddress: row.deployed_by_address,
    grantedVia: row.granted_via,
    status: row.status,
    activeFrom: row.active_from,
    config: row.config,
    name: row.extenders?.name ?? "UNKNOWN EXTENDER",
    slug: row.extenders?.slug ?? "",
    category: row.extenders?.category ?? "world-systems",
    isAiBuilt: row.extenders?.is_ai_built ?? false,
    semver: row.extender_versions?.semver ?? "—",
  };
}

/** Active extenders deployed on one BITMAP — the tile's live software stack. */
export const tileDeploymentsQuery = (height: number) =>
  queryOptions({
    queryKey: ["tile-deployments", height],
    queryFn: async (): Promise<DeployedExtender[]> => {
      const { data, error } = await supabase
        .from("extender_deployments")
        .select(DEPLOYMENT_COLUMNS)
        .eq("bitmap_height", height)
        .eq("status", "active")
        .order("active_from", { ascending: false });
      if (error) throw error;
      return (data as DeploymentRow[]).map(toDeployment);
    },
    staleTime: 30_000,
  });

/** Every active deployment across the world — used by the map and MY WORLD. */
export const worldDeploymentsQuery = (limit = 500) =>
  queryOptions({
    queryKey: ["world-deployments", limit],
    queryFn: async (): Promise<DeployedExtender[]> => {
      const { data, error } = await supabase
        .from("extender_deployments")
        .select(DEPLOYMENT_COLUMNS)
        .eq("status", "active")
        .order("active_from", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as DeploymentRow[]).map(toDeployment);
    },
    staleTime: 30_000,
  });

export const myDeploymentsQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["my-deployments", [...addresses].sort()],
    queryFn: async (): Promise<DeployedExtender[]> => {
      if (addresses.length === 0) return [];
      const { data, error } = await supabase
        .from("extender_deployments")
        .select(DEPLOYMENT_COLUMNS)
        .in("deployed_by_address", addresses)
        .order("active_from", { ascending: false });
      if (error) throw error;
      return (data as DeploymentRow[]).map(toDeployment);
    },
    enabled: addresses.length > 0,
    staleTime: 30_000,
  });

export const landGrantsQuery = (height: number | null) =>
  queryOptions({
    queryKey: ["land-grants", height],
    queryFn: async (): Promise<LandGrant[]> => {
      if (height === null) return [];
      const { data, error } = await supabase
        .from("land_grants")
        .select("id, bitmap_height, owner_address, grantee_address, permissions, note, expires_at, created_at")
        .eq("bitmap_height", height);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        bitmapHeight: Number(row.bitmap_height),
        ownerAddress: row.owner_address,
        granteeAddress: row.grantee_address,
        permissions: (row.permissions ?? []) as LandPermission[],
        note: row.note,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    },
    enabled: height !== null,
    staleTime: 15_000,
  });

export type City = {
  id: string;
  slug: string;
  name: string;
  description: string;
  bannerInscriptionId: string | null;
  founderAddress: string;
  createdAt: string;
  heights: number[];
};

export const citiesQuery = () =>
  queryOptions({
    queryKey: ["cities"],
    queryFn: async (): Promise<City[]> => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, slug, name, description, banner_inscription_id, founder_address, created_at, city_bitmaps(bitmap_height)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        bannerInscriptionId: row.banner_inscription_id,
        founderAddress: row.founder_address,
        createdAt: row.created_at,
        heights: ((row.city_bitmaps ?? []) as { bitmap_height: number }[])
          .map((b) => Number(b.bitmap_height))
          .sort((a, b) => a - b),
      }));
    },
    staleTime: 60_000,
  });

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
