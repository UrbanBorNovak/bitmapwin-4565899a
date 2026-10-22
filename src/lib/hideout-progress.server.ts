import type { SupabaseClient } from "@supabase/supabase-js";
import { HIDEOUT_REQUIRES, HIDEOUT_STEPS, hideoutQuestId, type HideoutRoom } from "@/lib/hideout-progress";
import { backroomFor } from "@/lib/biternam-backroom";

/**
 * Protected-action gate for backroom steps: a Vault/Lair step is only recorded
 * when the caller presents a pass fingerprint that is on that door's list.
 * Room visuals are public; this is what makes progress unforgeable.
 */
export async function backroomStepGate(room: HideoutRoom, commitment: string | undefined, verify: (slug: string, c: string) => Promise<boolean>) {
  const b = backroomFor(room);
  if (!b) return "open" as const;
  if (!commitment || !/^[0-9a-f]{64}$/.test(commitment)) return "sealed" as const;
  return (await verify(b.slug, commitment)) ? ("open" as const) : ("sealed" as const);
}

/** Server rule for one hideout step: key must match the room's step; backrooms need a valid pass; the database enforces order and pacing. */
export async function recordHideoutStep(db: SupabaseClient, userId: string, data: { room: HideoutRoom; index: number; key: string; pass?: string }) {
  const steps = HIDEOUT_STEPS[data.room];
  if (!steps || steps[data.index] !== data.key) return { ok: false as const, status: "invalid" };
  const gate = await backroomStepGate(data.room, data.pass, async (slug, c) => {
    const { data: ok, error } = await db.rpc("shadow_verify_pass", { _slug: slug, _commitment: c });
    return !error && ok === true;
  });
  if (gate === "sealed") return { ok: false as const, status: "sealed" };
  const need = HIDEOUT_REQUIRES[data.room];
  if (need) {
    const n = await hideoutStepCount(db, userId, need);
    if (n === null) return { ok: false as const, status: "error" };
    if (n < HIDEOUT_STEPS[need].length) return { ok: false as const, status: "locked" };
  }
  const { data: status, error } = await db.rpc("biternam_record_step", { _user: userId, _quest: hideoutQuestId(data.room), _index: data.index, _key: data.key });
  if (error) return { ok: false as const, status: "error" };
  return { ok: status === "ok" || status === "already", status: String(status) };
}

export async function hideoutStepCount(db: SupabaseClient, userId: string, room: HideoutRoom) {
  const { count, error } = await db.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", userId).eq("quest_id", hideoutQuestId(room));
  return error ? null : count ?? 0;
}
