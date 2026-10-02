/**
 * IRON WALKER RAID — one shared health pool per giant walker. Every signed-in
 * player's hits land on the same row, and the killing blow scores the kill.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hitSchema = z.object({
  walker: z.enum(["walker-a", "walker-b"]),
  name: z.string().trim().min(1).max(32),
  damage: z.number().int().min(1).max(80),
});

export const hitWalkerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => hitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("walker_hit", {
      _walker: data.walker,
      _user: context.userId,
      _name: data.name.toUpperCase(),
      _damage: data.damage,
    });
    if (error) return { ok: false as const, error: "HIT NOT RECORDED" };
    const row = rows?.[0];
    return {
      ok: true as const,
      hp: row?.hp ?? 0,
      maxHp: row?.max_hp ?? 0,
      killed: Boolean(row?.killed),
      respawnAt: row?.respawn_at ?? null,
    };
  });
