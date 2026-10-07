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

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { sb: supabaseAdmin, rpc: supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc };
}
async function readBag(userId: string) {
  const { sb, rpc } = await admin();
  await rpc("voxel_bag_ensure", { _user: userId });
  const { data } = await sb.from("voxel_bags" as never).select("kind, count").eq("user_id", userId);
  const bag: Record<string, number> = {};
  for (const r of (data ?? []) as { kind: string; count: number }[]) bag[r.kind] = r.count;
  return bag;
}
const result = (msg: unknown, bag: Record<string, number>) =>
  msg === "ok" ? { ok: true as const, bag } : { ok: false as const, error: String(msg ?? "FAILED"), bag };

/** Signed-in: the player's block bag (server-held). */
export const voxelBagFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ bag: await readBag(context.userId) }));

/**
 * Signed-in: place a block from the bag, or break a placed block ("air") back
 * into the bag. 240 edits per minute per account.
 */
export const editVoxelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ x: int, y: z.number().int().min(-2000).max(4000), z: int, kind: z.string().max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.kind !== "air" && !BLOCK_IDS.includes(data.kind)) return { ok: false as const, error: "UNKNOWN BLOCK", bag: {} };
    const { sb, rpc } = await admin();
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await sb.from("oasis_voxels").select("x", { count: "exact", head: true })
      .eq("placed_by", context.userId).gte("updated_at", since);
    if ((count ?? 0) >= 240) return { ok: false as const, error: "SLOW DOWN — BUILD LIMIT REACHED", bag: await readBag(context.userId) };
    const { data: msg, error } = await rpc("voxel_edit", { _user: context.userId, _x: data.x, _y: data.y, _z: data.z, _kind: data.kind });
    return result(error ? "COULD NOT SAVE BLOCK" : msg, await readBag(context.userId));
  });

/** Signed-in: gather one raw block from natural ground. */
export const harvestVoxelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["grass", "dirt", "sand", "cobble"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { rpc } = await admin();
    const { data: msg, error } = await rpc("voxel_harvest", { _user: context.userId, _kind: data.kind });
    return result(error ? "COULD NOT GATHER" : msg, await readBag(context.userId));
  });

/** Signed-in: craft one recipe (see RECIPES). */
export const craftVoxelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ out: z.string().max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { rpc } = await admin();
    const { data: msg, error } = await rpc("voxel_craft", { _user: context.userId, _out: data.out });
    return result(error ? "COULD NOT CRAFT" : msg, await readBag(context.userId));
  });
