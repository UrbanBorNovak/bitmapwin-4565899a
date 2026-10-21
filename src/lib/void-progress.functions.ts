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
    const { recordVoidStep } = await import("@/lib/void-progress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return recordVoidStep(supabaseAdmin as never, context.userId, data);
  });
