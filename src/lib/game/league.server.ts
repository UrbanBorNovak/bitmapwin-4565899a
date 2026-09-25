import { getRequestHeader } from "@tanstack/react-start/server";
import { newPvpMatch, type MatchState } from "./engine";

export async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
type Db = Awaited<ReturnType<typeof admin>>;

export async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function token() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function code() {
  const b = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (b % 36 ** 5).toString(36).toUpperCase().padStart(5, "0");
}

/** Signed-in caller if a valid session came with the request; guests return null. */
export async function optionalUserId(db: Db): Promise<string | null> {
  const h = getRequestHeader("authorization") ?? "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t || t.split(".").length !== 3) return null;
  const { data } = await db.auth.getUser(t);
  return data.user?.id ?? null;
}

export const seasonOf = (d = new Date()) => d.toISOString().slice(0, 7);

export type BracketMatch = { a: number | null; b: number | null; table: string | null; winner: number | null };
export type Bracket = BracketMatch[][];

export function emptyBracket(size: number): Bracket {
  const rounds: Bracket = [];
  for (let n = size / 2; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, table: null, winner: null })));
  return rounds;
}

/** Open a server-validated table for a bracket match whose two entrants are known. */
export async function openBracketTable(db: Db, tcode: string, m: BracketMatch) {
  if (m.a === null || m.b === null || m.table) return;
  const { data: es } = await db.from("play_tournament_entrants").select("entrant, name, heights, token_hash, user_id").eq("tournament_code", tcode).in("entrant", [m.a, m.b]);
  const A = es?.find((e) => e.entrant === m.a), B = es?.find((e) => e.entrant === m.b);
  if (!A || !B) return;
  for (let i = 0; i < 5; i++) {
    const c = code();
    const state: MatchState = newPvpMatch(A.heights.map(Number), B.heights.map(Number), parseInt(c, 36) ^ Date.now());
    const { error } = await db.from("play_tables").insert({
      code: c, status: "playing", host_name: A.name, guest_name: B.name, host_token_hash: A.token_hash, guest_token_hash: B.token_hash,
      host_user_id: A.user_id, guest_user_id: B.user_id, tournament_code: tcode, host_entrant: m.a, guest_entrant: m.b,
      state: state as never, version: 1,
    });
    if (!error) { m.table = c; return; }
  }
}

/** Record a finished table once: season standings for signed-in players, then advance its bracket. */
export async function settleTable(db: Db, tableCode: string) {
  const { data: t } = await db.from("play_tables").update({ recorded: true }).eq("code", tableCode).eq("recorded", false).eq("status", "done")
    .select("state, host_name, guest_name, host_user_id, guest_user_id, tournament_code, host_entrant, guest_entrant").maybeSingle();
  if (!t) return;
  const s = t.state as unknown as MatchState;
  const hostWon = s.winner === "player";
  let champion: number | null = null;

  if (t.tournament_code && t.host_entrant !== null && t.guest_entrant !== null) {
    const { data: tour } = await db.from("play_tournaments").select("bracket, status").eq("code", t.tournament_code).maybeSingle();
    if (tour && tour.status === "running") {
      const br = tour.bracket as unknown as Bracket;
      const winner = hostWon ? t.host_entrant : t.guest_entrant;
      br.forEach((round, r) => round.forEach((m, i) => {
        if (m.table !== tableCode) return;
        m.winner = winner;
        const next = br[r + 1];
        if (!next) { champion = winner; return; }
        const nm = next[Math.floor(i / 2)]!;
        if (i % 2 === 0) nm.a = winner; else nm.b = winner;
      }));
      for (const round of br) for (const m of round) await openBracketTable(db, t.tournament_code, m);
      await db.from("play_tournaments").update({ bracket: br as never, status: champion !== null ? "done" : "running", champion, updated_at: new Date().toISOString() }).eq("code", t.tournament_code);
    }
  }

  const season = seasonOf();
  const title = champion !== null;
  if (t.host_user_id) await db.rpc("play_season_record", { _season: season, _user_id: t.host_user_id, _name: t.host_name, _win: hostWon, _title: title && hostWon });
  if (t.guest_user_id && t.guest_user_id !== t.host_user_id) await db.rpc("play_season_record", { _season: season, _user_id: t.guest_user_id, _name: t.guest_name ?? "RIVAL", _win: !hostWon, _title: title && !hostWon });
}
