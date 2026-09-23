import { createFileRoute, Link } from "@tanstack/react-router";
import { LivingCard } from "@/components/play/LivingCard";
import { PlayNav } from "@/components/play/PlayNav";
import { ATLAS_POOL } from "@/lib/game/cardFactory";
import { usePlayProfile } from "@/lib/game/worldState";

export const Route = createFileRoute("/play/atlas")({
  head: () => ({
    meta: [
      { title: "Card Atlas — BITMAPWIN // PLAY" },
      { name: "description", content: "An encyclopedia of the Oasis: every living card, discovered or still hidden in the land." },
      { property: "og:title", content: "The Card Atlas — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Find the places the world has turned into cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CardAtlas,
});

function CardAtlas() {
  const profile = usePlayProfile();
  const extra = profile ? profile.order.map((id) => profile.cards[id]!).filter((c) => c && !ATLAS_POOL.includes(c.bitmap)).map((c) => c.bitmap) : [];
  const heights = [...ATLAS_POOL, ...extra];
  const known = heights.filter((h) => profile?.cards[`bitmap-${h}`]).length;
  return (
    <main className="play-district mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <PlayNav />
      <p className="label mt-6 text-signal">ENCYCLOPEDIA OF THE OASIS</p>
      <h1 className="display mt-2 text-3xl md:text-5xl">CARD ATLAS</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{known} / {heights.length} DISCOVERED · Win matches and walk the Oasis to find the rest.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {heights.map((h) => {
          const card = profile?.cards[`bitmap-${h}`];
          return card ? (
            <Link key={h} to="/play/card/$id" params={{ id: String(h) }} className="grid justify-items-center gap-1">
              <LivingCard card={card} size="sm" />
              <span className="font-mono text-[9px] text-muted-foreground">FOUND {new Date(card.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </Link>
          ) : (
            <div key={h} className="grid w-[7.5rem] justify-self-center place-items-center border border-dashed border-border bg-card aspect-[3/4]">
              <div className="text-center">
                <div className="display text-2xl text-muted-foreground/40">?</div>
                <div className="label text-[8px] text-muted-foreground">UNDISCOVERED</div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
