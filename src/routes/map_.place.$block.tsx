import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, Map, Mountain, Navigation } from "lucide-react";
import { AtlasPlaceIllustration } from "@/components/AtlasPlaceIllustration";
import { Button } from "@/components/ui/button";
import { ATLAS_CAPACITY, atlasEra } from "@/lib/atlas-geometry";
import { atlasDistrictNeighbors, atlasPlaceStory } from "@/lib/atlas-places";
import { landscapeFor } from "@/lib/land-biome";
import { PlaceChainLore } from "@/components/atlas/PlaceChainLore";

export const Route = createFileRoute("/map_/place/$block")({
  loader: ({ params }) => {
    const height = Number(params.block);
    if (!Number.isInteger(height) || height < 0 || height >= ATLAS_CAPACITY) throw notFound();
    const place = atlasPlaceStory(height);
    return { place, neighbors: atlasDistrictNeighbors(place) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Atlas place not found — BitmapWin" }, { name: "robots", content: "noindex" }] };
    const { place } = loaderData;
    const title = `${place.localName} — ${place.height.toLocaleString("en-US")}.BITMAP, ${place.name}`;
    const description = `${place.localName} at ${place.address} in ${place.name}: the story, illustration and atlas entry for BITMAP ${place.height.toLocaleString("en-US")} near ${place.landmark}.`;
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
  notFoundComponent: PlaceNotFound,
  component: PlaceStoryPage,
});

function PlaceNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="label text-bitcoin">ATLAS RECORD</p>
      <h1 className="display mt-3 text-4xl">PLACE NOT FOUND</h1>
      <Button asChild variant="terminal" className="mt-7"><Link to="/map"><Map />RETURN TO ATLAS</Link></Button>
    </main>
  );
}

function PlaceStoryPage() {
  const { place, neighbors } = Route.useLoaderData();
  const era = atlasEra(place.height, 1_048_575);
  const landscape = landscapeFor(place.height);

  return (
    <main className="storybook-page min-h-screen pb-16 md:pb-24">
      <div className="mx-auto max-w-[1600px] px-0 pt-3 sm:px-4 md:px-8 md:pt-7">
        <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-0">
          <Button asChild variant="ghost" size="sm"><Link to="/map/$block" params={{ block: String(place.height) }}><ArrowLeft />ATLAS</Link></Button>
          <p className="font-mono text-[9px] uppercase text-muted-foreground" data-no-translate>{place.height.toLocaleString("en-US")}.BITMAP · {place.name}</p>
        </div>
        <AtlasPlaceIllustration place={place} />
      </div>

      <div className="mx-auto grid max-w-[1380px] gap-10 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] lg:py-16">
        <article className="min-w-0">
          <p className="label text-bitcoin">PLACE STORY · IMAGINED LORE</p>
          <div className="mt-5 max-w-3xl space-y-5 text-lg leading-8 text-foreground/90 md:text-xl md:leading-9">
            <p>{place.story[0]}</p>
            <p>{place.story[1]}</p>
          </div>
          <PlaceChainLore height={place.height} />
          <div className="mt-9 border-l-2 border-signal bg-signal/5 p-5">
            <p className="label text-signal">THE LANDSCAPE</p>
            <h2 className="display mt-2 text-2xl md:text-3xl">{landscape.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{landscape.blurb}</p>
            <ul className="mt-4 grid gap-1">
              {landscape.perks.map((perk) => (
                <li key={perk.key} className="font-mono text-[10px]"><span className="text-signal">{perk.name}</span> <span className="text-muted-foreground">{perk.effect}</span></li>
              ))}
            </ul>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground">The name, address and story above are world lore derived from this block's fixed position. Ownership and recorded activity stay grounded in verifiable sources.</p>
        </article>

        <aside className="min-w-0 space-y-4">
          <section className="border border-border bg-surface/60 p-5">
            <div className="flex items-center gap-2"><Compass className="size-4 text-signal" /><h2 className="label text-signal">SPATIAL RECORD</h2></div>
            <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border font-mono text-[10px]">
              <div className="bg-background p-3"><dt className="text-muted-foreground">COORDINATES</dt><dd className="mt-1 text-signal" data-no-translate>{place.point.x.toString().padStart(4, "0")} : {place.point.y.toString().padStart(4, "0")}</dd></div>
              <div className="bg-background p-3"><dt className="text-muted-foreground">BITMAP</dt><dd className="mt-1 text-bitcoin" data-no-translate>{place.height.toLocaleString("en-US")}</dd></div>
              <div className="col-span-2 min-w-0 bg-background p-3"><dt className="text-muted-foreground">ADDRESS</dt><dd className="mt-1 break-words">{place.address}</dd></div>
              <div className="col-span-2 min-w-0 bg-background p-3"><dt className="text-muted-foreground">DISTRICT / LANDMARK</dt><dd className="mt-1 break-words">{place.name} · <span className="text-bitcoin">{place.landmark}</span></dd></div>
              <div className="col-span-2 bg-background p-3"><dt className="text-muted-foreground">ERA / BIOME</dt><dd className="mt-1">{era.label} · {era.biome}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button asChild variant="terminal"><Link to="/bitmap/$block" params={{ block: String(place.height) }}><Navigation />OPEN LAND</Link></Button>
              <Button asChild variant="terminalGhost"><Link to="/oasis" search={{ height: place.height }}><Mountain />DROP IN 3D</Link></Button>
            </div>
          </section>

          <section className="border border-border bg-surface/40 p-5">
            <h2 className="label text-bitcoin">DISTRICT STORY</h2>
            <Link to="/map/district/$slug" params={{ slug: place.slug }} className="mt-3 flex min-w-0 items-center justify-between gap-4 border-b border-border py-3 font-mono text-xs text-muted-foreground transition-colors hover:text-bitcoin">
              <span className="truncate">{place.name}</span><ArrowRight className="size-3.5 shrink-0" />
            </Link>
            <h2 className="label mt-5 text-bitcoin">NEIGHBORING DISTRICTS</h2>
            <div className="mt-3 grid gap-2">
              {neighbors.map((neighbor) => (
                <Link key={neighbor.slug} to="/map/district/$slug" params={{ slug: neighbor.slug }} className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-3 font-mono text-xs text-muted-foreground transition-colors hover:text-bitcoin">
                  <span className="truncate">{neighbor.name}</span><ArrowRight className="size-3.5 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <nav aria-label="Neighboring places" className="mx-auto grid max-w-[1380px] gap-px border-y border-border bg-border sm:grid-cols-2 sm:border-x">
        <Link to="/map/place/$block" params={{ block: String(place.neighbors.previous) }} className="group bg-background p-5 transition-colors hover:bg-bitcoin/5 md:p-7">
          <p className="label text-muted-foreground">PREVIOUS BLOCK</p>
          <p className="display mt-2 text-xl group-hover:text-bitcoin" data-no-translate><ArrowLeft className="mr-2 inline size-4" />{place.neighbors.previous.toLocaleString("en-US")}</p>
        </Link>
        <Link to="/map/place/$block" params={{ block: String(place.neighbors.next) }} className="group bg-background p-5 text-right transition-colors hover:bg-bitcoin/5 md:p-7">
          <p className="label text-muted-foreground">NEXT BLOCK</p>
          <p className="display mt-2 text-xl group-hover:text-bitcoin" data-no-translate>{place.neighbors.next.toLocaleString("en-US")}<ArrowRight className="ml-2 inline size-4" /></p>
        </Link>
      </nav>
    </main>
  );
}
