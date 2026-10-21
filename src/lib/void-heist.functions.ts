import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Account-saved CH.4 progress: how many links the server has recorded, and whether BIT was paid. */
export const heistStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { HEIST_QUEST_ID } = await import("@/lib/void-heist");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [steps, claim] = await Promise.all([
      supabaseAdmin.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", context.userId).eq("quest_id", HEIST_QUEST_ID),
      supabaseAdmin.from("biternam_quest_claims").select("quest_id", { count: "exact", head: true }).eq("user_id", context.userId).eq("quest_id", HEIST_QUEST_ID),
    ]);
    if (steps.error || claim.error) return { ok: false as const, stage: 0, claimed: false };
    return { ok: true as const, stage: steps.count ?? 0, claimed: (claim.count ?? 0) > 0 };
  });

/** Records the next heist link; the database refuses skipped, repeated-too-fast or out-of-order steps. */
export const recordHeistStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ index: z.number().int().min(0).max(15), key: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { HEIST_STEPS, HEIST_QUEST_ID, heistStepKey } = await import("@/lib/void-heist");
    const step = HEIST_STEPS[data.index];
    if (!step || heistStepKey(step) !== data.key) return { ok: false as const, status: "invalid" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("biternam_record_step", { _user: context.userId, _quest: HEIST_QUEST_ID, _index: data.index, _key: data.key });
    if (error) return { ok: false as const, status: "error" };
    return { ok: status === "ok" || status === "already", status: String(status) };
  });

/** Fixed CH.4 BIT, paid once per account only after all seven links were recorded in order. */
export const claimHeistRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ address: z.string().min(14).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { HEIST_STEPS, HEIST_QUEST_ID, HEIST_BIT } = await import("@/lib/void-heist");
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("biternam_claim_quest", { _user: context.userId, _quest: HEIST_QUEST_ID, _steps: HEIST_STEPS.length, _address: data.address, _bit: HEIST_BIT });
    if (error) return { ok: false as const, already: false, error: "PAYOUT FAILED — TRY AGAIN" };
    if (status === "already") return { ok: true as const, already: true, error: null };
    if (status === "incomplete") return { ok: false as const, already: false, error: "CHAPTER NOT VERIFIED" };
    return { ok: true as const, already: false, error: null };
  });
