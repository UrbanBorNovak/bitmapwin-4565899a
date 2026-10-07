import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOSSES, STRIKE_COOLDOWN_MIN, bossBySlug, rollLoot, strikeBoss } from "@/lib/epic-bosses";

/** Send one of your Guardians to strike a boss. Kill → loot split by damage. */
export const strikeBossFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ height: z.number().int().min(0), boss: z.string().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const boss = bossBySlug(data.boss);
    if (!boss) return { ok: false as const, error: "UNKNOWN BOSS" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g } = await supabaseAdmin
      .from("bitmon_guardians")
      .select("block_height, summoned_by_user_id, stats")
      .eq("block_height", data.height)
      .maybeSingle();
    if (!g || g.summoned_by_user_id !== context.userId)
      return { ok: false as const, error: "ONLY THE ACCOUNT THAT SUMMONED THIS GUARDIAN CAN COMMAND IT" };

    const since = new Date(Date.now() - STRIKE_COOLDOWN_MIN * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("boss_strikes").select("created_at").eq("guardian_height", data.height).gt("created_at", since).limit(1);
    if (recent?.length) return { ok: false as const, error: `GUARDIAN IS RECOVERING — ${STRIKE_COOLDOWN_MIN} MIN BETWEEN STRIKES` };

    let { data: st } = await supabaseAdmin.from("epic_bosses").select("*").eq("slug", boss.slug).maybeSingle();
    if (!st) return { ok: false as const, error: "BOSS NOT FOUND" };
    if (st.respawn_at) {
      if (Date.parse(st.respawn_at) > Date.now())
        return { ok: false as const, error: `${boss.name.toUpperCase()} IS DEAD — RESPAWNS ${new Date(st.respawn_at).toUTCString()}` };
      const { data: fresh } = await supabaseAdmin.from("epic_bosses")
        .update({ hp: boss.maxHp, max_hp: boss.maxHp, respawn_at: null, spawned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("slug", boss.slug).select("*").single();
      st = fresh!;
    }

    const s = (g.stats ?? {}) as Record<string, unknown>;
    const stats = { hp: Number(s["hp"] ?? 100), bite: Number(s["bite"] ?? 10), armor: Number(s["armor"] ?? 10), speed: Number(s["speed"] ?? 20) };
    const r = strikeBoss(stats, boss, `${boss.slug}:${data.height}:${Date.now() / 60_000 | 0}`);
    const dmg = Math.min(r.damage, st.hp);
    const hp = st.hp - dmg;
    // Optimistic concurrency: only apply if HP unchanged since read.
    const { data: upd } = await supabaseAdmin.from("epic_bosses")
      .update({ hp, updated_at: new Date().toISOString() })
      .eq("slug", boss.slug).eq("hp", st.hp).is("respawn_at", null).select("slug");
    if (!upd?.length) return { ok: false as const, error: "THE BATTLE SHIFTED — STRIKE AGAIN" };
    await supabaseAdmin.from("boss_strikes").insert({
      boss_slug: boss.slug, guardian_height: data.height, user_id: context.userId, damage: dmg, spawn_at: st.spawned_at,
    });

    let loot: { guardian: number; item: string; rarity: string; bit: number }[] = [];
    if (hp <= 0) {
      await supabaseAdmin.from("epic_bosses").update({
        respawn_at: new Date(Date.now() + boss.respawnHours * 3600_000).toISOString(), kills: st.kills + 1,
      }).eq("slug", boss.slug);
      const { data: strikes } = await supabaseAdmin.from("boss_strikes")
        .select("guardian_height, damage").eq("boss_slug", boss.slug).eq("spawn_at", st.spawned_at);
      const by = new Map<number, number>();
      for (const x of strikes ?? []) by.set(Number(x.guardian_height), (by.get(Number(x.guardian_height)) ?? 0) + x.damage);
      const total = [...by.values()].reduce((a, b) => a + b, 0) || 1;
      const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      for (const [h, d] of by) {
        for (const drop of rollLoot(boss, d / total, h === top, `${boss.slug}:${st.spawned_at}:${h}`))
          loot.push({ guardian: h, ...drop });
      }
      await supabaseAdmin.from("guardian_loot").insert(loot.map((l) => ({
        guardian_height: l.guardian, boss_slug: boss.slug, item: l.item, rarity: l.rarity, bit: l.bit,
      })));
      for (const l of loot) if (l.bit > 0) await supabaseAdmin.rpc("land_raid_spoils", { _height: l.guardian, _bit: l.bit });
    }
    return { ok: true as const, damage: dmg, counter: r.counter, hits: r.hits, hp, killed: hp <= 0, loot };
  });

export const bossesStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: st }, { data: loot }] = await Promise.all([
    supabaseAdmin.from("epic_bosses").select("slug, hp, max_hp, respawn_at, kills"),
    supabaseAdmin.from("guardian_loot").select("id, guardian_height, boss_slug, item, rarity, bit, created_at")
      .neq("rarity", "common").order("created_at", { ascending: false }).limit(20),
  ]);
  const by = new Map((st ?? []).map((s) => [s.slug, s]));
  return {
    bosses: BOSSES.map((b) => {
      const s = by.get(b.slug);
      const dead = !!s?.respawn_at && Date.parse(s.respawn_at) > Date.now();
      return { slug: b.slug, hp: dead ? 0 : s?.respawn_at ? b.maxHp : (s?.hp ?? b.maxHp), respawnAt: dead ? s!.respawn_at : null, kills: s?.kills ?? 0 };
    }),
    loot: (loot ?? []).map((l) => ({ ...l, guardian_height: Number(l.guardian_height) })),
  };
});
