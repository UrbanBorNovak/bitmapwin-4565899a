import { Link } from "@tanstack/react-router";
import { Hammer, Footprints, Landmark, MapPin, Boxes } from "lucide-react";
import type { PassportEstate, EstateTimelineEntry } from "@/lib/passport-estate.server";
import { atlasPlace } from "@/lib/atlas-places";

function when(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border border-border p-4">
      <span className="text-bitcoin">{icon}</span>
      <span>
        <span className="block font-mono text-2xl text-foreground">{value}</span>
        <span className="label text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function PlaceLine({ height }: { height: number }) {
  const place = atlasPlace(height);
  return (
    <span className="min-w-0">
      <Link to="/bitmap/$block" params={{ block: String(height) }} className="block font-mono text-xs text-bitcoin hover:underline" data-no-translate>
        {height}.BITMAP
      </Link>
      <span className="block truncate font-mono text-[10px] text-muted-foreground" data-no-translate>
        {place.localName} · {place.name}
      </span>
    </span>
  );
}

const TIMELINE_ICON: Record<EstateTimelineEntry["kind"], React.ReactNode> = {
  land: <Landmark className="size-3.5" />,
  build: <Hammer className="size-3.5" />,
  visit: <Footprints className="size-3.5" />,
  blueprint: <Boxes className="size-3.5" />,
  deployment: <MapPin className="size-3.5" />,
};

export function PassportEstatePanels({ estate }: { estate: PassportEstate }) {
  const groups = new Map<string, EstateTimelineEntry[]>();
  for (const entry of estate.timeline) {
    const day = when(entry.at);
    const list = groups.get(day) ?? [];
    list.push(entry);
    groups.set(day, list);
  }

  return (
    <>
      <section className="mt-10">
        <header className="border-b border-border pb-3">
          <p className="label text-bitcoin">WHAT YOU HOLD AND WHAT YOU MADE</p>
          <h2 className="display mt-2 text-2xl">YOUR ESTATE</h2>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="BITMAPS HELD" value={estate.land.length} icon={<Landmark className="size-5" />} />
          <Metric label="BUILDS RAISED" value={estate.builds.length} icon={<Hammer className="size-5" />} />
          <Metric label="PLACES VISITED" value={estate.visits.length} icon={<Footprints className="size-5" />} />
          <Metric label="BLUEPRINTS PUBLISHED" value={estate.blueprints.length} icon={<Boxes className="size-5" />} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="border border-border">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="display text-lg">BITMAPS HELD</h3>
            <span className="label">{estate.land.length}</span>
          </header>
          {estate.land.length ? (
            <ul className="max-h-[320px] divide-y divide-border overflow-y-auto">
              {estate.land.map((item) => (
                <li key={item.height} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <PlaceLine height={item.height} />
                  <Link to="/oasis" search={{ height: item.height }} className="btn-term-ghost shrink-0 text-[10px]">
                    [ ENTER ]
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NO INDEXED LAND ON THIS WALLET YET_</p>
          )}
        </section>

        <section className="border border-border">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="display text-lg">BUILDS RAISED</h3>
            <span className="label">{estate.builds.length}</span>
          </header>
          {estate.builds.length ? (
            <ul className="max-h-[320px] divide-y divide-border overflow-y-auto">
              {estate.builds.slice(0, 80).map((build) => (
                <li key={build.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <PlaceLine height={build.height} />
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[10px] text-signal" data-no-translate>{build.kind.replaceAll("-", " ").toUpperCase()}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{when(build.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NOTHING BUILT YET — THE LAND IS BARE_</p>
          )}
        </section>

        <section className="border border-border">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="display text-lg">PLACES VISITED</h3>
            <span className="label">{estate.visits.length}</span>
          </header>
          {estate.visits.length ? (
            <ul className="max-h-[320px] divide-y divide-border overflow-y-auto">
              {estate.visits.slice(0, 80).map((visit) => (
                <li key={visit.height} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <PlaceLine height={visit.height} />
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[10px] text-foreground">{visit.visits}×</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{when(visit.lastAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NO RECORDED ARRIVALS YET_</p>
          )}
        </section>

        <section className="border border-border">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="display text-lg">BLUEPRINTS PUBLISHED</h3>
            <span className="label">{estate.blueprints.length}</span>
          </header>
          {estate.blueprints.length ? (
            <ul className="max-h-[320px] divide-y divide-border overflow-y-auto">
              {estate.blueprints.map((blueprint) => (
                <li key={blueprint.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link to="/extenders/$slug" params={{ slug: blueprint.slug }} className="min-w-0 truncate font-mono text-xs text-bitcoin hover:underline">
                      {blueprint.name}
                    </Link>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground" data-no-translate>v{blueprint.semver}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground" data-no-translate>{blueprint.summary}</p>
                  <p className="mt-1 font-mono text-[10px] text-signal">{blueprint.deployments} DEPLOYED · {when(blueprint.publishedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 font-mono text-xs text-muted-foreground">
              &gt; NO BLUEPRINTS PUBLISHED YET_
              <Link to="/studio" className="btn-term-ghost mt-3 inline-flex">[ OPEN STUDIO ]</Link>
            </p>
          )}
        </section>
      </div>

      <section className="mt-10 border border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="label text-bitcoin">HISTORY IN ORDER</p>
            <h2 className="display mt-2 text-2xl">TIMELINE</h2>
          </div>
          <span className="label">{estate.timeline.length} ENTRIES</span>
        </header>
        {estate.timeline.length ? (
          <ol className="divide-y divide-border">
            {[...groups.entries()].map(([day, entries]) => (
              <li key={day} className="px-4 py-4">
                <p className="font-mono text-[10px] text-bitcoin" data-no-translate>{day}</p>
                <ul className="mt-2 space-y-2 border-l border-border pl-4">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-signal">{TIMELINE_ICON[entry.kind]}</span>
                      <span className="font-mono text-[11px] text-foreground">{entry.title}</span>
                      {entry.height !== null ? (
                        <Link to="/bitmap/$block" params={{ block: String(entry.height) }} className="font-mono text-[10px] text-bitcoin hover:underline" data-no-translate>
                          {entry.height}.BITMAP · {atlasPlace(entry.height).localName}
                        </Link>
                      ) : null}
                      <span className="font-mono text-[10px] text-muted-foreground" data-no-translate>{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-5 font-mono text-xs text-muted-foreground">&gt; YOUR TIMELINE BEGINS THE MOMENT YOU ENTER THE OASIS_</p>
        )}
      </section>
    </>
  );
}
