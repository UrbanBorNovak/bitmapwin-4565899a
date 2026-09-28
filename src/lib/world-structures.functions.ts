/**
 * SHARED WORLD STRUCTURES — the mutable game world, stored in the backend.
 *
 * Reads are public and chunk-scoped: a visitor only ever pulls the structures
 * inside the chunks around them. Writes require a signed-in player, and the
 * builder is taken from the session, never from the request body.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type WorldStructureRow = {
  id: string;
  chunk_key: string;
  bitmap_height: number;
  tile_col: number;
  tile_row: number;
  kind: string;
  x: number;
  z: number;
  yaw: number;
  builder_address: string | null;
  created_at: string;
};

const MAX_KEYS = 49;

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Every structure inside the given chunks. Public: visitors see the world too. */
export const listWorldStructures = createServerFn({ method: "GET" })
  .inputValidator((input: { keys: string[] }) => ({
    keys: (input?.keys ?? [])
      .filter((key) => typeof key === "string" && /^\d{1,4}:\d{1,4}$/.test(key))
      .slice(0, MAX_KEYS),
  }))
  .handler(async ({ data }) => {
    if (!data.keys.length) return { structures: [] as WorldStructureRow[] };
    try {
      const supabase = publicClient();
      const { data: rows, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: WorldStructureRow[] | null; error: unknown }>
      )("world_structures_in_chunks", { _keys: data.keys });
      if (error) return { structures: [] as WorldStructureRow[], error: "WORLD READ FAILED" };
      return { structures: (rows ?? []).map(normalise) };
    } catch {
      // A brief backend or network hiccup must never blank the Oasis.
      return { structures: [] as WorldStructureRow[], error: "WORLD READ FAILED" };
    }
  });

function normalise(row: WorldStructureRow): WorldStructureRow {
  return {
    ...row,
    bitmap_height: Number(row.bitmap_height),
    x: Number(row.x),
    z: Number(row.z),
    yaw: Number(row.yaw),
  };
}

type PlaceInput = {
  templateId?: string;
  items: {
    kind: string;
    chunkKey: string;
    height: number;
    col: number;
    row: number;
    x: number;
    z: number;
    yaw: number;
  }[];
};

/** Raise one or more structures. The session decides who the builder is. */
export const placeWorldStructures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PlaceInput) => ({
    templateId: input?.templateId ? String(input.templateId).slice(0, 40) : undefined,
    items: (input?.items ?? []).slice(0, 20).map((item) => ({
      kind: String(item.kind).slice(0, 40),
      chunkKey: String(item.chunkKey),
      height: Math.max(0, Math.floor(Number(item.height) || 0)),
      col: Math.max(0, Math.floor(Number(item.col) || 0)),
      row: Math.max(0, Math.floor(Number(item.row) || 0)),
      x: Number(item.x) || 0,
      z: Number(item.z) || 0,
      yaw: Number(item.yaw) || 0,
    })),
  }))
  .handler(async ({ data, context }) => {
    if (!data.items.length) return { structures: [] as WorldStructureRow[] };
    const { supabase, userId } = context;

    const requiredCapability: Record<string, string> = {
      "trail-marker": "build.trail-marker",
      "oasis-waystation": "build.oasis-waystation",
      "fortified-camp": "build.fortified-camp",
      "district-gate": "build.district-gate",
    };
    const capability = data.templateId ? requiredCapability[data.templateId] : undefined;
    if (capability) {
      const { data: allowed, error: unlockError } = await supabase.rpc("has_passport_unlock", {
        _user_id: userId,
        _capability_key: capability,
      });
      if (unlockError || !allowed) throw new Error("THIS BLUEPRINT IS LOCKED BY YOUR PASSPORT HISTORY");
    }

    const { data: link } = await supabase
      .from("wallet_links")
      .select("address")
      .eq("user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: rows, error } = await supabase
      .from("world_structures")
      .insert(
        data.items.map((item) => ({
          chunk_key: item.chunkKey,
          bitmap_height: item.height,
          tile_col: item.col,
          tile_row: item.row,
          kind: item.kind,
          x: item.x,
          z: item.z,
          yaw: item.yaw,
          builder_user_id: userId,
          builder_address: link?.address ?? null,
        })),
      )
      .select(
        "id, chunk_key, bitmap_height, tile_col, tile_row, kind, x, z, yaw, builder_address, created_at",
      );
    if (error) {
      if (error.code === "42501") throw new Error("YOU CANNOT BUILD ON A BITMAP YOU DO NOT HOLD");
      throw new Error(error.message);
    }
    if (rows?.length) {
      const { appendProvenance, syncPassport } = await import("@/lib/passport.server");
      for (const row of rows) {
        await appendProvenance({ sourceKey: `build:${row.id}`, eventType: "build", userId, wallet: row.builder_address, bitmapHeight: Number(row.bitmap_height), sourceType: "persistent_build", sourceId: row.id, proofLevel: "WORLD", title: "HISTORY BUILT", summary: `${String(row.kind).replaceAll("-", " ").toUpperCase()} placed on ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at });
      }
      await syncPassport(userId);
    }
    return { structures: (rows ?? []).map((row) => normalise(row as WorldStructureRow)) };
  });

/** Remove a structure. The row policy allows only the builder's own rows. */
export const removeWorldStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("world_structures")
      .delete()
      .eq("id", data.id)
      .eq("builder_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------ personal build vault */

/**
 * PLAYER BUILDS — a signed-in player's own structures, saved even when they
 * stand on land the player does not hold. The shared world only accepts builds
 * on your own land, so without this vault everything else would be lost on
 * reload. Rows are private: policies scope every read and write to the owner.
 */
export type PlayerBuildRow = {
  id: string;
  chunk_key: string;
  bitmap_height: number;
  kind: string;
  x: number;
  z: number;
  yaw: number;
  builder_address: string | null;
  created_at: string;
  clan_id?: string | null;
  clan_tag?: string | null;
};

const MAX_VAULT = 400;

function normalisePlayerBuild(row: PlayerBuildRow): PlayerBuildRow {
  return {
    ...row,
    bitmap_height: Number(row.bitmap_height),
    x: Number(row.x),
    z: Number(row.z),
    yaw: Number(row.yaw),
  };
}

const VAULT_COLUMNS =
  "id, chunk_key, bitmap_height, kind, x, z, yaw, builder_address, created_at, clan_id, clan_tag";

/** The clan this player belongs to, if any — builds are stamped with it. */
async function myClan(supabase: { from: (table: string) => any }, userId: string) {
  const { data: membership } = await supabase
    .from("clan_members")
    .select("clan_id")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  if (!membership?.clan_id) return null;
  const { data: clan } = await supabase
    .from("clans")
    .select("id, tag")
    .eq("id", membership.clan_id)
    .maybeSingle();
  if (!clan) return null;
  return { id: clan.id as string, tag: String(clan.tag).toUpperCase() };
}

/** Everything this player has ever raised, newest last. */
export const listMyBuilds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("player_builds")
      .select(VAULT_COLUMNS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_VAULT);
    if (error) throw new Error(error.message);
    return { builds: (rows ?? []).map((row) => normalisePlayerBuild(row as PlayerBuildRow)) };
  });

/** Save builds to the player's own vault. The session decides the owner. */
export const savePlayerBuilds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PlaceInput) => ({
    templateId: input?.templateId ? String(input.templateId).slice(0, 40) : undefined,
    items: (input?.items ?? []).slice(0, 20).map((item) => ({
      kind: String(item.kind).slice(0, 40),
      chunkKey: String(item.chunkKey),
      height: Math.max(0, Math.floor(Number(item.height) || 0)),
      x: Number(item.x) || 0,
      z: Number(item.z) || 0,
      yaw: Number(item.yaw) || 0,
    })),
  }))
  .handler(async ({ data, context }) => {
    if (!data.items.length) return { builds: [] as PlayerBuildRow[] };
    const { supabase, userId } = context;

    const requiredCapability: Record<string, string> = {
      "trail-marker": "build.trail-marker",
      "oasis-waystation": "build.oasis-waystation",
      "fortified-camp": "build.fortified-camp",
      "district-gate": "build.district-gate",
    };
    const capability = data.templateId ? requiredCapability[data.templateId] : undefined;
    if (capability) {
      const { data: allowed, error: unlockError } = await supabase.rpc("has_passport_unlock", { _user_id: userId, _capability_key: capability });
      if (unlockError || !allowed) throw new Error("THIS BLUEPRINT IS LOCKED BY YOUR PASSPORT HISTORY");
    }

    const { data: link } = await supabase
      .from("wallet_links")
      .select("address")
      .eq("user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const clan = await myClan(supabase as never, userId);

    const { data: rows, error } = await supabase
      .from("player_builds")
      .insert(
        data.items.map((item) => ({
          user_id: userId,
          builder_address: link?.address ?? null,
          clan_id: clan?.id ?? null,
          clan_tag: clan?.tag ?? null,
          chunk_key: item.chunkKey,
          bitmap_height: item.height,
          kind: item.kind,
          x: item.x,
          z: item.z,
          yaw: item.yaw,
        })),
      )
      .select(VAULT_COLUMNS);
    if (error) throw new Error(error.message);
    if (rows?.length) {
      const { appendProvenance, syncPassport } = await import("@/lib/passport.server");
      for (const row of rows) {
        await appendProvenance({ sourceKey: `build:${row.id}`, eventType: "build", userId, wallet: row.builder_address, bitmapHeight: Number(row.bitmap_height), sourceType: "persistent_build", sourceId: row.id, proofLevel: "WORLD", title: "HISTORY BUILT", summary: `${String(row.kind).replaceAll("-", " ").toUpperCase()} placed on ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at });
      }
      await syncPassport(userId);
    }
    return { builds: (rows ?? []).map((row) => normalisePlayerBuild(row as PlayerBuildRow)) };
  });

/** Drop one saved build. Policies allow only the player's own rows. */
export const removePlayerBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("player_builds")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * CLAN BUILDS — everything raised by the player's clan mates. Policies let a
 * clan member read rows stamped with their own clan, so the whole banner shares
 * one set of structures in the world.
 */
export const listClanBuilds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clan = await myClan(context.supabase as never, context.userId);
    if (!clan) return { tag: null as string | null, builds: [] as PlayerBuildRow[] };
    const { data: rows, error } = await context.supabase
      .from("player_builds")
      .select(VAULT_COLUMNS)
      .eq("clan_id", clan.id)
      .order("created_at", { ascending: false })
      .limit(MAX_VAULT);
    if (error) throw new Error(error.message);
    return {
      tag: clan.tag,
      builds: (rows ?? []).map((row) => normalisePlayerBuild(row as PlayerBuildRow)),
    };
  });

/** Public roll-call of a clan's structures, for the clan page. */
export const clanBuildsByTag = createServerFn({ method: "GET" })
  .inputValidator((input: { tag: string }) => ({
    tag: String(input?.tag ?? "").toUpperCase().slice(0, 6),
  }))
  .handler(async ({ data }) => {
    if (!data.tag) return { builds: [] as PlayerBuildRow[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("clan_builds_by_tag", { _tag: data.tag });
    if (error) throw new Error(error.message);
    return {
      builds: ((rows ?? []) as PlayerBuildRow[]).map((row) => normalisePlayerBuild(row)),
    };
  });
