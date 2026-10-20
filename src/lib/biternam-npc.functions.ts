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
    const { askInCharacter } = await import("@/lib/biternam-npc.server");
    return askInCharacter(npc.name, npc.persona, data.question);
  });

/** Fixed BIT for a finished quest, once per account. */
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
    const ref = `quest:${quest.id}:${context.userId}`;
    const { count } = await supabaseAdmin.from("coin_ledger").select("id", { count: "exact", head: true }).eq("reason", "biternam_quest").eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: true as const, already: true, error: null };
    const { error } = await supabaseAdmin.rpc("coin_apply", { _address: data.address, _delta: quest.bit, _reason: "biternam_quest", _ref: ref });
    if (error) return { ok: false as const, already: false, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, already: false, error: null };
  });
