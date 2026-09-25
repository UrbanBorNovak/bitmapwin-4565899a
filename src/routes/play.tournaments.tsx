import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PlayNav } from "@/components/play/PlayNav";
import { supabase } from "@/integrations/supabase/client";
import { CUP_ROUNDS, abandonCup, pairOf, readCup, readCupRecord, startCup, type CupRecord, type CupState } from "@/lib/game/cups";
import { createTournamentFn, joinTournamentFn } from "@/lib/game/tournaments.functions";
import { deckHeights, saveSeat, seatName } from "@/lib/game/tableSeat";
import { usePlayProfile } from "@/lib/game/worldState";

export const Route = createFileRoute("/play/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — BITMAPWIN // PLAY" },
      { name: "description", content: "Knockout cups against game-run BITMAP decks and live player tournaments with brackets you share by code." },
      { property: "og:title", content: "Living-card tournaments — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Enter a solo cup or open a 4 or 8 player bracket. Every result is remembered." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TournamentsPage,
});

type OpenTour = { code: string; name: string; size: number; status: string; players: string[] };

function TournamentsPage() {
  const profile = usePlayProfile();
  const navigate = useNavigate();
  const create = useServerFn(createTournamentFn);
  const join = useServerFn(joinTournamentFn);
  const [cup, setCup] = useState<CupState | null>(null);
  const [rec, setRec] = useState<CupRecord | null>(null);
  const [open, setOpen] = useState<OpenTour[] | null>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<4 | 8>(4);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => { setCup(readCup()); setRec(readCupRecord()); };
    sync();
    window.addEventListener("bitmapwin-cup", sync);
    return () => window.removeEventListener("bitmapwin-cup", sync);
  }, []);

  useEffect(() => {
    void supabase.from("play_tournaments").select("code, name, size, status, players").in("status", ["open", "running"]).order("created_at", { ascending: false }).limit(12)
      .then(({ data }) => setOpen((data ?? []) as unknown as OpenTour[]));
  }, []);

  async function host() {
    if (!profile || title.trim().length < 3) return setNote("NAME THE TOURNAMENT (3+ LETTERS)");
    setBusy(true); setNote(null);
    try {
      const r = await create({ data: { title, size, heights: deckHeights(profile), name: seatName(profile) } });
      saveSeat(`T:${r.code}`, { token: r.token, seat: "player", entrant: r.entrant });
      navigate({ to: "/play/tournament/$code", params: { code: r.code } });
    } catch { setNote("COULD NOT OPEN — TRY AGAIN"); setBusy(false); }
  }
  async function enter(c: string) {
    if (!profile) return;
    setBusy(true); setNote(null);
    try {
      const r = await join({ data: { code: c, heights: deckHeights(profile), name: seatName(profile) } });
      if ("error" in r) { setNote(r.error); setBusy(false); return; }
      saveSeat(`T:${r.code}`, { token: r.token, seat: "player", entrant: r.entrant });
      navigate({ to: "/play/tournament/$code", params: { code: r.code } });
    } catch { setNote("COULD NOT JOIN — TRY AGAIN"); setBusy(false); }
  }

  return (
    <main className="play-district mx-auto max-w-[1200px] space-y-5 overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <PlayNav />
      <header>
        <p className="label text-signal">COMPETE</p>
        <h1 className="display mt-1 text-3xl md:text-4xl">TOURNAMENTS</h1>
        <p className="mt-2 max-w-2xl font-mono text-xs text-muted-foreground">Knockout brackets for living cards. Solo cups run anytime against game-run BITMAP decks. Player tournaments are server-checked and count toward the <Link to="/play/league" className="text-bitcoin">season league</Link> when you are signed in.</p>
      </header>

      <section className="border border-border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label">SOLO CUP · 8 SEATS · 3 ROUNDS</h2>
          {rec && <span className="font-mono text-[10px] text-muted-foreground">CUPS {rec.cupsPlayed} · TITLES <span className="text-bitcoin">{rec.cupsWon}</span> · BEST {rec.best}</span>}
        </div>
        {cup ? <CupBracket cup={cup} /> : <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; Seven rival BITMAP decks are waiting. Win three matches in a row to take the cup.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {cup?.status === "running" ? (
            <>
              <Link to="/play/match" search={{ cup: 1 }} className="btn-term min-h-11">PLAY {CUP_ROUNDS[cup.round]} →</Link>
              <button type="button" className="btn-term-ghost min-h-11" onClick={() => abandonCup()}>FORFEIT CUP</button>
            </>
          ) : (
            <button type="button" className="btn-term min-h-11" disabled={!profile} onClick={() => setCup(startCup())}>{cup ? "ENTER A NEW CUP" : "ENTER SOLO CUP"}</button>
          )}
        </div>
      </section>

      <section className="grid gap-px border border-border bg-border md:grid-cols-2">
        <div className="bg-card p-4 md:p-5">
          <h2 className="label">HOST A PLAYER TOURNAMENT</h2>
          <input className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-sm" maxLength={40} placeholder="TOURNAMENT NAME" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tournament name" />
          <div className="mt-2 flex gap-px border border-border bg-border" role="group" aria-label="Seats">
            {([4, 8] as const).map((n) => (
              <button key={n} type="button" aria-pressed={size === n} className={`label flex-1 bg-card px-3 py-2 ${size === n ? "text-bitcoin" : ""}`} onClick={() => setSize(n)}>{n} PLAYERS</button>
            ))}
          </div>
          <button type="button" className="btn-term mt-3 min-h-11 w-full" disabled={!profile || busy} onClick={() => void host()}>OPEN BRACKET</button>
        </div>
        <div className="bg-card p-4 md:p-5">
          <h2 className="label">JOIN BY CODE</h2>
          <input className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-[0.3em]" maxLength={5} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))} aria-label="Tournament code" />
          <button type="button" className="btn-term mt-3 min-h-11 w-full" disabled={!profile || busy || code.length !== 5} onClick={() => void enter(code)}>TAKE A SEAT</button>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">The bracket starts the moment every seat is filled.</p>
        </div>
      </section>
      {note && <p className="font-mono text-[10px] text-bitcoin" role="status">{note}</p>}

      <section>
        <h2 className="label mb-2">LIVE BRACKETS</h2>
        {open === null ? <p className="font-mono text-xs text-muted-foreground">&gt; READING BRACKETS…</p> : open.length === 0 ? (
          <p className="border border-border bg-card p-4 font-mono text-xs text-muted-foreground">No player tournaments are running. Host the first one above.</p>
        ) : (
          <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {open.map((t) => (
              <li key={t.code} className="bg-card p-4">
                <p className="label text-signal">{t.status === "open" ? "SEATS OPEN" : "IN PLAY"} · {t.code}</p>
                <p className="display mt-1 text-lg">{t.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{t.players.length}/{t.size} PLAYERS</p>
                <Link to="/play/tournament/$code" params={{ code: t.code }} className="btn-term-ghost mt-3 inline-flex">{t.status === "open" ? "VIEW · JOIN" : "WATCH BRACKET"}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CupBracket({ cup }: { cup: CupState }) {
  return (
    <div className="mt-3">
      <p className={`label ${cup.status === "won" ? "text-bitcoin" : cup.status === "out" ? "text-muted-foreground" : "text-signal"}`}>
        {cup.status === "won" ? "CHAMPION — THE CUP IS YOURS" : cup.status === "out" ? "ELIMINATED — THE LAND REMEMBERS" : `NOW · ${CUP_ROUNDS[cup.round]}`}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 overflow-x-auto">
        {cup.rounds.map((round, r) => (
          <div key={r} className="flex min-w-[9rem] flex-col justify-around gap-2">
            <p className="label text-[10px] text-muted-foreground">{CUP_ROUNDS[r]}</p>
            {round.map((w, m) => {
              const [a, b] = pairOf(cup, r, m);
              return (
                <div key={m} className="border border-border bg-background">
                  {[a, b].map((e, i) => (
                    <p key={i} className={`truncate px-2 py-1 font-mono text-[10px] ${e === 0 ? "text-bitcoin" : ""} ${w !== null && w !== e ? "text-muted-foreground line-through" : ""}`}>
                      {e === null ? "—" : cup.entrants[e]!.name}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
