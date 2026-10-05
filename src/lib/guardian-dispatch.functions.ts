import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_RANGE, cellDistance, planRoute, routeSeconds } from "@/lib/guardian-dispatch";

const deploySchema = z.object({
  height: z.number().int().min(0),
  directive: z.enum(["patrol", "march", "farm"]),
  target: z.number().int().min(0).nullable(),
});

/** Command one of your own Guardians. Ownership = the account that summoned it. */
export const deployGuardianFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deploySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g } = await supabaseAdmin
      .from("bitmon_guardians")
      .select("block_height, summoned_by_user_id, stats")
      .eq("block_height", data.height)
      .maybeSingle();
    if (!g || g.summoned_by_user_id !== context.userId)
      return { ok: false as const, error: "ONLY THE ACCOUNT THAT SUMMONED THIS GUARDIAN CAN COMMAND IT" };
    if (data.directive === "march") {
      if (data.target == null) return { ok: false as const, error: "PICK A TARGET BITMAP" };
      if (data.target === data.height) return { ok: false as const, error: "TARGET IS ITS OWN HOME" };
      if (cellDistance(data.height, data.target) > MAX_RANGE)
        return { ok: false as const, error: `TARGET TOO FAR — MAX ${MAX_RANGE} BITMAPS AWAY` };
    }
    const nowIso = new Date().toISOString();
    const { data: live } = await supabaseAdmin
      .from("guardian_dispatches")
      .select("id")
      .eq("guardian_height", data.height)
      .is("recalled_at", null)
      .gt("ends_at", nowIso)
      .limit(1);
    if (live?.length) return { ok: false as const, error: "ALREADY DEPLOYED — RECALL IT FIRST" };
    const speed = Number((g.stats as Record<string, unknown>)?.speed ?? 30) || 30;
    const start = Date.now();
    const waypoints = planRoute(data.directive, data.height, data.target, start / 1000);
    const secs = routeSeconds(waypoints, speed, data.directive);
    const { error } = await supabaseAdmin.from("guardian_dispatches").insert({
      guardian_height: data.height,
      user_id: context.userId,
      directive: data.directive,
      target_height: data.directive === "march" ? data.target : null,
      waypoints,
      started_at: new Date(start).toISOString(),
      ends_at: new Date(start + secs * 1000).toISOString(),
    });
    if (error) return { ok: false as const, error: "DISPATCH NOT RECORDED" };
    return { ok: true as const, seconds: secs };
  });

export const recallGuardianFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("guardian_dispatches")
      .update({ recalled_at: new Date().toISOString() })
      .eq("guardian_height", data.height)
      .eq("user_id", context.userId)
      .is("recalled_at", null);
    return { ok: true as const };
  });
