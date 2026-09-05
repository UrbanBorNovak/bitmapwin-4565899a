import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent world state for deployed extenders.
 *
 * A deployment keeps two records: one shared record every visitor sees (quest
 * progress, saved buildings and NPCs, counters) and one private record per
 * signed-in visitor. The sandbox only ever receives plain JSON, so nothing about
 * the page, the session or the chain can leak into extender code.
 *
 * Reads are public (anyone can walk into a place and see it as it was left).
 * Writes need a session, so a signed-out visitor plays a live-but-unsaved copy.
 */

export type ExtenderPersistedState = {
  shared: Record<string, unknown>;
  player: Record<string, unknown>;
};

export const EMPTY_STATE: ExtenderPersistedState = { shared: {}, player: {} };

/** Hard ceiling per record so one extender cannot bloat the table. */
export const MAX_STATE_BYTES = 24_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Shared + own private state for a batch of deployments, in one round trip. */
export async function loadExtenderStates(
  deploymentIds: string[],
): Promise<Map<string, ExtenderPersistedState>> {
  const out = new Map<string, ExtenderPersistedState>();
  if (deploymentIds.length === 0) return out;

  const { data, error } = await supabase
    .from("extender_state")
    .select("deployment_id, scope, data")
    .in("deployment_id", deploymentIds);
  if (error) throw error;

  for (const id of deploymentIds) out.set(id, { shared: {}, player: {} });
  for (const row of data ?? []) {
    const id = String((row as { deployment_id: string }).deployment_id);
    const entry = out.get(id);
    if (!entry) continue;
    const record = asRecord((row as { data: unknown }).data);
    if ((row as { scope: string }).scope === "shared") entry.shared = record;
    else entry.player = record;
  }
  return out;
}

function withinLimit(record: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const text = JSON.stringify(record);
    return text.length <= MAX_STATE_BYTES ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function upsertRecord(
  deploymentId: string,
  scope: "shared" | "player",
  actor: string | null,
  record: Record<string, unknown>,
): Promise<void> {
  const safe = withinLimit(record);
  if (!safe) return;

  let lookup = supabase
    .from("extender_state")
    .select("id")
    .eq("deployment_id", deploymentId)
    .eq("scope", scope)
    .limit(1);
  lookup = actor ? lookup.eq("actor", actor) : lookup.is("actor", null);

  const { data: existing } = await lookup.maybeSingle();
  if (existing?.id) {
    await supabase.from("extender_state").update({ data: safe as never }).eq("id", existing.id);
    return;
  }
  await supabase
    .from("extender_state")
    .insert({ deployment_id: deploymentId, scope, actor, data: safe as never });
}

/**
 * Persist a deployment's state. Silently does nothing without a session — the
 * world stays playable for signed-out visitors, it just is not saved.
 */
export async function saveExtenderState(
  deploymentId: string,
  state: ExtenderPersistedState,
): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  if (!userId) return false;

  await upsertRecord(deploymentId, "shared", null, state.shared);
  if (Object.keys(state.player).length > 0) {
    await upsertRecord(deploymentId, "player", userId, state.player);
  }
  return true;
}
