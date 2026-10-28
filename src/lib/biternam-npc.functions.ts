import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Free question to a Biternam character — answered in character, briefly. */
export const askNpcFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ npc: z.string().max(32), question: z.string().trim().min(1).max(240) }).parse(d))
  .handler(async ({ data }) => {
    const { npcById } = await import("@/lib/biternam-quests");
    const npc = npcById(data.npc);
    if (!npc) return { ok: false as const, text: "", error: "UNKNOWN CONTACT" };
    // AI character replies are switched off so no AI credits are spent.
    return { ok: false as const, text: "", error: "CHARACTER REPLIES ARE OFF" };
  });

/** Records one quest step on the server; only the next step in order, matching the quest definition. */
export const recordQuestStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quest: z.string().max(32), index: z.number().int().min(0).max(63), key: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { QUESTS, stepKey } = await import("@/lib/biternam-quests");
    const quest = QUESTS.find((q) => q.id === data.quest);
    const step = quest?.steps[data.index];
    if (!quest || !step || stepKey(step) !== data.key) return { ok: false as const, status: "invalid" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("biternam_record_step", { _user: context.userId, _quest: quest.id, _index: data.index, _key: data.key });
    if (error) return { ok: false as const, status: "error" };
    return { ok: status === "ok" || status === "already", status: String(status) };
  });

/** Fixed BIT for a quest the server saw completed step by step; one atomic payout per account. */
export const claimQuestRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ address: z.string().min(14).max(100), quest: z.string().max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { QUESTS } = await import("@/lib/biternam-quests");
    const quest = QUESTS.find((q) => q.id === data.quest);
    if (!quest) return { ok: false as const, already: false, error: "UNKNOWN QUEST" };
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("biternam_claim_quest", { _user: context.userId, _quest: quest.id, _steps: quest.steps.length, _address: data.address, _bit: quest.bit });
    if (error) return { ok: false as const, already: false, error: "PAYOUT FAILED — TRY AGAIN" };
    if (status === "already") return { ok: true as const, already: true, error: null };
    if (status === "incomplete") return { ok: false as const, already: false, unverified: true, error: "CHAPTER NOT VERIFIED" };
    return { ok: true as const, already: false, error: null };
  });
