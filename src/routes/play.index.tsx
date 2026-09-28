import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlayNav } from "@/components/play/PlayNav";
import { PlayStatsPanel } from "@/components/play/PlayStatsPanel";
import { TerritoryPicker } from "@/components/play/TerritoryPicker";
import { WorldEventFeed } from "@/components/play/WorldEventFeed";
import { MempoolSportsbook } from "@/components/play/MempoolSportsbook";

import { LivingCard } from "@/components/play/LivingCard";
import { syncWorld, usePlayProfile } from "@/lib/game/worldState";
import { useServerFn } from "@tanstack/react-start";
import { createTableFn, joinTableFn } from "@/lib/game/tables.functions";
import { deckHeights, saveSeat, seatName } from "@/lib/game/tableSeat";

export const Route = createFileRoute("/play/")({
  head: () => ({
    meta: [
      { title: "BITMAPWIN // PLAY — The Living Card Game" },
      { name: "description", content: "A card game inside the Oasis. Cards are born from BITMAPs, remember every match, and change as the world changes." },
      { property: "og:title", content: "BITMAPWIN // PLAY — The world is the deck" },
      { property: "og:description", content: "Play living cards born from Bitcoin blocks against a local rival, then return to the Oasis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayLobby,
});


function PlayLobby() {
  const profile = usePlayProfile();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"create" | "join" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const createTable = useServerFn(createTableFn);
  const joinTable = useServerFn(joinTableFn);

  async function openTable() {
    if (!profile) return;
    setBusy(true); setNote(null);
    try {
      const r = await createTable({ data: { heights: deckHeights(profile), name: seatName(profile) } });
      saveSeat(r.code, { token: r.token, seat: r.seat });
      navigate({ to: "/play/table/$code", params: { code: r.code } });
    } catch { setNote("COULD NOT OPEN A TABLE — TRY AGAIN"); setBusy(false); }
  }
  async function sit(c: string) {
    if (!profile) return;
    setBusy(true); setNote(null);
    try {
      const r = await joinTable({ data: { code: c, heights: deckHeights(profile), name: seatName(profile) } });
      if ("error" in r) { setNote(r.error); setBusy(false); return; }
      saveSeat(r.code, { token: r.token, seat: r.seat });
      navigate({ to: "/play/table/$code", params: { code: r.code } });
    } catch { setNote("COULD NOT JOIN — TRY AGAIN"); setBusy(false); }
  }
  const [world, setWorld] = useState<"ok" | "unavailable" | null>(null);

  useEffect(() => {
    if (profile) void syncWorld().then(setWorld);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.owner]);

  const featured = profile ? profile.order.map((id) => profile.cards[id]!).filter(Boolean).slice(0, 5) : [];

  return (
    <main className="play-district mx-auto min-w-0 overflow-x-hidden max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <PlayNav />
      <header className="mt-8">
        <p className="label text-signal">A DISTRICT OF THE OASIS</p>
        <h1 className="display mt-2 text-4xl md:text-5xl">
          <span className="text-bitcoin">BITMAPWIN</span> // PLAY
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Every card is born from a BITMAP and remembers the matches it fought. Pick how you want to play.
        </p>
      </header>

      {/* STEP 1 — choose how to play */}
      <section className="mt-8" aria-labelledby="mode-h">
        <h2 id="mode-h" className="label"><span className="text-bitcoin">1</span> · CHOOSE A MATCH</h2>
        <div className="mt-3 grid gap-px border border-border bg-border md:grid-cols-3">
          <Link to="/play/match" className="group grid content-between gap-4 bg-card p-5 hover:bg-secondary">
            <div>
              <span className="label text-bitcoin">SOLO</span>
              <p className="display mt-2 text-2xl">PLAY THE AI</p>
              <p className="mt-2 text-xs text-muted-foreground">Start instantly against a local rival. Best way to learn.</p>
            </div>
            <span className="btn-term min-h-11 justify-center">▶ START MATCH</span>
          </Link>
          <div className="grid content-between gap-4 bg-card p-5">
            <div>
              <span className="label text-signal">WITH A FRIEND</span>
              <p className="display mt-2 text-2xl">CREATE TABLE</p>
              <p className="mt-2 text-xs text-muted-foreground">Get a 5-letter code and a link to share. Your friend joins, you play.</p>
            </div>
            <button type="button" className="btn-term-ghost min-h-11" disabled={!profile || busy} onClick={() => { setPanel("create"); void openTable(); }}>
              {busy && panel === "create" ? "OPENING…" : "OPEN A TABLE"}
            </button>
          </div>
          <form
            className="grid content-between gap-4 bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (/^[0-9A-Z]{5}$/.test(c)) { setPanel("join"); void sit(c); }
            }}
          >
            <div>
              <span className="label text-signal">HAVE A CODE?</span>
              <p className="display mt-2 text-2xl">JOIN TABLE</p>
              <label className="mt-3 grid gap-1">
                <span className="sr-only">Table code</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={5} className="h-11 w-full border border-border bg-background px-3 font-mono uppercase" placeholder="E.G. 7K2QX" />
              </label>
            </div>
            <button type="submit" className="btn-term-ghost min-h-11" disabled={busy || !/^[0-9a-zA-Z]{5}$/.test(code.trim())}>
              {busy && panel === "join" ? "JOINING…" : "SIT DOWN"}
            </button>
          </form>
        </div>
        {note && <p className="mt-3 font-mono text-[10px] text-bitcoin" role="status">{note}</p>}
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
        <div className="grid content-start gap-6">
          {/* STEP 2 — your deck */}
          <section aria-labelledby="deck-h">
            <div className="flex items-center justify-between">
              <h2 id="deck-h" className="label"><span className="text-bitcoin">2</span> · YOUR DECK</h2>
              <Link to="/play/cards" className="label hover:text-bitcoin">ALL CARDS →</Link>
            </div>
            <div className="relative mt-3 flex gap-3 overflow-x-auto overflow-y-hidden px-1 pb-3 pt-2 [contain:paint]">
              {profile ? featured.map((c) => (
                <Link key={c.id} to="/play/card/$id" params={{ id: String(c.bitmap) }} className="shrink-0"><LivingCard card={c} /></Link>
              )) : <p className="font-mono text-xs text-muted-foreground">&gt; SHUFFLING THE WORLD…</p>}
            </div>
            {world === "unavailable" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">BITMAP DATA UNAVAILABLE — cards will catch up with the world later.</p>}
          </section>

          {/* STEP 3 — explore */}
          <section aria-labelledby="more-h">
            <h2 id="more-h" className="label"><span className="text-bitcoin">3</span> · EXPLORE</h2>
            <div className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-2 md:grid-cols-4">
              {[
                ["/play/atlas", "CARD ATLAS", "Every card you can find"],
                ["/play/extenders", "CARD ART", "Pick background pools"],
                ["/play/import", "IMPORT · OPTIONAL", "Use your own Ordinals as card art"],
                ["/oasis", "THE OASIS", "Walk the land your cards come from"],
              ].map(([to, label, sub]) => (
                <Link key={label} to={to as "/play/atlas"} className="bg-card p-3 hover:text-bitcoin">
                  <span className="label">{label}</span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{sub}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <aside className="relative z-10 grid content-start gap-3">
          <MempoolSportsbook />
          {profile && <TerritoryPicker profile={profile} />}

          {profile && <PlayStatsPanel profile={profile} />}
          {profile && <WorldEventFeed events={profile.events} />}
        </aside>
      </div>
    </main>
  );
}
