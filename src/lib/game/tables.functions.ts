import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attack, endTurn, newPvpMatch, playCard, type MatchState, type SideId } from "./engine";

const CODE = z.string().regex(/^[0-9A-Z]{5}$/);
const HEIGHTS = z.array(z.number().int().min(0).max(10_000_000)).min(1).max(12);
const NAME = z.string().trim().min(1).max(40);
const TOKEN = z.string().regex(/^[0-9a-f]{48}$/);

async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function token() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function code() {
  const b = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (b % 36 ** 5).toString(36).toUpperCase().padStart(5, "0");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const createTableFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ heights: HEIGHTS, name: NAME }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const uid = await (await import("./league.server")).optionalUserId(db);
    const t = token();
    for (let i = 0; i < 5; i++) {
      const c = code();
      const { error } = await db.from("play_tables").insert({ code: c, host_name: data.name, host_heights: data.heights, host_token_hash: await sha(t), host_user_id: uid });
      if (!error) return { code: c, token: t, seat: "player" as SideId };
    }
    throw new Error("Could not open a table. Try again.");
  });

export const joinTableFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: CODE, heights: HEIGHTS, name: NAME }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("play_tables").select("status, host_heights").eq("code", data.code).maybeSingle();
    if (!row) return { error: "TABLE NOT FOUND" as const };
    if (row.status !== "waiting") return { error: "TABLE IS FULL" as const };
    const t = token();
    const uid = await (await import("./league.server")).optionalUserId(db);
    const seed = parseInt(data.code, 36) ^ Date.now();
    const state = newPvpMatch((row.host_heights as number[]).map(Number), data.heights, seed);
    const { data: upd } = await db
      .from("play_tables")
      .update({ status: "playing", guest_name: data.name, guest_token_hash: await sha(t), guest_user_id: uid, state: state as never, version: 1, updated_at: new Date().toISOString() })
      .eq("code", data.code)
      .eq("status", "waiting")
      .select("code");
    if (!upd?.length) return { error: "TABLE IS FULL" as const };
    return { code: data.code, token: t, seat: "ai" as SideId };
  });

const ACTION = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("play"), uid: z.string().max(80) }),
  z.object({ kind: z.literal("attack"), uid: z.string().max(80), target: z.string().max(80) }),
  z.object({ kind: z.literal("end") }),
  z.object({ kind: z.literal("resign") }),
]);

export const tableActionFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: CODE, token: TOKEN, action: ACTION }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("play_tables").select("status, state, version, host_token_hash, guest_token_hash").eq("code", data.code).maybeSingle();
    if (!row || !row.state) return { ok: false, error: "TABLE NOT READY" };
    const h = await sha(data.token);
    const seat: SideId | null = h === row.host_token_hash ? "player" : h === row.guest_token_hash ? "ai" : null;
    if (!seat) return { ok: false, error: "NOT YOUR SEAT" };
    let s = row.state as unknown as MatchState;
    if (s.winner) return { ok: false, error: "MATCH COMPLETE" };
    const a = data.action;
    if (a.kind === "resign") {
      s = structuredClone(s);
      s.sides[seat].hp = 0;
      s.winner = seat === "player" ? "ai" : "player";
    } else {
      if (s.active !== seat) return { ok: false, error: "NOT YOUR TURN" };
      const next = a.kind === "play" ? playCard(s, seat, a.uid) : a.kind === "attack" ? attack(s, seat, a.uid, a.target) : endTurn(s);
      if (next === s) return { ok: false, error: "MOVE NOT ALLOWED" };
      s = next;
    }
    const { data: upd } = await db
      .from("play_tables")
      .update({ state: s as never, version: row.version + 1, status: s.winner ? "done" : "playing", updated_at: new Date().toISOString() })
      .eq("code", data.code)
      .eq("version", row.version)
      .select("code");
    if (!upd?.length) return { ok: false, error: "TABLE MOVED — RETRY" };
    if (s.winner) {
      try { await (await import("./league.server")).settleTable(db, data.code); } catch (e) { console.error("settle", e); }
    }
    return { ok: true, error: null };
  });
