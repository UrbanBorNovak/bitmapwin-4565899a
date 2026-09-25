import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HEIGHTS = z.array(z.number().int().min(0).max(10_000_000)).min(1).max(12);
const NAME = z.string().trim().min(1).max(40);
const CODE = z.string().regex(/^[0-9A-Z]{5}$/);

export const createTournamentFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ title: z.string().trim().min(3).max(40), size: z.union([z.literal(4), z.literal(8)]), heights: HEIGHTS, name: NAME }).parse(d))
  .handler(async ({ data }) => {
    const L = await import("./league.server");
    const db = await L.admin();
    const uid = await L.optionalUserId(db);
    const t = L.token();
    for (let i = 0; i < 5; i++) {
      const c = L.code();
      const { error } = await db.from("play_tournaments").insert({ code: c, name: data.title.toUpperCase(), size: data.size, players: [data.name] as never, bracket: L.emptyBracket(data.size) as never });
      if (error) continue;
      await db.from("play_tournament_entrants").insert({ tournament_code: c, entrant: 0, name: data.name, heights: data.heights, token_hash: await L.sha(t), user_id: uid });
      return { code: c, token: t, entrant: 0 };
    }
    throw new Error("Could not open a tournament.");
  });

export const joinTournamentFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: CODE, heights: HEIGHTS, name: NAME }).parse(d))
  .handler(async ({ data }) => {
    const L = await import("./league.server");
    const db = await L.admin();
    const { data: tour } = await db.from("play_tournaments").select("size, status, players, bracket").eq("code", data.code).maybeSingle();
    if (!tour) return { error: "TOURNAMENT NOT FOUND" as const };
    const players = tour.players as string[];
    if (tour.status !== "open" || players.length >= tour.size) return { error: "TOURNAMENT IS FULL" as const };
    const uid = await L.optionalUserId(db);
    const t = L.token();
    const entrant = players.length;
    const { error } = await db.from("play_tournament_entrants").insert({ tournament_code: data.code, entrant, name: data.name, heights: data.heights, token_hash: await L.sha(t), user_id: uid });
    if (error) return { error: "SEAT TAKEN — TRY AGAIN" as const };
    const nextPlayers = [...players, data.name];
    const full = nextPlayers.length === tour.size;
    const br = tour.bracket as unknown as import("./league.server").Bracket;
    if (full) {
      // Seed in join order: 0v1, 2v3, …
      br[0]!.forEach((m, i) => { m.a = i * 2; m.b = i * 2 + 1; });
      for (const m of br[0]!) await L.openBracketTable(db, data.code, m);
    }
    await db.from("play_tournaments").update({ players: nextPlayers as never, bracket: br as never, status: full ? "running" : "open", updated_at: new Date().toISOString() }).eq("code", data.code).eq("status", "open");
    return { code: data.code, token: t, entrant };
  });
