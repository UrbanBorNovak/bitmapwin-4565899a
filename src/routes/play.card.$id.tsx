import { createFileRoute, Link } from "@tanstack/react-router";
import { CardDataLayers, CardHistory } from "@/components/play/CardHistory";
import { LivingCard } from "@/components/play/LivingCard";
import { PlayNav } from "@/components/play/PlayNav";
import { TRAIT_RULE, TYPE_RULE } from "@/lib/game/cardFactory";
import { usePlayProfile } from "@/lib/game/worldState";

export const Route = createFileRoute("/play/card/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Living Card ${params.id}.BITMAP — BITMAPWIN // PLAY` },
      { name: "description", content: `The living card born from block ${params.id}: its origin, traits, state and history.` },
      { property: "og:title", content: `${params.id}.BITMAP living card — BITMAPWIN // PLAY` },
      { property: "og:description", content: "A card that remembers the world it came from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CardProfile,
});

function CardProfile() {
  const { id } = Route.useParams();
  const profile = usePlayProfile();
  const height = Number(id);
  const card = profile?.cards[`bitmap-${id}`];
  return (
    <main className="play-district mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <PlayNav />
      {!profile ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">&gt; READING CARD…</p>
      ) : !card ? (
        <div className="mt-8 border border-dashed border-border p-6 text-center">
          <p className="label">UNDISCOVERED</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">This card has not been found yet. Win matches or open this BITMAP in the Oasis.</p>
          {Number.isInteger(height) && <Link to="/oasis" search={{ height }} className="btn-term mt-4 inline-flex">VIEW IN THE OASIS</Link>}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid justify-items-center gap-3">
            <LivingCard card={card} size="lg" />
            <div className="grid w-full gap-2">
              <Link to="/play/match" search={{ height: card.bitmap }} className="btn-term justify-center">PLAY WITH THIS CARD</Link>
              <Link to="/oasis" search={{ height: card.bitmap }} className="btn-term-ghost justify-center">VIEW IN THE OASIS</Link>
              <Link to="/bitmap/$block" params={{ block: String(card.bitmap) }} className="btn-term-ghost justify-center">OPEN BITMAP</Link>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div>
              <p className="label text-signal">{card.origin.label}</p>
              <h1 className="display mt-1 text-3xl md:text-4xl">{card.name}</h1>
              <p className="mt-2 font-mono text-xs"><span className="text-bitcoin">{card.type}</span> — {TYPE_RULE[card.type]}</p>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {card.traits.map((t) => (
                <li key={t} className="border border-border bg-card px-3 py-2 font-mono text-[10px]"><span className="text-bitcoin">{t}</span> · {TRAIT_RULE[t]}</li>
              ))}
            </ul>
            <CardDataLayers card={card} visuals={profile.visuals} />
            <CardHistory card={card} />
          </div>
        </div>
      )}
    </main>
  );
}
