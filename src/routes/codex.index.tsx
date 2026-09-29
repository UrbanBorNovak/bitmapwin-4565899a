import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import atlasImage from "@/assets/oasis-atlas-storybook.jpg";
import { CREATURE_GROUPS, SPECIES } from "@/lib/bestiary";
import { ATLAS_POOL } from "@/lib/game/cardFactory";
import { worldStatsQuery, formatCount } from "@/lib/world-stats";

export const Route = createFileRoute("/codex/")({
  head: () => ({
    meta: [
      { title: "Oasis Codex — Creatures, Cards, Land & Builds" },
      { name: "description", content: "The field guide to the Oasis: every creature that roams it, every living card, the BITMAP land and what has been built on it." },
      { property: "og:title", content: "Oasis Codex — the field guide to Bitcoin-native worlds" },
      { property: "og:description", content: "Creatures, living cards, BITMAP land and builds — all traced to real data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CodexHub,
});

function CodexHub() {
  const stats = useQuery(worldStatsQuery());
  const builds = stats.data?.totals.builds;
  const creatures = SPECIES.length + CREATURE_GROUPS.length;

  const explore = [
    { to: "/codex/bestiary" as const, title: "BESTIARY", note: `${creatures} creatures · health, reward & temper` },
    { to: "/codex/morphs" as const, title: "MORPH LAB", note: "A new creature design grown from every BITMAP" },
    { to: "/play/atlas" as const, title: "LIVING CARDS", note: `${ATLAS_POOL.length} Atlas cards to discover` },
    { to: "/map" as const, title: "BITMAP LAND", note: "840,000 BITMAPs, one per block" },
    { to: "/builds" as const, title: "BUILDS", note: builds != null ? `${formatCount(builds)} builds raised` : "Everything raised on the land" },
  ];
  const tools = [
    { to: "/play/workshop" as const, title: "WORKSHOP", note: "Craft cards from your BITMAP, upgrade stats." },
    { to: "/world-stats" as const, title: "WORLD STATS", note: "BIT supply, prices and daily mining." },
    { to: "/valuation" as const, title: "VALUATION", note: "What a BITMAP is worth, from real sales." },
    { to: "/play/league" as const, title: "LEAGUE", note: "Season standings and cup titles." },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <header className="relative overflow-hidden rounded-md border border-border">
        <img src={atlasImage} alt="Painted map of the Oasis" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="relative px-6 pb-10 pt-28 md:px-10 md:pt-40">
          <p className="label text-signal">BITMAPWIN / OASIS CODEX</p>
          <h1 className="display mt-2 text-4xl md:text-6xl">THE OASIS. <span className="text-bitcoin">FIELD GUIDE.</span></h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Creatures, cards, land and builds of the Oasis. Plan your next walk, your next craft and your next match.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/codex/bestiary" className="btn-term">OPEN THE BESTIARY</Link>
            <Link to="/oasis" className="btn-term-ghost">ENTER THE OASIS</Link>
          </div>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="display text-2xl">EXPLORE THE OASIS</h2>
        <p className="label mt-1">THE WORLD, THE LAND, THE CARDS</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((e) => (
            <Link key={e.to} to={e.to} className="group rounded-md border border-border bg-card/60 p-5 backdrop-blur transition hover:border-bitcoin">
              <p className="display text-lg group-hover:text-bitcoin">{e.title}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">{e.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">PREPARE YOUR NEXT MOVE</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((t) => (
            <Link key={t.to} to={t.to} className="rounded-md border border-border p-4 transition hover:border-signal">
              <p className="font-mono text-xs text-signal">{t.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
