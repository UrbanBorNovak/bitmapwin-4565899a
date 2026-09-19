/**
 * Writes the ranking side-effects of Oasis combat. Boards read publicly, but
 * only these authenticated server functions may change blood and karma.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { statusFor, titleForLevel } from "@/lib/ranks";

const nameSchema = z.string().trim().min(1).max(32);

const killSchema = z.object({
  killerName: nameSchema,
  victimName: nameSchema,
  district: z.string().trim().max(64).nullable(),
  bitmap: z.number().int().min(0).max(10_000_000).nullable(),
});

type PlayerRow = {
  id: string;
  name: string;
  karma: number;
  fame: number;
  level: number;
  status: string;
  pk_kills: number;
  pvp_kills: number;
  deaths: number;
  chaotic_count: number;
};

/** Records one Oasis kill: PK vs lawful, karma swing, death count. */
export const recordPvpKillFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => killSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.killerName.toLowerCase() === data.victimName.toLowerCase()) {
      throw new Error("YOU CANNOT SLAY YOURSELF");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    async function ensure(name: string, userId: string | null): Promise<PlayerRow> {
      const { data: found } = await supabaseAdmin
        .from("rank_players")
        .select("id, name, karma, fame, level, status, pk_kills, pvp_kills, deaths, chaotic_count")
        .ilike("name", name)
        .maybeSingle();
      if (found) return found as PlayerRow;
      const { data: created, error } = await supabaseAdmin
        .from("rank_players")
        .insert({ name, title: titleForLevel(1), ...(userId ? { user_id: userId } : {}) })
        .select("id, name, karma, fame, level, status, pk_kills, pvp_kills, deaths, chaotic_count")
        .single();
      if (error) throw new Error(error.message);
      return created as PlayerRow;
    }

    const killer = await ensure(data.killerName, context.userId);
    const victim = await ensure(data.victimName, null);
    const wasPk = victim.status !== "chaotic";

    const karma = wasPk ? killer.karma - 150 : killer.karma + 50;
    const nextKarma = Math.min(karma, 0);
    const nextFame = Number(killer.fame);
    const nextStatus = statusFor(nextKarma, nextFame);

    const { error: killerError } = await supabaseAdmin
      .from("rank_players")
      .update({
        karma: nextKarma,
        status: nextStatus,
        pk_kills: killer.pk_kills + (wasPk ? 1 : 0),
        pvp_kills: killer.pvp_kills + (wasPk ? 0 : 1),
        chaotic_count: killer.chaotic_count + (nextStatus === "chaotic" && killer.status !== "chaotic" ? 1 : 0),
        last_kill_at: new Date().toISOString(),
        ...(data.district ? { last_district: data.district } : {}),
      })
      .eq("id", killer.id);
    if (killerError) throw new Error(killerError.message);

    const { error: victimError } = await supabaseAdmin
      .from("rank_players")
      .update({ deaths: victim.deaths + 1, last_death_at: new Date().toISOString() })
      .eq("id", victim.id);
    if (victimError) throw new Error(victimError.message);

    const { error: eventError } = await supabaseAdmin.from("pvp_events").insert({
      killer_id: killer.id,
      victim_id: victim.id,
      district: data.district,
      bitmap: data.bitmap,
      karma_delta: nextKarma - killer.karma,
      was_pk: wasPk,
    });
    if (eventError) throw new Error(eventError.message);

    return {
      killer: killer.name,
      victim: victim.name,
      wasPk,
      karma: nextKarma,
      status: nextStatus,
    };
  });
