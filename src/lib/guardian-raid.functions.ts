import { createServerFn } from "@tanstack/react-start";
import { arrivalMs, resolveRaid, type Fighter } from "@/lib/guardian-raid";

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

/**
 * Settle every march that has reached a guarded BITMAP. Idempotent (one raid
 * per dispatch), computed only from server data, so anyone may trigger it.
 */
export const settleRaidsFn = createServerFn({ method: "POST" }).handler(async () => {
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
});
