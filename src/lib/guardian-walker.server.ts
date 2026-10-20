import { driveNow } from "@/lib/guardian-brain";
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

/** Laps at most this far back are settled in one call. */
const MAX_LAPS = 48;

/**
 * Settle every march lap that reached a guarded BITMAP. Laps repeat by clock
 * (Walker loop), so this works from stored timestamps whenever anyone calls it,
 * even long after the owner closed their browser. One raid per dispatch lap.
 */
export async function settleRaids() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const since = new Date(now - 6 * 3600_000).toISOString();
  const { data: marches } = await supabaseAdmin
    .from("guardian_dispatches")
    .select("id, guardian_height, target_height, started_at, ends_at, recalled_at, repeat")
    .eq("directive", "march")
    .or(`ends_at.gt.${since},and(repeat.eq.true,recalled_at.is.null),recalled_at.gt.${since}`)
    .limit(200);
  const ms = marches ?? [];
  if (!ms.length) return { settled: 0 };
  const { data: done } = await supabaseAdmin.from("guardian_raids").select("dispatch_id, lap").in("dispatch_id", ms.map((m) => m.id));
  const doneSet = new Set((done ?? []).map((d) => `${d.dispatch_id}:${d.lap}`));
  type Due = { id: string; a: number; d: number; lap: number; at: number };
  const due: Due[] = [];
  for (const m of ms) {
    if (m.target_height == null) continue;
    const start = Date.parse(m.started_at), lapMs = Math.max(1, Date.parse(m.ends_at) - start);
    const stop = Math.min(now, m.recalled_at ? Date.parse(m.recalled_at) : Infinity);
    const laps = m.repeat ? Math.floor((stop - start) / lapMs) + 1 : 1;
    for (let lap = Math.max(0, laps - MAX_LAPS); lap < laps; lap++) {
      const arrive = arrivalMs(start + lap * lapMs, start + (lap + 1) * lapMs, HOLD_SECONDS);
      if (arrive > stop || doneSet.has(`${m.id}:${lap}`)) continue;
      due.push({ id: m.id, a: Number(m.guardian_height), d: Number(m.target_height), lap, at: arrive });
    }
  }
  if (!due.length) return { settled: 0 };
  const heights = [...new Set(due.flatMap((x) => [x.a, x.d]))];
  const { data: gs } = await supabaseAdmin.from("bitmon_guardians").select("block_height, stats").in("block_height", heights);
  const byH = new Map((gs ?? []).map((g) => [Number(g.block_height), fighter(g)]));
  let count = 0;
  for (const x of due) {
    const a = byH.get(x.a), d = byH.get(x.d);
    if (!a || !d) continue; // unguarded BITMAP: nobody to fight
    const r = resolveRaid(a, d, `${x.id}:${x.lap}`, { guarding: driveNow(d.height, x.at).drive === "guard" });
    const { error } = await supabaseAdmin.from("guardian_raids").insert({
      dispatch_id: x.id, lap: x.lap, attacker_height: a.height, defender_height: d.height,
      winner_height: r.winner, spoils: r.spoils, log: r.rounds,
    });
    if (error) continue; // settled by a parallel call
    await supabaseAdmin.rpc("land_raid_spoils", { _height: r.winner, _bit: r.spoils });
    count++;
  }
  return { settled: count };
}

export const walkerTick = settleRaids;
