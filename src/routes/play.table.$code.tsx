import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GameBoard, type RemoteAction } from "@/components/play/GameBoard";
import { supabase } from "@/integrations/supabase/client";
import { flipMatch, type MatchState } from "@/lib/game/engine";
import { joinTableFn, tableActionFn } from "@/lib/game/tables.functions";
import { deckHeights, readSeat, saveSeat, seatName, type Seat } from "@/lib/game/tableSeat";
import { usePlayProfile } from "@/lib/game/worldState";

export const Route = createFileRoute("/play/table/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Table ${params.code.toUpperCase()} — BITMAPWIN // PLAY` },
      { name: "description", content: "A head-to-head living-card table. Share the code and play a friend inside the Oasis." },
      { property: "og:title", content: `Sit at table ${params.code.toUpperCase()} — BITMAPWIN // PLAY` },
      { property: "og:description", content: "Two travellers, two decks born from BITMAPs. Join the table and play." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TablePage,
});

type Row = { status: string; host_name: string; guest_name: string | null; state: MatchState | null; version: number };

function TablePage() {
  const code = Route.useParams().code.toUpperCase();
  const profile = usePlayProfile();
  const navigate = useNavigate();
  const join = useServerFn(joinTableFn);
  const send = useServerFn(tableActionFn);
  const [row, setRow] = useState<Row | null | "missing">(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setSeat(readSeat(code)), [code]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("play_tables").select("status, host_name, guest_name, state, version").eq("code", code).maybeSingle();
    setRow((prev) => {
      if (!data) return "missing";
      if (prev && prev !== "missing" && prev.version > data.version) return prev;
      return data as unknown as Row;
    });
  }, [code]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`play-table-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "play_tables", filter: `code=eq.${code}` }, () => void load())
      .subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 4000);
    return () => { void supabase.removeChannel(ch); window.clearInterval(poll); };
  }, [code, load]);

  const r = row && row !== "missing" ? row : null;
  const view = useMemo(() => (r?.state ? (seat?.seat === "ai" ? flipMatch(r.state) : r.state) : null), [r?.state, seat?.seat]);
  const rivalName = r ? (seat?.seat === "ai" ? r.host_name : r.guest_name ?? "RIVAL") : "RIVAL";

  async function sit() {
    if (!profile) return;
    setBusy(true); setNote(null);
    try {
      const res = await join({ data: { code, heights: deckHeights(profile), name: seatName(profile) } });
      if ("error" in res) setNote(res.error);
      else { const s = { token: res.token, seat: res.seat }; saveSeat(code, s); setSeat(s); await load(); }
    } catch { setNote("COULD NOT JOIN — TRY AGAIN"); }
    setBusy(false);
  }

  async function act(a: RemoteAction | { kind: "resign" }) {
    if (!seat) return;
    setBusy(true);
    try {
      const res = await send({ data: { code, token: seat.token, action: a } });
      setNote(res.ok ? null : res.error);
      await load();
    } catch { setNote("MOVE LOST — CHECK YOUR CONNECTION"); }
    setBusy(false);
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/play/table/${code}` : "";

  return (
    <main className="play-district mx-auto max-w-[1200px] overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/play" className="label hover:text-bitcoin">← LOBBY</Link>
        <p className="label"><span className="text-bitcoin">BITMAPWIN</span> // PLAY · TABLE {code}</p>
        {seat && r?.state && !r.state.winner ? (
          <button type="button" className="label hover:text-bitcoin" onClick={() => void act({ kind: "resign" })}>RESIGN</button>
        ) : <Link to="/oasis" className="label hover:text-bitcoin">OASIS ↗</Link>}
      </div>

      {row === null && <p className="border border-border p-6 font-mono text-xs text-muted-foreground">&gt; FINDING TABLE {code}…</p>}
      {row === "missing" && (
        <section className="border border-border bg-card p-6">
          <p className="label">TABLE {code} DOES NOT EXIST</p>
          <Link to="/play" className="btn-term mt-4 inline-flex">BACK TO THE LOBBY</Link>
        </section>
      )}

      {r && r.status === "waiting" && (
        <section className="border border-bitcoin bg-card p-5">
          <p className="label text-signal">HEAD-TO-HEAD</p>
          <p className="display mt-1 text-3xl text-bitcoin">TABLE {code}</p>
          {seat ? (
            <>
              <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; WAITING FOR A FRIEND TO SIT DOWN… Share the code or the link.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-term" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? "LINK COPIED" : "COPY LINK"}</button>
                <span className="self-center break-all font-mono text-[10px] text-muted-foreground">{link}</span>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{r.host_name} is waiting. Your living cards come with you.</p>
              <button type="button" className="btn-term mt-4 min-h-11" disabled={!profile || busy} onClick={() => void sit()}>{busy ? "SITTING DOWN…" : `SIT AT TABLE ${code}`}</button>
            </>
          )}
        </section>
      )}

      {r && view && profile && (
        <>
          {!seat && <p className="mb-2 font-mono text-[10px] text-signal">WATCHING — {r.host_name} VS {r.guest_name}</p>}
          <GameBoard
            key={code}
            profile={profile}
            deck={[]}
            seed={0}
            leaderId={null}
            tableCode={code}
            onRestart={() => navigate({ to: "/play" })}
            remote={{ state: view, rivalName: seat ? rivalName : r.guest_name ?? "RIVAL", busy: busy || !seat, send: (a) => void act(a) }}
          />
        </>
      )}
      {note && <p className="mt-3 font-mono text-[10px] text-bitcoin" role="status">{note}</p>}
    </main>
  );
}
