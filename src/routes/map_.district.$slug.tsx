import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, Landmark, Map, Mountain, Navigation } from "lucide-react";
import { AtlasDistrictIllustration } from "@/components/AtlasDistrictIllustration";
import { Button } from "@/components/ui/button";
import { atlasEra, blockToAtlas } from "@/lib/atlas-geometry";
import { atlasDistrictBySlug, atlasDistrictNeighbors, atlasDistrictStory, atlasDistricts } from "@/lib/atlas-places";

export const Route = createFileRoute("/map_/district/$slug")({
  loader: ({ params }) => {
    const district = atlasDistrictBySlug(params.slug);
    if (!district) throw notFound();
    return { district, story: atlasDistrictStory(district), neighbors: atlasDistrictNeighbors(district) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Atlas district not found — BitmapWin" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.district.name} — Oasis District Story`;
    const description = `Enter ${loaderData.district.name}, a named district around ${loaderData.district.landmark} in BitmapWin's illustrated Bitcoin land atlas.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  notFoundComponent: DistrictStoryNotFound,
  component: DistrictStoryPage,
});

function DistrictStoryNotFound() {
  return <main className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="label text-bitcoin">ATLAS RECORD</p><h1 className="display mt-3 text-4xl">DISTRICT NOT FOUND</h1><Button asChild variant="terminal" className="mt-7"><Link to="/map"><Map />RETURN TO ATLAS</Link></Button></main>;
}

function DistrictStoryPage() {
  const { district, story, neighbors } = Route.useLoaderData();
  const point = blockToAtlas(district.anchorHeight);
  const era = atlasEra(district.anchorHeight, 1_048_575);
  const districts = atlasDistricts();
  const previous = districts[(district.index - 1 + districts.length) % districts.length];
  const next = districts[(district.index + 1) % districts.length];

  return (
    <main className="pb-16 md:pb-24">
      <div className="mx-auto max-w-[1600px] px-0 pt-3 sm:px-4 md:px-8 md:pt-7">
        <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-0">
          <Button asChild variant="ghost" size="sm"><Link to="/map"><ArrowLeft />ATLAS</Link></Button>
          <p className="font-mono text-[9px] uppercase text-muted-foreground">DISTRICT {String(district.index + 1).padStart(2, "0")} / 64</p>
        </div>
        <AtlasDistrictIllustration district={story} />
      </div>

      <div className="mx-auto grid max-w-[1380px] gap-10 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] lg:py-16">
        <article className="min-w-0">
          <p className="label text-bitcoin">ATLAS STORY · IMAGINED LORE</p>
          <div className="mt-5 max-w-3xl space-y-5 text-lg leading-8 text-foreground/90 md:text-xl md:leading-9">
            <p>{story.story[0]}</p>
            <p>{story.story[1]}</p>
          </div>
          <div className="mt-9 border-l-2 border-signal bg-signal/5 p-5">
            <p className="label text-signal">THE LANDMARK</p>
            <h2 className="display mt-2 text-2xl md:text-3xl">{district.landmark}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">The atlas landmark gives this district a shared point of orientation. It is world lore, while BITMAP ownership and recorded activity remain grounded in verifiable sources.</p>
          </div>
        </article>

        <aside className="min-w-0 space-y-4">
          <section className="border border-border bg-surface/60 p-5">
            <div className="flex items-center gap-2"><Compass className="size-4 text-signal"/><h2 className="label text-signal">SPATIAL RECORD</h2></div>
            <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border font-mono text-[10px]">
              <div className="bg-background p-3"><dt className="text-muted-foreground">COORDINATES</dt><dd className="mt-1 text-signal">{point.x.toString().padStart(4, "0")} : {point.y.toString().padStart(4, "0")}</dd></div>
              <div className="bg-background p-3"><dt className="text-muted-foreground">ATLAS CELL</dt><dd className="mt-1">{story.column + 1} : {story.row + 1}</dd></div>
              <div className="col-span-2 bg-background p-3"><dt className="text-muted-foreground">ANCHOR BITMAP</dt><dd className="mt-1 text-bitcoin">{district.anchorHeight.toLocaleString("en-US")}.BITMAP</dd></div>
              <div className="col-span-2 bg-background p-3"><dt className="text-muted-foreground">ERA / BIOME</dt><dd className="mt-1">{era.label} · {era.biome}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button asChild variant="terminal"><Link to="/map/$block" params={{ block: String(district.anchorHeight) }}><Navigation />OPEN LAND</Link></Button>
              <Button asChild variant="terminalGhost"><Link to="/oasis" search={{ height: district.anchorHeight }}><Mountain />DROP IN 3D</Link></Button>
            </div>
          </section>
          <section className="border border-border bg-surface/40 p-5">
            <h2 className="label text-bitcoin">NEIGHBORING DISTRICTS</h2>
            <div className="mt-3 grid gap-2">
              {neighbors.map((neighbor) => <Link key={neighbor.slug} to="/map/district/$slug" params={{ slug: neighbor.slug }} className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-3 font-mono text-xs text-muted-foreground transition-colors hover:text-bitcoin"><span className="truncate">{neighbor.name}</span><ArrowRight className="size-3.5 shrink-0" /></Link>)}
            </div>
          </section>
        </aside>
      </div>

      {previous && next ? <nav aria-label="District stories" className="mx-auto grid max-w-[1380px] gap-px border-y border-border bg-border sm:grid-cols-2 sm:border-x">
        <Link to="/map/district/$slug" params={{ slug: previous.slug }} className="group bg-background p-5 transition-colors hover:bg-bitcoin/5 md:p-7"><p className="label text-muted-foreground">PREVIOUS DISTRICT</p><p className="display mt-2 text-xl group-hover:text-bitcoin"><ArrowLeft className="mr-2 inline size-4" />{previous.name}</p></Link>
        <Link to="/map/district/$slug" params={{ slug: next.slug }} className="group bg-background p-5 text-right transition-colors hover:bg-bitcoin/5 md:p-7"><p className="label text-muted-foreground">NEXT DISTRICT</p><p className="display mt-2 text-xl group-hover:text-bitcoin">{next.name}<ArrowRight className="ml-2 inline size-4" /></p></Link>
      </nav> : null}
    </main>
  );
}