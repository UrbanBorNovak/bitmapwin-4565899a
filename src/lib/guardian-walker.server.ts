import { arrivalMs, resolveRaid, type Fighter } from "@/lib/guardian-raid";
import { planRoute, routeSeconds, type Directive } from "@/lib/guardian-dispatch";

const HOLD_SECONDS = 30;
function fighter(row: { block_height: number; stats: unknown }): Fighter {
  const s = (row.stats ?? {}) as Record<string, unknown>;
  return {
    height: Number(row.block_height),
    hp: Math.max(1, Number(s["hp"] ?? 100)),
    bite: Number(s["bite"] ?? 10),
    armor: Number(s["armor"] ?? 10),
    speed: Number(s["speed"] ?? 20),
  };
}

/** Settle every march that has reached a guarded BITMAP. Idempotent. */
export async function settleRaids() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: marches } = await supabaseAdmin
    .from("guardian_dispatches")
    .select("id, guardian_height, target_height, started_at, ends_at, recalled_at")
    .eq("directive", "march")
    .gt("ends_at", since)
    .limit(200);
  const ids = (marches ?? []).map((m) => m.id);
  if (!ids.length) return { settled: 0 };
  const { data: done } = await supabaseAdmin.from("guardian_raids").select("dispatch_id").in("dispatch_id", ids);
  const settled = new Set((done ?? []).map((d) => d.dispatch_id));
  const now = Date.now();
  const due = (marches ?? []).filter((m) => {
    if (settled.has(m.id) || m.target_height == null) return false;
    const arrive = arrivalMs(Date.parse(m.started_at), Date.parse(m.ends_at), HOLD_SECONDS);
    // Recalled before arrival → never fought.
    if (m.recalled_at && Date.parse(m.recalled_at) < arrive) return false;
    return arrive <= now;
  });
  if (!due.length) return { settled: 0 };
  const heights = [...new Set(due.flatMap((m) => [m.guardian_height, m.target_height!]))];
  const { data: gs } = await supabaseAdmin.from("bitmon_guardians").select("block_height, stats").in("block_height", heights);
  const byH = new Map((gs ?? []).map((g) => [Number(g.block_height), fighter(g)]));
  let count = 0;
  for (const m of due) {
    const a = byH.get(Number(m.guardian_height));
    const d = byH.get(Number(m.target_height));
    if (!a || !d) continue; // unguarded BITMAP: nobody to fight
    const r = resolveRaid(a, d, m.id);
    const { error } = await supabaseAdmin.from("guardian_raids").insert({
      dispatch_id: m.id, attacker_height: a.height, defender_height: d.height,
      winner_height: r.winner, spoils: r.spoils, log: r.rounds,
    });
    if (error) continue; // already settled by a parallel call
    await supabaseAdmin.rpc("land_raid_spoils", { _height: r.winner, _bit: r.spoils });
    count++;
  }
  return { settled: count };
}

/**
 * Walker loop: every finished repeat order starts its next lap on the server,
 * so Guardians keep walking with no browser open. Idempotent via `chained`.
 */
export async function chainRepeats() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const { data: ended } = await supabaseAdmin
    .from("guardian_dispatches")
    .select("id, guardian_height, user_id, directive, target_height, ends_at")
    .eq("repeat", true).eq("chained", false).is("recalled_at", null)
    .lte("ends_at", new Date(now).toISOString())
    .limit(200);
  if (!ended?.length) return { chained: 0 };
  const heights = ended.map((d) => d.guardian_height);
  const { data: gs } = await supabaseAdmin.from("bitmon_guardians").select("block_height, stats, summoned_by_user_id").in("block_height", heights);
  const byH = new Map((gs ?? []).map((g) => [Number(g.block_height), g]));
  let n = 0;
  for (const d of ended) {
    // Claim this lap first so parallel ticks never double-chain.
    const { data: claimed } = await supabaseAdmin.from("guardian_dispatches").update({ chained: true }).eq("id", d.id).eq("chained", false).select("id");
    if (!claimed?.length) continue;
    const g = byH.get(Number(d.guardian_height));
    if (!g || g.summoned_by_user_id !== d.user_id) continue; // Guardian changed hands: stop the loop
    const speed = Number((g.stats as Record<string, unknown>)?.["speed"] ?? 30) || 30;
    const directive = d.directive as Directive;
    const endPrev = Date.parse(d.ends_at);
    // Continue seamlessly; if the tick ran late, start the new lap now.
    const start = now - endPrev < 120_000 ? endPrev : now;
    const target = d.target_height == null ? null : Number(d.target_height);
    const waypoints = planRoute(directive, Number(d.guardian_height), target, start / 1000);
    const secs = routeSeconds(waypoints, speed, directive);
    const { error } = await supabaseAdmin.from("guardian_dispatches").insert({
      guardian_height: d.guardian_height, user_id: d.user_id, directive, target_height: target, waypoints,
      started_at: new Date(start).toISOString(), ends_at: new Date(start + secs * 1000).toISOString(), repeat: true,
    });
    if (!error) n++;
  }
  return { chained: n };
}

export async function walkerTick() {
  const chained = await chainRepeats();
  const raids = await settleRaids();
  return { ...chained, ...raids };
}
