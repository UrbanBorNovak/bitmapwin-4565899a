import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Account-saved Void progress: number of puzzle steps recorded in order. */
export const voidStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { VOID_QUEST_ID } = await import("@/lib/void-progress");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", context.userId).eq("quest_id", VOID_QUEST_ID);
    if (error) return { ok: false as const, count: 0 };
    return { ok: true as const, count: count ?? 0 };
  });

/** Records the next Void step. Requires the finished Heist; the database refuses skipped or out-of-order steps. */
export const recordVoidStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ index: z.number().int().min(0).max(2), key: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { VOID_QUEST_ID, VOID_STEPS } = await import("@/lib/void-progress");
    const { HEIST_QUEST_ID, HEIST_STEPS } = await import("@/lib/void-heist");
    if (VOID_STEPS[data.index] !== data.key) return { ok: false as const, status: "invalid" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const heist = await supabaseAdmin.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", context.userId).eq("quest_id", HEIST_QUEST_ID);
    if (heist.error) return { ok: false as const, status: "error" };
    if ((heist.count ?? 0) < HEIST_STEPS.length) return { ok: false as const, status: "locked" };
    const { data: status, error } = await supabaseAdmin.rpc("biternam_record_step", { _user: context.userId, _quest: VOID_QUEST_ID, _index: data.index, _key: data.key });
    if (error) return { ok: false as const, status: "error" };
    return { ok: status === "ok" || status === "already", status: String(status) };
  });
