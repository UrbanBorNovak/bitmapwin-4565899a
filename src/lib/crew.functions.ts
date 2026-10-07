import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_IDS } from "@/lib/voxel-world";

/**
 * FRIENDS & BUILD CREWS — friend codes, friend requests, and per-BITMAP crews
 * that share one block stash. All tables are server-only; the live on-chain
 * holder is the only one who can invite friends into a BITMAP's crew.
 */

type Db = { from: (t: string) => any; rpc: (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}
const pair = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x });
const cleanHandle = (h: string) => h.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 24) || "PLAYER";

async function ensureCode(sb: Db, userId: string, handle?: string) {
  const { data } = await sb.from("player_friend_codes").select("code, handle").eq("user_id", userId).maybeSingle();
  if (data) {
    if (handle && cleanHandle(handle) !== data.handle) {
      await sb.from("player_friend_codes").update({ handle: cleanHandle(handle), updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    return data.code as string;
  }
  for (let i = 0; i < 5; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const { error } = await sb.from("player_friend_codes").insert({ user_id: userId, code, handle: cleanHandle(handle ?? "PLAYER") });
    if (!error) return code;
  }
  throw new Error("COULD NOT CREATE FRIEND CODE");
}
async function handles(sb: Db, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await sb.from("player_friend_codes").select("user_id, handle").in("user_id", ids);
  return new Map(((data ?? []) as { user_id: string; handle: string }[]).map((r) => [r.user_id, r.handle]));
}
async function isFriend(sb: Db, x: string, y: string) {
  const { data } = await sb.from("player_friends").select("status").match(pair(x, y)).maybeSingle();
  return data?.status === "accepted";
}
async function isLiveHolder(sb: Db, userId: string, height: number) {
  const { locateBitmap } = await import("@/lib/locate-bitmap.server");
  const { data: links } = await sb.from("wallet_links").select("address").eq("user_id", userId);
  for (const { address } of (links ?? []) as { address: string }[]) {
    if ((await locateBitmap({ height, address }).catch(() => null))?.heldByAddress) return true;
  }
  return false;
}

export type FriendRow = { id: string; handle: string; status: "accepted" | "incoming" | "outgoing" };

/** My friend code plus friends and pending requests. */
export const myFriendsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ handle: z.string().max(64).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = await db();
    const me = context.userId;
    const code = await ensureCode(sb, me, data.handle);
    const { data: rows } = await sb.from("player_friends").select("a, b, status, requested_by").or(`a.eq.${me},b.eq.${me}`).limit(200);
    const list = (rows ?? []) as { a: string; b: string; status: string; requested_by: string }[];
    const ids = list.map((r) => (r.a === me ? r.b : r.a));
    const names = await handles(sb, ids);
    const friends: FriendRow[] = list.map((r) => {
      const id = r.a === me ? r.b : r.a;
      const status = r.status === "accepted" ? "accepted" : r.requested_by === me ? "outgoing" : "incoming";
      return { id, handle: names.get(id) ?? "PLAYER", status };
    });
    return { code, friends };
  });

/** Send a friend request by code (accepts automatically if they already asked you). */
export const addFriendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().trim().min(4).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await db();
    const { data: row } = await sb.from("player_friend_codes").select("user_id, handle").eq("code", data.code.toUpperCase()).maybeSingle();
    if (!row) return { ok: false as const, error: "NO PLAYER WITH THAT CODE" };
    if (row.user_id === context.userId) return { ok: false as const, error: "THAT IS YOUR OWN CODE" };
    await ensureCode(sb, context.userId);
    const key = pair(context.userId, row.user_id);
    const { data: existing } = await sb.from("player_friends").select("status, requested_by").match(key).maybeSingle();
    if (existing?.status === "accepted") return { ok: false as const, error: "ALREADY FRIENDS" };
    if (existing && existing.requested_by !== context.userId) {
      await sb.from("player_friends").update({ status: "accepted" }).match(key);
      return { ok: true as const, message: `NOW FRIENDS WITH ${row.handle}` };
    }
    if (existing) return { ok: false as const, error: "REQUEST ALREADY SENT" };
    await sb.from("player_friends").insert({ ...key, requested_by: context.userId, status: "pending" });
    return { ok: true as const, message: `REQUEST SENT TO ${row.handle}` };
  });

/** Accept or decline an incoming request, or remove a friend. */
export const respondFriendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await db();
    const key = pair(context.userId, data.id);
    if (data.accept) {
      await sb.from("player_friends").update({ status: "accepted" }).match(key).neq("requested_by", context.userId);
    } else {
      await sb.from("player_friends").delete().match(key);
      // removing a friend also drops them from crews I share with them
      await sb.from("bitmap_crews").delete().eq("user_id", data.id).eq("added_by", context.userId);
    }
    return { ok: true as const };
  });

/** Crew of one BITMAP: members, shared stash, and whether I belong. */
export const crewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(2_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await db();
    const { data: rows } = await sb.from("bitmap_crews").select("user_id, added_by").eq("height", data.height).limit(50);
    const list = (rows ?? []) as { user_id: string; added_by: string }[];
    const names = await handles(sb, list.map((r) => r.user_id));
    const member = list.some((r) => r.user_id === context.userId);
    let stash: Record<string, number> = {};
    if (member) {
      const { data: s } = await sb.from("crew_stash").select("kind, count").eq("height", data.height);
      stash = Object.fromEntries(((s ?? []) as { kind: string; count: number }[]).map((r) => [r.kind, r.count]));
    }
    return {
      member,
      members: list.map((r) => ({ id: r.user_id, handle: names.get(r.user_id) ?? "PLAYER", owner: r.user_id === r.added_by })),
      stash,
    };
  });

/** Live holder only: invite an accepted friend into this BITMAP's crew. */
export const inviteCrewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(2_000_000), friend: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await db();
    if (!(await isFriend(sb, context.userId, data.friend))) return { ok: false as const, error: "ONLY FRIENDS CAN JOIN YOUR CREW" };
    if (!(await isLiveHolder(sb, context.userId, data.height))) return { ok: false as const, error: `ONLY THE OWNER OF ${data.height}.BITMAP CAN INVITE` };
    const { count } = await sb.from("bitmap_crews").select("user_id", { count: "exact", head: true }).eq("height", data.height);
    if ((count ?? 0) >= 12) return { ok: false as const, error: "CREW IS FULL (12)" };
    await sb.from("bitmap_crews").upsert([
      { height: data.height, user_id: context.userId, added_by: context.userId },
      { height: data.height, user_id: data.friend, added_by: context.userId },
    ], { onConflict: "height,user_id", ignoreDuplicates: true });
    return { ok: true as const };
  });

/** Leave a crew, or (live holder) remove someone from it. */
export const removeCrewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(2_000_000), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await db();
    if (data.id !== context.userId && !(await isLiveHolder(sb, context.userId, data.height))) {
      return { ok: false as const, error: "ONLY THE OWNER CAN REMOVE CREW" };
    }
    await sb.from("bitmap_crews").delete().eq("height", data.height).eq("user_id", data.id);
    return { ok: true as const };
  });

/** Crew member: deposit (n > 0) or withdraw (n < 0) blocks to/from the shared stash. */
export const crewMoveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    height: z.number().int().min(0).max(2_000_000), kind: z.string().max(16), n: z.number().int().min(-999).max(999),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!BLOCK_IDS.includes(data.kind)) return { ok: false as const, error: "UNKNOWN BLOCK" };
    const sb = await db();
    const { data: msg, error } = await sb.rpc("crew_move", { _user: context.userId, _height: data.height, _kind: data.kind, _n: data.n });
    if (error || msg !== "ok") return { ok: false as const, error: error ? "COULD NOT MOVE BLOCKS" : String(msg) };
    return { ok: true as const };
  });

/** Server helper used by block breaking: is this user in the crew of this BITMAP? */
export async function inCrew(userId: string, height: number) {
  const sb = await db();
  const { data } = await sb.from("bitmap_crews").select("user_id").eq("height", height).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
