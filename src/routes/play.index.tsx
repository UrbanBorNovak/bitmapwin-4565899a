import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlayNav } from "@/components/play/PlayNav";
import { PlayStatsPanel } from "@/components/play/PlayStatsPanel";
import { TerritoryPicker } from "@/components/play/TerritoryPicker";
import { WorldEventFeed } from "@/components/play/WorldEventFeed";
import { LivingCard } from "@/components/play/LivingCard";
import { syncWorld, usePlayProfile } from "@/lib/game/worldState";

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

const newCode = () => Math.floor(Math.random() * 36 ** 5).toString(36).toUpperCase().padStart(5, "0");

function PlayLobby() {
  const profile = usePlayProfile();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"create" | "join" | null>(null);
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [world, setWorld] = useState<"ok" | "unavailable" | null>(null);

  useEffect(() => {
    if (profile) void syncWorld().then(setWorld);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.owner]);

  const featured = profile ? profile.order.map((id) => profile.cards[id]!).filter(Boolean).slice(0, 5) : [];

  return (
    <main className="play-district mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <PlayNav />
      <header className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="label text-signal">A DISTRICT OF THE OASIS</p>
          <h1 className="display mt-2 text-4xl md:text-6xl">
            <span className="text-bitcoin">BITMAPWIN</span> // PLAY
          </h1>
          <p className="display mt-3 text-lg md:text-2xl">THE WORLD IS THE DECK.</p>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Every card is born from a BITMAP. It remembers the matches it fought and wakes up as its land changes. Play here, then walk back into the world.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 md:w-[26rem] md:grid-cols-1">
          <Link to="/play/match" className="btn-term min-h-12 justify-center text-base">▶ PLAY AI</Link>
          <button type="button" className="btn-term-ghost min-h-11" aria-expanded={panel === "create"} onClick={() => { setPanel("create"); setCreated(newCode()); }}>CREATE TABLE</button>
          <button type="button" className="btn-term-ghost min-h-11" aria-expanded={panel === "join"} onClick={() => setPanel("join")}>JOIN TABLE</button>
        </div>
      </header>

      {panel === "create" && created && (
        <section className="mt-5 border border-bitcoin bg-card p-4">
          <p className="label text-bitcoin">TABLE {created}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">A table fixes the rival deck and the draw order. Share the code — everyone who sits here faces the same land. Compare your results.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/play/match" search={{ table: created }} className="btn-term">SIT AT TABLE {created}</Link>
            <button type="button" className="btn-term-ghost" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/play/match?table=${created}`)}>COPY LINK</button>
          </div>
        </section>
      )}
      {panel === "join" && (
        <form
          className="mt-5 flex flex-wrap items-end gap-2 border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (/^[0-9A-Z]{3,8}$/.test(c)) navigate({ to: "/play/match", search: { table: c } });
          }}
        >
          <label className="grid gap-1">
            <span className="label">TABLE CODE</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} className="h-11 w-40 border border-border bg-background px-3 font-mono uppercase" placeholder="E.G. 7K2QX" />
          </label>
          <button type="submit" className="btn-term min-h-11" disabled={!/^[0-9a-zA-Z]{3,8}$/.test(code.trim())}>JOIN TABLE</button>
        </form>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="label">YOUR LIVING CARDS</h2>
            <Link to="/play/cards" className="label hover:text-bitcoin">ALL CARDS →</Link>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {profile ? featured.map((c) => (
              <Link key={c.id} to="/play/card/$id" params={{ id: String(c.bitmap) }}><LivingCard card={c} /></Link>
            )) : <p className="font-mono text-xs text-muted-foreground">&gt; SHUFFLING THE WORLD…</p>}
          </div>
          {world === "unavailable" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">BITMAP DATA UNAVAILABLE — cards will catch up with the world later.</p>}
          <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-4">
            {[
              ["/play/atlas", "CARD ATLAS", "Every place you can find"],
              ["/play/cards", "MY CARDS", "Your collection and its history"],
              ["/play/cards", "MY STATS", "Wins, streaks, strongest card"],
              ["/oasis", "THE OASIS", "Walk the land your cards come from"],
            ].map(([to, label, note]) => (
              <Link key={label} to={to as "/play/atlas"} className="bg-card p-3 hover:text-bitcoin">
                <span className="label">{label}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{note}</span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="grid content-start gap-3">
          {profile && <TerritoryPicker profile={profile} />}
          {profile && <PlayStatsPanel profile={profile} />}
          {profile && <WorldEventFeed events={profile.events} />}
        </aside>
      </div>
    </main>
  );
}
