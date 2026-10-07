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
/** Live on-chain holder of a BITMAP through any of the account's linked wallets. */
async function isLiveHolder(userId: string, height: number) {
  const { sb } = await admin();
  const { locateBitmap } = await import("@/lib/locate-bitmap.server");
  const { data: links } = await sb.from("wallet_links").select("address").eq("user_id", userId);
  for (const { address } of links ?? []) {
    if ((await locateBitmap({ height, address }).catch(() => null))?.heldByAddress) return true;
  }
  return false;
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
    if (data.kind === "air") {
      const { data: row } = await sb.from("oasis_voxels").select("placed_by").eq("x", data.x).eq("y", data.y).eq("z", data.z).maybeSingle();
      const placer = (row as { placed_by: string } | null)?.placed_by;
      if (placer && placer !== context.userId) {
        const { VOXEL } = await import("@/lib/voxel-world");
        const { colAt, rowAt, WORLD_GRID } = await import("@/lib/player-state");
        const height = rowAt((data.z + 0.5) * VOXEL) * WORLD_GRID + colAt((data.x + 0.5) * VOXEL);
        const { data: crew } = await sb.from("bitmap_crews" as never).select("user_id").eq("height", height).eq("user_id", context.userId).maybeSingle();
        if (!crew && !(await isLiveHolder(context.userId, height))) {
          return { ok: false as const, error: `ONLY THE BUILDER, THE OWNER OR THE CREW OF ${height}.BITMAP CAN BREAK THIS`, bag: await readBag(context.userId) };
        }
      }
    }
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

/** Signed-in: pickaxes this account has forged. */
export const voxelToolsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb } = await admin();
    const { data } = await sb.from("voxel_tools" as never).select("tool").eq("user_id", context.userId);
    return { tools: ((data ?? []) as { tool: string }[]).map((r) => r.tool) };
  });

/** Signed-in: forge one pickaxe at the Block Forge. */
export const forgeToolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tool: z.enum(["wood_pickaxe", "stone_pickaxe", "gold_pickaxe", "glow_pickaxe"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { rpc } = await admin();
    const { data: msg, error } = await rpc("voxel_forge", { _user: context.userId, _tool: data.tool });
    return result(error ? "COULD NOT FORGE" : msg, await readBag(context.userId));
  });

/** Signed-in: one fixed block trade at the Block Forge. */
export const forgeTradeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offer: z.string().max(24) }).parse(d))
  .handler(async ({ data, context }) => {
    const { rpc } = await admin();
    const { data: msg, error } = await rpc("voxel_trade", { _user: context.userId, _offer: data.offer });
    return result(error ? "COULD NOT TRADE" : msg, await readBag(context.userId));
  });

/**
 * Signed-in live holder only: stamp a starter template on their BITMAP.
 * The server rebuilds the blocks from the template id, so browsers can't
 * submit arbitrary structures.
 */
export const stampTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    template: z.string().max(24), height: z.number().int().min(0).max(1_000_000),
    x: int, y: z.number().int().min(-2000).max(4000), z: int,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { TEMPLATES } = await import("@/lib/voxel-templates");
    const tpl = TEMPLATES.find((t) => t.id === data.template);
    if (!tpl) return { ok: false as const, error: "NO SUCH TEMPLATE", bag: {}, blocks: [] };
    const { rpc } = await admin();
    // Anyone may build anywhere; the BITMAP owner can break guest blocks.
    const blocks = tpl.blocks.map((b) => ({ x: data.x + b.dx, y: data.y + b.dy, z: data.z + b.dz, k: b.k }));
    const { data: msg, error } = await rpc("voxel_stamp", { _user: context.userId, _blocks: blocks });
    const r = result(error ? "COULD NOT BUILD" : msg, await readBag(context.userId));
    return { ...r, blocks: r.ok ? blocks : [] };
  });
