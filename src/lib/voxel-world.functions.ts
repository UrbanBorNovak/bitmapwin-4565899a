import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_IDS } from "@/lib/voxel-world";

const int = z.number().int().min(-1_000_000).max(1_000_000);

/** Public: every edit inside a square of columns around a point. */
export const voxelsNearFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ x: int, z: int, r: z.number().int().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: rows } = await sb
      .from("oasis_voxels")
      .select("x, y, z, kind")
      .gte("x", data.x - data.r).lte("x", data.x + data.r)
      .gte("z", data.z - data.r).lte("z", data.z + data.r)
      .limit(5000);
    return { blocks: (rows ?? []) as { x: number; y: number; z: number; kind: string }[] };
  });

/**
 * Signed-in: place a block (kind) or dig one out ("air"). Anyone may build
 * anywhere — a public sandbox — but each account is limited to 6 edits per
 * second burst / 240 per minute so no one can flood the world.
 */
export const editVoxelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ x: int, y: z.number().int().min(-2000).max(4000), z: int, kind: z.string().max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.kind !== "air" && !BLOCK_IDS.includes(data.kind)) return { ok: false as const, error: "UNKNOWN BLOCK" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin.from("oasis_voxels").select("x", { count: "exact", head: true })
      .eq("placed_by", context.userId).gte("updated_at", since);
    if ((count ?? 0) >= 240) return { ok: false as const, error: "SLOW DOWN — BUILD LIMIT REACHED, TRY IN A MINUTE" };
    const { error } = await supabaseAdmin.from("oasis_voxels").upsert(
      { x: data.x, y: data.y, z: data.z, kind: data.kind, placed_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "x,y,z" },
    );
    return error ? { ok: false as const, error: "COULD NOT SAVE BLOCK" } : { ok: true as const };
  });
