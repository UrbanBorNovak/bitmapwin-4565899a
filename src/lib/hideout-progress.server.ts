import type { SupabaseClient } from "@supabase/supabase-js";
import { HIDEOUT_STEPS, hideoutQuestId, type HideoutRoom } from "@/lib/hideout-progress";

/** Server rule for one hideout step: key must match the room's step; the database enforces order and pacing. */
export async function recordHideoutStep(db: SupabaseClient, userId: string, data: { room: HideoutRoom; index: number; key: string }) {
  const steps = HIDEOUT_STEPS[data.room];
  if (!steps || steps[data.index] !== data.key) return { ok: false as const, status: "invalid" };
  const { data: status, error } = await db.rpc("biternam_record_step", { _user: userId, _quest: hideoutQuestId(data.room), _index: data.index, _key: data.key });
  if (error) return { ok: false as const, status: "error" };
  return { ok: status === "ok" || status === "already", status: String(status) };
}

export async function hideoutStepCount(db: SupabaseClient, userId: string, room: HideoutRoom) {
  const { count, error } = await db.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", userId).eq("quest_id", hideoutQuestId(room));
  return error ? null : count ?? 0;
}
