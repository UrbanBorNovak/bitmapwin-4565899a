import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LivingCard } from "@/components/play/LivingCard";
import { PlayNav } from "@/components/play/PlayNav";
import { PlayStatsPanel } from "@/components/play/PlayStatsPanel";
import { usePlayProfile } from "@/lib/game/worldState";
import type { CardState, CardType } from "@/lib/game/types";

export const Route = createFileRoute("/play/cards")({
  head: () => ({
    meta: [
      { title: "My Cards — BITMAPWIN // PLAY" },
      { name: "description", content: "Your discovered living cards, their states, traits and history." },
      { property: "og:title", content: "My Living Cards — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Cards born from BITMAPs that remember every match." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCards,
});

const FILTERS: ("ALL" | CardState | CardType)[] = ["ALL", "ACTIVE", "AWAKENED", "DEVELOPED", "LEGENDARY", "TERRITORY", "BUILDER", "MINER", "EXPLORER", "GUARDIAN", "EVENT"];

function MyCards() {
  const profile = usePlayProfile();
  const [f, setF] = useState<(typeof FILTERS)[number]>("ALL");
  const cards = profile ? profile.order.map((id) => profile.cards[id]!).filter(Boolean) : [];
  const shown = cards.filter((c) => f === "ALL" || c.state === f || c.type === f);
  return (
    <main className="play-district mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <PlayNav />
      <h1 className="display mt-6 text-3xl md:text-5xl">MY CARDS</h1>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="flex gap-1 overflow-x-auto pb-2" role="group" aria-label="Filter cards">
            {FILTERS.map((x) => (
              <button key={x} type="button" aria-pressed={f === x} onClick={() => setF(x)} className={f === x ? "btn-term shrink-0" : "btn-term-ghost shrink-0"}>{x}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((c) => (
              <Link key={c.id} to="/play/card/$id" params={{ id: String(c.bitmap) }} className="justify-self-center"><LivingCard card={c} /></Link>
            ))}
          </div>
          {profile && !shown.length && <p className="mt-4 font-mono text-xs text-muted-foreground">&gt; NO CARDS IN THIS STATE YET — PLAY TO WAKE THEM_</p>}
        </div>
        <aside>{profile && <PlayStatsPanel profile={profile} />}</aside>
      </div>
    </main>
  );
}
