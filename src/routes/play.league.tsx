import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlayNav } from "@/components/play/PlayNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/play/league")({
  head: () => ({
    meta: [
      { title: "Season League — BITMAPWIN // PLAY" },
      { name: "description", content: "Monthly living-card season standings from server-checked head-to-head and tournament matches." },
      { property: "og:title", content: "Season league standings — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Win 3 points per match, 5 per tournament title. Who leads the season?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaguePage,
});

type Row = { display_name: string; wins: number; losses: number; titles: number; points: number };
const monthKey = (offset: number) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - offset); return d.toISOString().slice(0, 7); };
const label = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

function LeaguePage() {
  const [season, setSeason] = useState(() => monthKey(0));
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    void supabase.from("play_season_standings").select("display_name, wins, losses, titles, points").eq("season", season)
      .order("points", { ascending: false }).order("wins", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [season]);

  return (
    <main className="play-district mx-auto max-w-[1200px] space-y-5 overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <PlayNav />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-signal">SEASON LEAGUE</p>
          <h1 className="display mt-1 text-3xl md:text-4xl">{label(season)}</h1>
          <p className="mt-2 max-w-2xl font-mono text-xs text-muted-foreground">Only server-checked matches count: head-to-head tables and player tournaments played while signed in. WIN = 3 PTS · TOURNAMENT TITLE = +5 PTS. A new season opens every month.</p>
        </div>
        <div className="flex gap-px border border-border bg-border" role="group" aria-label="Season">
          {[0, 1, 2].map((o) => { const k = monthKey(o); return (
            <button key={k} type="button" aria-pressed={season === k} className={`label bg-card px-3 py-2 ${season === k ? "text-bitcoin" : ""}`} onClick={() => setSeason(k)}>{o === 0 ? "CURRENT" : k}</button>
          ); })}
        </div>
      </header>

      <section className="border border-border bg-card">
        <div className="label grid grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem_3rem_4rem] gap-2 border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span>#</span><span>PLAYER</span><span className="text-right">W</span><span className="text-right">L</span><span className="text-right">CUPS</span><span className="text-right">PTS</span>
        </div>
        {rows === null ? <p className="p-4 font-mono text-xs text-muted-foreground">&gt; READING STANDINGS…</p> : rows.length === 0 ? (
          <div className="p-5">
            <p className="font-mono text-xs text-muted-foreground">No results yet this season. Sign in, then win a head-to-head table or a player tournament to take the first place.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/play/tournaments" className="btn-term">OPEN TOURNAMENTS</Link>
              <Link to="/play" className="btn-term-ghost">OPEN A TABLE</Link>
            </div>
          </div>
        ) : (
          <ol>
            {rows.map((r, i) => (
              <li key={`${r.display_name}-${i}`} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem_3rem_4rem] items-center gap-2 border-b border-border/60 px-3 py-2 font-mono text-xs ${i < 3 ? "bg-surface" : ""}`}>
                <span className={i === 0 ? "text-bitcoin" : "text-muted-foreground"}>{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">{r.display_name}</span>
                <span className="text-right">{r.wins}</span>
                <span className="text-right text-muted-foreground">{r.losses}</span>
                <span className="text-right text-signal">{r.titles}</span>
                <span className="text-right text-bitcoin">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
