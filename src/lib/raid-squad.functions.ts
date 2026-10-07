import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOSS_TACTICS, GENERIC_TACTICS, RAID_WINDOW_MIN, SQUAD_MAX, bossBySlug, fmtCountdown, nextFightAt } from "@/lib/epic-bosses";

const role = z.enum(["tank", "striker", "support"]);

async function owns(height: number, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("bitmon_guardians").select("summoned_by_user_id").eq("block_height", height).maybeSingle();
  return data?.summoned_by_user_id === userId;
}

/** Join a boss squad with one of your Guardians (one squad per Guardian). */
export const joinSquadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ boss: z.string().max(40), height: z.number().int().min(0), role }).parse(d))
  .handler(async ({ data, context }) => {
    if (!bossBySlug(data.boss)) return { ok: false as const, error: "UNKNOWN BOSS" };
    if (!(await owns(data.height, context.userId))) return { ok: false as const, error: "ONLY THE SUMMONER CAN ENLIST THIS GUARDIAN" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("raid_squad_members").select("id", { count: "exact", head: true }).eq("boss_slug", data.boss);
    const { data: cur } = await supabaseAdmin.from("raid_squad_members").select("boss_slug").eq("guardian_height", data.height).maybeSingle();
    if (cur?.boss_slug !== data.boss && (count ?? 0) >= SQUAD_MAX) return { ok: false as const, error: `SQUAD FULL — ${SQUAD_MAX} GUARDIANS MAX` };
    const { error } = await supabaseAdmin.from("raid_squad_members").upsert(
      { boss_slug: data.boss, guardian_height: data.height, user_id: context.userId, role: data.role, joined_at: new Date().toISOString() },
      { onConflict: "guardian_height" },
    );
    return error ? { ok: false as const, error: "COULD NOT JOIN" } : { ok: true as const };
  });

export const leaveSquadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("raid_squad_members").delete().eq("guardian_height", data.height).eq("user_id", context.userId);
    return { ok: true as const };
  });

/** Public squad roster with damage this spawn. No account ids leave the server. */
export const squadStateFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ boss: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: st }] = await Promise.all([
      supabaseAdmin.from("raid_squad_members").select("guardian_height, role, joined_at, ready_at").eq("boss_slug", data.boss).order("joined_at"),
      supabaseAdmin.from("epic_bosses").select("spawned_at, respawn_at").eq("slug", data.boss).maybeSingle(),
    ]);
    const { data: strikes } = st
      ? await supabaseAdmin.from("boss_strikes").select("guardian_height, damage").eq("boss_slug", data.boss).eq("spawn_at", st.spawned_at)
      : { data: [] as { guardian_height: number; damage: number }[] };
    const dmg = new Map<number, { total: number; hits: number }>();
    for (const s of strikes ?? []) {
      const h = Number(s.guardian_height), cur = dmg.get(h) ?? { total: 0, hits: 0 };
      dmg.set(h, { total: cur.total + s.damage, hits: cur.hits + 1 });
    }
    const fightAt = nextFightAt(Date.now(), st?.respawn_at ?? null);
    const total = [...dmg.values()].reduce((a, b) => a + b.total, 0);
    return {
      total,
      fightAt,
      members: (members ?? []).map((m) => {
        const h = Number(m.guardian_height), d = dmg.get(h) ?? { total: 0, hits: 0 };
        return { height: h, role: m.role, ready: !!m.ready_at && Date.parse(m.ready_at) > fightAt - RAID_WINDOW_MIN * 60_000 - 60_000, damage: d.total, strikes: d.hits, share: total ? d.total / total : 0 };
      }).sort((a, b) => b.damage - a.damage),
    };
  });

/** Post a preset raid call into world chat. Squad members only. */
export const postTacticFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      boss: z.string().max(40),
      index: z.number().int().min(0).max(10).optional(),
      text: z.string().trim().min(2).max(140).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const boss = bossBySlug(data.boss);
    if (!boss) return { ok: false as const, error: "UNKNOWN BOSS" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("raid_squad_members").select("guardian_height, role")
      .eq("boss_slug", data.boss).eq("user_id", context.userId).limit(1).maybeSingle();
    if (!m) return { ok: false as const, error: "JOIN THE SQUAD TO CALL TACTICS" };
    const list = BOSS_TACTICS[boss.slug] ?? GENERIC_TACTICS;
    // Player-written calls: strip control characters and collapse whitespace.
    const custom = data.text?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const call = custom || (data.index != null ? list[data.index] : undefined);
    if (!call) return { ok: false as const, error: "WRITE A TACTIC FIRST" };
    const { error } = await supabaseAdmin.from("map_chat_messages").insert({
      user_id: context.userId,
      visitor_id: `raid-${m.guardian_height}`,
      handle: `RAID·${boss.name.toUpperCase()} #${m.guardian_height}`,
      sender_address: null,
      district_height: null,
      body: `⚔ [${String(m.role).toUpperCase()}] ${call}`,
    });
    return error ? { ok: false as const, error: "CALL NOT SENT" } : { ok: true as const };
  });

/** Ready up for the next fight and announce it in world chat. */
export const readyUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ boss: z.string().max(40), height: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const boss = bossBySlug(data.boss);
    if (!boss) return { ok: false as const, error: "UNKNOWN BOSS" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("raid_squad_members").select("role, ready_at")
      .eq("boss_slug", data.boss).eq("guardian_height", data.height).eq("user_id", context.userId).maybeSingle();
    if (!m) return { ok: false as const, error: "JOIN THE SQUAD FIRST" };
    if (m.ready_at && Date.now() - Date.parse(m.ready_at) < 60_000) return { ok: false as const, error: "ALREADY READY — WAIT A MINUTE TO CALL AGAIN" };
    const { data: st } = await supabaseAdmin.from("epic_bosses").select("respawn_at").eq("slug", data.boss).maybeSingle();
    const left = nextFightAt(Date.now(), st?.respawn_at ?? null) - Date.now();
    await supabaseAdmin.from("raid_squad_members").update({ ready_at: new Date().toISOString() }).eq("guardian_height", data.height);
    await supabaseAdmin.from("map_chat_messages").insert({
      user_id: context.userId, visitor_id: `raid-${data.height}`,
      handle: `RAID·${boss.name.toUpperCase()} #${data.height}`, sender_address: null, district_height: null,
      body: `✅ [${String(m.role).toUpperCase()}] READY — ${boss.name} fight starts in ${fmtCountdown(left)}`,
    });
    return { ok: true as const };
  });
