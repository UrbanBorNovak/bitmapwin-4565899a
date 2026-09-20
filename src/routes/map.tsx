import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Blocks, Compass, Hammer, KeyRound, Map as MapIcon, MapPin, Radio, Store, Globe2 } from "lucide-react";
import atlas from "@/assets/oasis-atlas.jpg.asset.json";
import { getChainBlocks } from "@/lib/chain.functions";
import { worldStatsQuery, formatCount } from "@/lib/world-stats";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
import { timeAgo } from "@/lib/bitmap";
import type { ProvenanceEvent } from "@/lib/passport";

export const Route = createFileRoute("/map")({
  head: () => {
    const title = "Atlas of the Oasis — Where Bitcoin Land Lives";
    const description =
      "An illustrated atlas of the Oasis. Every pin is a real BITMAP where builders, deployments and duels left verified history on Bitcoin land.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AtlasPage,
});

const RAIL = [
  { to: "/oasis", label: "THE OASIS", icon: Globe2 },
  { to: "/map", label: "MAP", icon: MapIcon },
  { to: "/marketplace", label: "MARKETPLACE", icon: Store },
  { to: "/builds", label: "BUILDS", icon: Hammer },
  { to: "/leases", label: "LEASE", icon: KeyRound },
  { to: "/extend", label: "EXTENDER", icon: Blocks },
  { to: "/stream", label: "STREAM", icon: Radio },
] as const;

/** Stable pin position for a block height, kept clear of the frame edges. */
function pinSpot(height: number): { x: number; y: number } {
  let h = 2166136261;
  const key = String(height);
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 8) & 0xffff) / 0xffff;
  const b = ((h >>> 20) & 0xfff) / 0xfff;
  return { x: 8 + a * 76, y: 14 + b * 68 };
}

type Place = { height: number; title: string; count: number; x: number; y: number };

function placesFrom(events: ProvenanceEvent[]): Place[] {
  const byHeight = new Map<number, Place>();
  for (const event of events) {
    if (event.bitmapHeight === null) continue;
    const found = byHeight.get(event.bitmapHeight);
    if (found) {
      found.count += 1;
      continue;
    }
    const spot = pinSpot(event.bitmapHeight);
    byHeight.set(event.bitmapHeight, { height: event.bitmapHeight, title: event.title, count: 1, ...spot });
  }
  return [...byHeight.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

function AtlasPage() {
  const fetchBlocks = useServerFn(getChainBlocks);
  const tip = useQuery({
    queryKey: ["chain", "tip", "atlas"],
    queryFn: async () => {
      const blocks = await fetchBlocks({ data: { pages: 1, scan: false } });
      return Math.max(...blocks.map((b) => b.height));
    },
    staleTime: 60_000,
  });
  const stats = useQuery(worldStatsQuery());
  const stream = useQuery(provenanceStreamQuery("all", 30));
  const [hover, setHover] = useState<Place | null>(null);

  const places = useMemo(() => placesFrom(stream.data ?? []), [stream.data]);
  const totals = stats.data?.totals;
  const events = stream.data ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-5 md:py-6">
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
        {/* LEFT RAIL */}
        <nav aria-label="World sections" className="flex gap-2 overflow-x-auto border border-border bg-surface/60 p-2 lg:w-[188px] lg:flex-col lg:overflow-visible">
          {RAIL.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="label flex shrink-0 items-center gap-2 px-3 py-3 text-muted-foreground transition-colors hover:bg-bitcoin/10 hover:text-bitcoin aria-[current=page]:bg-bitcoin/10 aria-[current=page]:text-bitcoin"
              activeProps={{ "aria-current": "page" }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>

        {/* ATLAS SURFACE */}
        <section className="relative min-w-0 overflow-hidden border border-border bg-background">
          <img
            src={atlas.url}
            alt="Illustrated atlas of the Oasis: an inland sea between green islands, a central castle city, floating sky islands, volcano, desert mesas and a snowbound range"
            width={1920}
            height={1200}
            className="block h-[52vh] w-full object-cover sm:h-[62vh] lg:h-[74vh]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/70" />

          {places.map((place) => (
            <Link
              key={place.height}
              to="/bitmap/$block"
              params={{ block: String(place.height) }}
              onMouseEnter={() => setHover(place)}
              onMouseLeave={() => setHover((current) => (current?.height === place.height ? null : current))}
              onFocus={() => setHover(place)}
              onBlur={() => setHover((current) => (current?.height === place.height ? null : current))}
              style={{ left: `${place.x}%`, top: `${place.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              title={`${place.height}.BITMAP — ${place.title}`}
            >
              <span className="flex max-w-[220px] items-center gap-2 border border-bitcoin/70 bg-background/85 px-2 py-1.5 backdrop-blur-sm transition-colors hover:border-bitcoin hover:bg-background">
                <MapPin className="size-3.5 shrink-0 text-bitcoin" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[9px] uppercase text-foreground" data-no-translate>
                    {place.title}
                  </span>
                  <span className="block font-mono text-[9px] tabular-nums text-bitcoin" data-no-translate>
                    {place.height.toLocaleString("en-US")}
                  </span>
                </span>
              </span>
            </Link>
          ))}

          {places.length === 0 && (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-border bg-background/85 px-4 py-3 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
              &gt; NO VERIFIED HISTORY ON THE MAP YET<span className="blink">_</span>
            </p>
          )}

          <div className="absolute bottom-3 left-3 border border-border bg-background/85 px-3 py-2 font-mono text-[9px] text-muted-foreground backdrop-blur-sm">
            <p data-no-translate>
              PIN: {hover ? `${hover.height.toLocaleString("en-US")}.BITMAP` : "—"}
            </p>
            <p data-no-translate>TIP BLOCK: {tip.data ? tip.data.toLocaleString("en-US") : "…"}</p>
          </div>

          <div className="absolute bottom-3 right-3 grid size-14 place-items-center rounded-full border border-border bg-background/85 font-mono text-[8px] text-muted-foreground backdrop-blur-sm">
            <Compass className="size-5 text-bitcoin" aria-hidden />
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="grid min-w-0 auto-rows-min content-start gap-3">
          <div className="border border-bitcoin/60 bg-surface/60 p-4">
            <h1 className="display text-2xl">
              <span className="text-bitcoin">THE</span> OASIS
            </h1>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">The multiverse of Bitcoin land</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Every mined Bitcoin block is a place. Builders, traders and explorers leave verified history on it, and this
              atlas pins the land where that history is happening right now.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-px border border-border bg-border">
              <div className="bg-background p-3 text-center">
                <dd className="font-mono text-sm font-bold tabular-nums text-bitcoin">
                  {tip.data ? tip.data.toLocaleString("en-US") : "…"}
                </dd>
                <dt className="label mt-1">PLACES</dt>
              </div>
              <div className="bg-background p-3 text-center">
                <dd className="font-mono text-sm font-bold tabular-nums">{totals ? formatCount(totals.builds) : "…"}</dd>
                <dt className="label mt-1">BUILDS</dt>
              </div>
              <div className="bg-background p-3 text-center">
                <dd className="font-mono text-sm font-bold tabular-nums">{totals ? formatCount(totals.holders) : "…"}</dd>
                <dt className="label mt-1">HOLDERS</dt>
              </div>
            </dl>
            <Link to="/oasis" className="btn-term mt-4 flex items-center justify-center gap-2">
              EXPLORE THE OASIS <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="border border-border bg-surface/60">
            <p className="label flex items-center gap-2 border-b border-border px-4 py-3 text-bitcoin">
              <span className="size-2 rounded-full bg-bitcoin" aria-hidden /> LIVE NOW
            </p>
            <ul className="divide-y divide-border">
              {[
                { label: "New builds today", value: totals?.builds24h },
                { label: "Miners active today", value: totals?.miners24h },
                { label: "Open listings", value: totals?.openListings },
                { label: "Blocks mined in world", value: totals?.minedTotal },
                { label: "Verified records shown", value: events.length },
              ].map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="font-mono text-sm font-bold tabular-nums text-bitcoin">
                    {row.value === undefined ? "…" : formatCount(row.value)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{row.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-border bg-surface/60">
            <p className="label border-b border-border px-4 py-3 text-bitcoin">FEATURED LOCATIONS</p>
            {places.length === 0 ? (
              <p className="px-4 py-4 font-mono text-[10px] text-muted-foreground">&gt; NOTHING PINNED YET_</p>
            ) : (
              <ul className="divide-y divide-border">
                {places.slice(0, 4).map((place) => (
                  <li key={place.height}>
                    <Link
                      to="/bitmap/$block"
                      params={{ block: String(place.height) }}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bitcoin/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[10px] uppercase" data-no-translate>
                          {place.title}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-bitcoin" data-no-translate>
                          {place.height.toLocaleString("en-US")}
                        </span>
                      </span>
                      <span className="label shrink-0">{place.count} REC</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* LIVE ACTIVITY TICKER */}
      <section className="mt-3 border border-border bg-surface/60" aria-label="Live activity">
        <div className="flex items-stretch gap-0 overflow-x-auto">
          <p className="label flex shrink-0 items-center gap-2 border-r border-border px-4 py-3 text-bitcoin">
            <span className="size-2 rounded-full bg-bitcoin" aria-hidden /> LIVE ACTIVITY
          </p>
          {events.length === 0 ? (
            <p className="px-4 py-3 font-mono text-[10px] text-muted-foreground">&gt; WAITING FOR VERIFIED HISTORY_</p>
          ) : (
            events.slice(0, 6).map((event) => (
              <Link
                key={event.id}
                {...(event.bitmapHeight === null
                  ? ({ to: "/stream" } as const)
                  : ({ to: "/bitmap/$block", params: { block: String(event.bitmapHeight) } } as const))}
                className="min-w-[210px] shrink-0 border-r border-border px-4 py-3 hover:bg-bitcoin/5"
              >
                <p className="truncate font-mono text-[10px] uppercase" data-no-translate>
                  {event.title}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">{timeAgo(event.occurredAt)}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
