import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inscriptionSchema = z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}i[0-9]+$/);
const createSchema = z.object({
  name: z.string().trim().min(2).max(32),
  tag: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/),
  crestInscriptionId: inscriptionSchema,
});
const clanIdSchema = z.object({ clanId: z.string().uuid() });
const requestSchema = z.object({ requestId: z.string().uuid(), accept: z.boolean() });
const crestSchema = z.object({ clanId: z.string().uuid(), crestInscriptionId: inscriptionSchema });

async function assertImageInscription(inscriptionId: string) {
  const response = await fetch(`https://ordinals.com/content/${encodeURIComponent(inscriptionId)}`, {
    method: "HEAD",
    redirect: "follow",
  });
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error("CLAN CREST MUST BE AN IMAGE INSCRIPTION");
  }
}

export type ClanSummary = {
  id: string;
  name: string;
  tag: string;
  crestInscriptionId: string;
  leader: boolean;
};

export type ClanRequest = { id: string; userId: string; createdAt: string };
export type ClanState = {
  clans: ClanSummary[];
  membership: (ClanSummary & { status: "pending" | "accepted" | "rejected" }) | null;
  requests: ClanRequest[];
};

export const getClanStateFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClanState> => {
    const { data: clanRows, error: clanError } = await context.supabase
      .from("clans")
      .select("id, name, tag, crest_inscription_id, leader_user_id")
      .order("name");
    if (clanError) throw clanError;

    const { data: memberships, error: membershipError } = await context.supabase
      .from("clan_members")
      .select("clan_id, status")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (membershipError) throw membershipError;

    const clans: ClanSummary[] = (clanRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      tag: row.tag,
      crestInscriptionId: row.crest_inscription_id,
      leader: row.leader_user_id === context.userId,
    }));
    const own = memberships?.[0];
    const ownClan = own ? clans.find((clan) => clan.id === own.clan_id) : null;
    const membership = ownClan && own
      ? { ...ownClan, status: own.status as "pending" | "accepted" | "rejected" }
      : null;

    const led = clans.find((clan) => clan.leader);
    let requests: ClanRequest[] = [];
    if (led) {
      const { data, error } = await context.supabase
        .from("clan_members")
        .select("id, user_id, created_at")
        .eq("clan_id", led.id)
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      requests = (data ?? []).map((row) => ({ id: row.id, userId: row.user_id, createdAt: row.created_at }));
    }
    return { clans, membership, requests };
  });

export const createClanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertImageInscription(data.crestInscriptionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clan, error } = await supabaseAdmin
      .from("clans")
      .insert({
        name: data.name,
        tag: data.tag,
        crest_inscription_id: data.crestInscriptionId,
        leader_user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: memberError } = await supabaseAdmin.from("clan_members").insert({
      clan_id: clan.id,
      user_id: context.userId,
      role: "leader",
      status: "accepted",
    });
    if (memberError) {
      await supabaseAdmin.from("clans").delete().eq("id", clan.id);
      throw memberError;
    }
    return { id: clan.id };
  });

export const requestClanJoinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => clanIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("clan_members")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.status === "accepted") throw new Error("LEAVE YOUR CURRENT CLAN FIRST");
    if (existing) {
      const { error } = await context.supabase.from("clan_members").delete().eq("id", existing.id);
      if (error) throw error;
    }
    const { error } = await context.supabase.from("clan_members").insert({
      clan_id: data.clanId,
      user_id: context.userId,
      role: "member",
      status: "pending",
    });
    if (error) throw error;
    return { ok: true };
  });

export const decideClanRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clan_members")
      .update({ status: data.accept ? "accepted" : "rejected" })
      .eq("id", data.requestId);
    if (error) throw error;
    return { ok: true };
  });

export const updateClanCrestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => crestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: clan, error: leaderError } = await context.supabase
      .from("clans")
      .select("leader_user_id")
      .eq("id", data.clanId)
      .single();
    if (leaderError) throw leaderError;
    if (clan.leader_user_id !== context.userId) throw new Error("ONLY THE CLAN LEADER CAN CHANGE THE CREST");
    await assertImageInscription(data.crestInscriptionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clans")
      .update({ crest_inscription_id: data.crestInscriptionId })
      .eq("id", data.clanId)
      .eq("leader_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
