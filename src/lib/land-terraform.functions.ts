/**
 * TERRAFORMED LAND — which BITMAPs have been seeded, and when.
 *
 * Growth is never stored: only the moment the land was seeded. Every client
 * derives how green a BITMAP is from real elapsed time, so vegetation keeps
 * growing whether anyone is watching or not.
 *
 * Reads are public and chunk-scoped. Seeding requires a signed-in player and
 * the seeder is taken from the session, never from the request body.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type TerraformRow = {
  id: string;
  chunk_key: string;
  bitmap_height: number;
  tile_col: number;
  tile_row: number;
  seeded_at: string;
  seeded_by_address: string | null;
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

const normalise = (row: TerraformRow): TerraformRow => ({
  ...row,
  bitmap_height: Number(row.bitmap_height),
  tile_col: Number(row.tile_col),
  tile_row: Number(row.tile_row),
});

/** Every terraformed BITMAP inside the given chunks. Public. */
export const listTerraformedLand = createServerFn({ method: "GET" })
  .inputValidator((input: { keys: string[] }) => ({
    keys: (input?.keys ?? [])
      .filter((key) => typeof key === "string" && /^\d{1,4}:\d{1,4}$/.test(key))
      .slice(0, MAX_KEYS),
  }))
  .handler(async ({ data }) => {
    if (!data.keys.length) return { land: [] as TerraformRow[] };
    const supabase = publicClient();
    const { data: rows, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: TerraformRow[] | null; error: unknown }>
    )("land_terraform_in_chunks", { _keys: data.keys });
    if (error) return { land: [] as TerraformRow[], error: "TERRAFORM READ FAILED" };
    return { land: (rows ?? []).map(normalise) };
  });

/** Start terraforming one BITMAP. Seeding the same BITMAP twice is a no-op. */
export const seedTerraform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { height: number; chunkKey: string; col: number; row: number }) => ({
    height: Math.max(0, Math.floor(Number(input?.height) || 0)),
    chunkKey: String(input?.chunkKey ?? ""),
    col: Math.max(0, Math.floor(Number(input?.col) || 0)),
    row: Math.max(0, Math.floor(Number(input?.row) || 0)),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("land_terraform")
      .select("id, chunk_key, bitmap_height, tile_col, tile_row, seeded_at, seeded_by_address")
      .eq("bitmap_height", data.height)
      .maybeSingle();
    if (existing) return { land: normalise(existing as TerraformRow), already: true };

    const { data: link } = await supabase
      .from("wallet_links")
      .select("address")
      .eq("user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error } = await supabase
      .from("land_terraform")
      .insert({
        chunk_key: data.chunkKey,
        bitmap_height: data.height,
        tile_col: data.col,
        tile_row: data.row,
        seeded_by_user_id: userId,
        seeded_by_address: link?.address ?? null,
      })
      .select("id, chunk_key, bitmap_height, tile_col, tile_row, seeded_at, seeded_by_address")
      .maybeSingle();
    if (error) {
      if (error.code === "42501") throw new Error("YOU CANNOT TERRAFORM A BITMAP YOU DO NOT HOLD");
      throw new Error(error.message);
    }
    return { land: row ? normalise(row as TerraformRow) : null, already: false };
  });
