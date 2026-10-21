import type { SupabaseClient } from "@supabase/supabase-js";
import { VOID_QUEST_ID, VOID_STEPS } from "@/lib/void-progress";
import { HEIST_QUEST_ID, HEIST_STEPS } from "@/lib/void-heist";

/** Server rule for one Void step: key must match, Heist must be finished, the database enforces order. */
export async function recordVoidStep(db: SupabaseClient, userId: string, data: { index: number; key: string }) {
  if (VOID_STEPS[data.index] !== data.key) return { ok: false as const, status: "invalid" };
  const heist = await db.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", userId).eq("quest_id", HEIST_QUEST_ID);
  if (heist.error) return { ok: false as const, status: "error" };
  if ((heist.count ?? 0) < HEIST_STEPS.length) return { ok: false as const, status: "locked" };
  const { data: status, error } = await db.rpc("biternam_record_step", { _user: userId, _quest: VOID_QUEST_ID, _index: data.index, _key: data.key });
  if (error) return { ok: false as const, status: "error" };
  return { ok: status === "ok" || status === "already", status: String(status) };
}
