import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { joinTournamentFn } from "@/lib/game/tournaments.functions";
import { deckHeights, readSeat, saveSeat, seatName, type Seat } from "@/lib/game/tableSeat";
import { usePlayProfile } from "@/lib/game/worldState";

export const Route = createFileRoute("/play/tournament/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Tournament ${params.code.toUpperCase()} — BITMAPWIN // PLAY` },
      { name: "description", content: "A live living-card knockout bracket. Take a seat, play your table, advance." },
      { property: "og:title", content: `Join tournament ${params.code.toUpperCase()} — BITMAPWIN // PLAY` },
      { property: "og:description", content: "A knockout bracket for decks born from BITMAPs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TournamentPage,
});

type M = { a: number | null; b: number | null; table: string | null; winner: number | null };
type Tour = { code: string; name: string; size: number; status: string; players: string[]; bracket: M[][]; champion: number | null };
const roundName = (r: number, total: number) => (r === total - 1 ? "FINAL" : r === total - 2 ? "SEMI-FINAL" : "QUARTER-FINAL");

function TournamentPage() {
  const code = Route.useParams().code.toUpperCase();
  const profile = usePlayProfile();
  const join = useServerFn(joinTournamentFn);
  const [t, setT] = useState<Tour | null | "missing">(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setSeat(readSeat(`T:${code}`)), [code]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("play_tournaments").select("code, name, size, status, players, bracket, champion").eq("code", code).maybeSingle();
    setT(data ? (data as unknown as Tour) : "missing");
  }, [code]);
  useEffect(() => {
    void load();
    const ch = supabase.channel(`play-tour-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "play_tournaments", filter: `code=eq.${code}` }, () => void load()).subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 6000);
    return () => { void supabase.removeChannel(ch); window.clearInterval(poll); };
  }, [code, load]);

  async function sit() {
    if (!profile) return;
    setBusy(true); setNote(null);
    try {
      const r = await join({ data: { code, heights: deckHeights(profile), name: seatName(profile) } });
      if ("error" in r) setNote(r.error);
      else { const s = { token: r.token, seat: "player" as const, entrant: r.entrant }; saveSeat(`T:${code}`, s); setSeat(s); await load(); }
    } catch { setNote("COULD NOT JOIN — TRY AGAIN"); }
    setBusy(false);
  }

  const tour = t && t !== "missing" ? t : null;
  const me = seat?.entrant ?? null;
  const myMatch = tour && me !== null ? tour.bracket.flat().find((m) => m.table && m.winner === null && (m.a === me || m.b === me)) : undefined;
  const link = typeof window !== "undefined" ? `${window.location.origin}/play/tournament/${code}` : "";

  return (
    <main className="play-district mx-auto max-w-[1200px] space-y-4 overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/play/tournaments" className="label hover:text-bitcoin">← TOURNAMENTS</Link>
        <Link to="/play/league" className="label hover:text-bitcoin">SEASON LEAGUE ↗</Link>
      </div>
      {t === null && <p className="border border-border p-6 font-mono text-xs text-muted-foreground">&gt; READING BRACKET {code}…</p>}
      {t === "missing" && <p className="border border-border bg-card p-6 label">TOURNAMENT {code} DOES NOT EXIST</p>}
      {tour && (
        <>
          <header className="border border-border bg-card p-4 md:p-5">
            <p className="label text-signal">{tour.status === "open" ? `SEATS OPEN · ${tour.players.length}/${tour.size}` : tour.status === "done" ? "COMPLETE" : "IN PLAY"} · {code}</p>
            <h1 className="display mt-1 text-3xl text-bitcoin md:text-4xl">{tour.name}</h1>
            {tour.champion !== null && <p className="display mt-2 text-lg">CHAMPION · {tour.players[tour.champion]}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {tour.status === "open" && me === null && <button type="button" className="btn-term min-h-11" disabled={!profile || busy} onClick={() => void sit()}>{busy ? "TAKING SEAT…" : "TAKE A SEAT"}</button>}
              {tour.status === "open" && <button type="button" className="btn-term-ghost min-h-11" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? "LINK COPIED" : "COPY INVITE LINK"}</button>}
              {myMatch?.table && <Link to="/play/table/$code" params={{ code: myMatch.table }} className="btn-term min-h-11">PLAY YOUR MATCH →</Link>}
              {me !== null && <span className="font-mono text-[10px] text-muted-foreground">YOU ARE SEAT {me + 1} · {tour.players[me]}</span>}
            </div>
          </header>
          <section className="overflow-x-auto border border-border bg-card p-4">
            <div className="grid min-w-[36rem] gap-4" style={{ gridTemplateColumns: `repeat(${tour.bracket.length}, minmax(0, 1fr))` }}>
              {tour.bracket.map((round, r) => (
                <div key={r} className="flex flex-col justify-around gap-3">
                  <p className="label text-[10px] text-muted-foreground">{roundName(r, tour.bracket.length)}</p>
                  {round.map((m, i) => (
                    <div key={i} className={`border bg-background ${m.a === me || m.b === me ? "border-bitcoin" : "border-border"}`}>
                      {[m.a, m.b].map((e, k) => (
                        <p key={k} className={`truncate px-2 py-1.5 font-mono text-[11px] ${m.winner !== null && m.winner === e ? "text-bitcoin" : m.winner !== null ? "text-muted-foreground line-through" : ""}`}>
                          {e === null ? "—" : tour.players[e] ?? "—"}
                        </p>
                      ))}
                      {m.table && <Link to="/play/table/$code" params={{ code: m.table }} className="label block border-t border-border px-2 py-1 text-[10px] text-signal hover:text-bitcoin">{m.winner === null ? "LIVE · WATCH" : "REPLAY TABLE"} {m.table}</Link>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
          {tour.status === "open" && (
            <section className="border border-border bg-card p-4">
              <h2 className="label mb-2">SEATED</h2>
              <ol className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                {Array.from({ length: tour.size }, (_, i) => <li key={i} className={tour.players[i] ? "" : "text-muted-foreground"}>{i + 1}. {tour.players[i] ?? "OPEN SEAT"}</li>)}
              </ol>
            </section>
          )}
        </>
      )}
      {note && <p className="font-mono text-[10px] text-bitcoin" role="status">{note}</p>}
    </main>
  );
}
