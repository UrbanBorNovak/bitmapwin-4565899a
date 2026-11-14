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

const joinClanSchema = z.object({
  clanId: z.string().uuid(),
  wallet: z.string().trim().min(8).max(128),
});

type PlayerRow = {
  id: string;
  name: string;
  clan_id: string | null;
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
        .select("id, name, clan_id, karma, fame, level, status, pk_kills, pvp_kills, deaths, chaotic_count, user_id")
        .ilike("name", name)
        .maybeSingle();
      if (found) {
        // The killer must be the caller's own character; nobody can write
        // kills onto another account's (or an unclaimed) record.
        if (userId && found.user_id !== userId) throw new Error("THAT CHARACTER BELONGS TO ANOTHER PLAYER");
        if (!userId && found.user_id === context.userId) throw new Error("YOU CANNOT SLAY YOURSELF");
        return found as PlayerRow;
      }
      // A character born from a signed-in player carries their verified
      // wallet, so the public profile page can find their share book.
      let wallet: string | null = null;
      if (userId) {
        const { data: links } = await supabaseAdmin
          .from("wallet_links")
          .select("address")
          .eq("user_id", userId)
          .limit(1);
        wallet = links?.[0]?.address ?? null;
      }
      const { data: created, error } = await supabaseAdmin
        .from("rank_players")
        .insert({
          name,
          title: titleForLevel(1),
          ...(userId ? { user_id: userId } : {}),
          ...(wallet ? { wallet } : {}),
        })
        .select("id, name, clan_id, karma, fame, level, status, pk_kills, pvp_kills, deaths, chaotic_count")
        .single();
      if (error) throw new Error(error.message);
      return created as PlayerRow;
    }

    const killer = await ensure(data.killerName, context.userId);
    const victim = await ensure(data.victimName, null);
    // One recorded duel per killer/victim pair every 30 seconds, so a single
    // account cannot pile deaths onto another player's record.
    const { data: recent } = await supabaseAdmin
      .from("pvp_events")
      .select("id")
      .eq("killer_id", killer.id)
      .eq("victim_id", victim.id)
      .gte("created_at", new Date(Date.now() - 30_000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) throw new Error("THAT DUEL WAS ALREADY RECORDED");
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

    const { data: pvpEvent, error: eventError } = await supabaseAdmin.from("pvp_events").insert({
      killer_id: killer.id,
      victim_id: victim.id,
      district: data.district,
      bitmap: data.bitmap,
      karma_delta: nextKarma - killer.karma,
      was_pk: wasPk,
    }).select("id, created_at").single();
    if (eventError) throw new Error(eventError.message);
    const { appendProvenance, syncPassport } = await import("@/lib/passport.server");
    const walletLink = await supabaseAdmin.from("wallet_links").select("address").eq("user_id", context.userId).order("verified_at", { ascending: false }).limit(1).maybeSingle();
    await appendProvenance({ sourceKey: `combat:${pvpEvent.id}`, eventType: "combat", userId: context.userId, wallet: walletLink.data?.address ?? null, bitmapHeight: data.bitmap, sourceType: "pvp_event", sourceId: pvpEvent.id, proofLevel: "WORLD", title: "OASIS DUEL RECORDED", summary: `${killer.name} defeated ${victim.name}${data.district ? ` at ${data.district}` : ""}`, occurredAt: pvpEvent.created_at });
    await syncPassport(context.userId);

    // Clan tags so the world can announce the kill the old way:
    // "[TAG] Killer has slain [TAG] Victim at 65022.BITMAP".
    const clanIds = [killer.clan_id, victim.clan_id].filter((id): id is string => Boolean(id));
    const tags = new Map<string, string>();
    if (clanIds.length) {
      const { data: clans } = await supabaseAdmin
        .from("rank_clans")
        .select("id, tag")
        .in("id", clanIds);
      for (const clan of clans ?? []) tags.set(clan.id, clan.tag);
    }
    const badge = (row: PlayerRow) => {
      const tag = row.clan_id ? tags.get(row.clan_id) : null;
      return tag ? `[${tag}] ${row.name}` : row.name;
    };

    return {
      killer: killer.name,
      victim: victim.name,
      killerTag: killer.clan_id ? tags.get(killer.clan_id) ?? null : null,
      victimTag: victim.clan_id ? tags.get(victim.clan_id) ?? null : null,
      announce: `${badge(killer)} has slain ${badge(victim)}${data.district ? ` at ${data.district}` : ""}`,
      wasPk,
      karma: nextKarma,
      status: nextStatus,
    };
  });

/** Joins the signed-in player's verified wallet identity to one rank clan. */
export const joinRankClanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => joinClanSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: ownsWallet, error: walletError } = await context.supabase.rpc("owns_wallet", {
      _user_id: context.userId,
      _address: data.wallet,
    });
    if (walletError || !ownsWallet) {
      throw new Error("VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: joined, error } = await supabaseAdmin.rpc("join_rank_clan_admin", {
      _user_id: context.userId,
      _clan_id: data.clanId,
      _wallet: data.wallet,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(joined) ? joined[0] : null;
    return { ok: true, clanTag: result?.clan_tag ?? null };
  });
