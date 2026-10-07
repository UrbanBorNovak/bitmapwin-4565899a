/**
 * HOLDER SPAWN POINTS — the arrival spot a BITMAP holder sets on their land.
 * Reads are public (shared links use them); writes re-check live on-chain
 * ownership of the BITMAP on the server before saving.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SpawnPoint = { height: number; x: number; z: number; yaw: number };

export const getSpawnPoint = createServerFn({ method: "GET" })
  .inputValidator((input: { height: number }) => {
    const height = Number(input?.height);
    if (!Number.isInteger(height) || height < 0 || height >= 1_000_000) throw new Error("BAD HEIGHT");
    return { height };
  })
  .handler(async ({ data }): Promise<SpawnPoint | null> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await (supabaseAdmin.from as unknown as (t: string) => any)("bitmap_spawn_points")
        .select("bitmap_height,x,z,yaw")
        .eq("bitmap_height", data.height)
        .maybeSingle();
      if (!row) return null;
      return { height: Number(row.bitmap_height), x: Number(row.x), z: Number(row.z), yaw: Number(row.yaw) };
    } catch {
      return null;
    }
  });

export const setSpawnPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SpawnPoint) => {
    const height = Number(input?.height);
    const x = Number(input?.x);
    const z = Number(input?.z);
    const yaw = Number(input?.yaw);
    if (!Number.isInteger(height) || height < 0 || height >= 1_000_000) throw new Error("BAD HEIGHT");
    if (![x, z, yaw].every(Number.isFinite)) throw new Error("BAD POSITION");
    return { height, x, z, yaw };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { locateBitmap } = await import("@/lib/locate-bitmap.server");
    const { data: links } = await supabaseAdmin.from("wallet_links").select("address").eq("user_id", context.userId);
    let owner: string | null = null;
    for (const { address } of links ?? []) {
      const loc = await locateBitmap({ height: data.height, address });
      if (loc.heldByAddress) {
        owner = address;
        break;
      }
    }
    if (!owner) return { ok: false, reason: "ONLY THE LIVE HOLDER OF THIS BITMAP CAN SET ITS SPAWN" };
    const { error } = await (supabaseAdmin.from as unknown as (t: string) => any)("bitmap_spawn_points").upsert({
      bitmap_height: data.height,
      x: data.x,
      z: data.z,
      yaw: data.yaw,
      owner_address: owner,
      set_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, reason: "SAVE FAILED" };
    return { ok: true };
  });
