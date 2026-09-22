import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Blocks, Box, Compass, Map, Mountain, Navigation, Radar, Users } from "lucide-react";
import { AtlasDistrictIllustration } from "@/components/AtlasDistrictIllustration";
import { BssCrawlerDriver } from "@/components/BssCrawlerDriver";
import { Button } from "@/components/ui/button";
import { atlasEra, blockToAtlas } from "@/lib/atlas-geometry";
import { getAtlasRegionStats } from "@/lib/atlas-land.functions";
import { getBssScenesInRange } from "@/lib/bss.functions";
import { getBssCrawlProgress } from "@/lib/bss-crawl.functions";
import { atlasDistrictBySlug, atlasDistrictNeighbors, atlasDistrictStory, atlasDistricts, districtBlockRange } from "@/lib/atlas-places";

export const Route = createFileRoute("/map_/district/$slug")({
  loader: async ({ params }) => {
    const district = atlasDistrictBySlug(params.slug);
    if (!district) throw notFound();
    const range = districtBlockRange(district);
    const [analytics, sceneDirectory] = await Promise.all([
      getAtlasRegionStats({ data: range }),
      getBssScenesInRange({ data: range }),
    ]);
    return { district, story: atlasDistrictStory(district), neighbors: atlasDistrictNeighbors(district), range, analytics, scenes: sceneDirectory.scenes };
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
  const { district, story, neighbors, range, analytics, scenes: seedScenes } = Route.useLoaderData();
  const liveScenes = useQuery({
    queryKey: ["bss-scenes", range.lo, range.hi],
    queryFn: () => getBssScenesInRange({ data: range }),
    initialData: { scenes: seedScenes },
    staleTime: 30_000,
  });
  const scenes = liveScenes.data.scenes;
  const discovery = useQuery({
    queryKey: ["bss-crawl", range.lo, range.hi],
    queryFn: () => getBssCrawlProgress({ data: { range } }),
    staleTime: 30_000,
  });
  const sweepStats = useQuery({
    queryKey: ["bss-crawl", "sweep"],
    queryFn: () => getBssSweepProgress(),
    staleTime: 30_000,
  });
  const point = blockToAtlas(district.anchorHeight);
  const era = atlasEra(district.anchorHeight, 1_048_575);
  const heldBitmaps = Math.max(0, analytics.indexed - analytics.unowned);
  const districts = atlasDistricts();
  const previous = districts[(district.index - 1 + districts.length) % districts.length];
  const next = districts[(district.index + 1) % districts.length];

  return (
    <main className="storybook-page min-h-screen pb-16 md:pb-24">
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
          <section className="border border-bitcoin/40 bg-bitcoin/5 p-5">
            <div className="flex items-center gap-2"><Users className="size-4 text-bitcoin"/><h2 className="label text-bitcoin">DISTRICT OWNERSHIP</h2></div>
            <p className="mt-2 font-mono text-[9px] text-muted-foreground" data-no-translate>BLOCKS {range.lo.toLocaleString("en-US")}–{range.hi.toLocaleString("en-US")}</p>
            <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border font-mono">
              <div className="bg-background/90 p-3"><dt className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><Users className="size-3"/>HOLDER ADDRESSES</dt><dd className="mt-2 text-2xl text-bitcoin" data-no-translate>{analytics.owners.toLocaleString("en-US")}</dd></div>
              <div className="bg-background/90 p-3"><dt className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><Blocks className="size-3"/>BITMAPS HELD</dt><dd className="mt-2 text-2xl text-signal" data-no-translate>{heldBitmaps.toLocaleString("en-US")}</dd></div>
              <div className="col-span-2 bg-background/90 p-3"><dt className="text-[9px] text-muted-foreground">AVERAGE PER HOLDER</dt><dd className="mt-1 text-sm" data-no-translate>{analytics.owners > 0 ? (heldBitmaps / analytics.owners).toFixed(2) : "—"} BITMAPS</dd></div>
            </dl>
            {analytics.top.length > 0 ? <div className="mt-5">
              <p className="label text-muted-foreground">BIGGEST HOLDERS</p>
              <ol className="mt-2 divide-y divide-border">
                {analytics.top.slice(0, 5).map((holder, index) => {
                  const share = heldBitmaps > 0 ? (holder.held / heldBitmaps) * 100 : 0;
                  return (
                  <li key={holder.address} className="flex min-w-0 items-center gap-3 py-2 font-mono text-[10px]">
                    <span className="text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <Link to="/profile/$address" params={{ address: holder.address }} className="min-w-0 flex-1 truncate hover:text-bitcoin" data-no-translate>{holder.address.slice(0, 10)}…{holder.address.slice(-6)}</Link>
                    <span className="shrink-0 text-bitcoin" data-no-translate>{holder.held} · {share.toFixed(1)}%</span>
                  </li>
                  );
                })}
              </ol>
            </div> : <p className="mt-4 font-mono text-[10px] text-muted-foreground">NO INDEXED HOLDERS IN THIS DISTRICT YET</p>}
          </section>
          <section className="border border-signal/40 bg-signal/5 p-5">
            <div className="flex items-center gap-2"><Box className="size-4 text-signal"/><h2 className="label text-signal">ON-CHAIN SCENES</h2></div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Verified BSS scenes discovered on BITMAPs in this district.</p>
            {scenes.length > 0 ? (
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {scenes.map((scene) => (
                  <li key={scene.bitmap_height} className="py-4">
                    <div className="flex min-w-0 items-start justify-between gap-3 font-mono" data-no-translate>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{Number(scene.bitmap_height).toLocaleString("en-US")}.BITMAP</p>
                        <p className="mt-1 text-[9px] text-signal">BSS {scene.version_label} · {scene.object_count} OBJECTS · {scene.resource_count} RESOURCES</p>
                      </div>
                      <span className="shrink-0 text-[9px] text-signal">VALID</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button asChild variant="terminalGhost" size="sm"><Link to="/bitmap/$block" params={{ block: String(scene.bitmap_height) }}><Blocks />LAND</Link></Button>
                      <Button asChild variant="terminal" size="sm"><Link to="/oasis" search={{ height: Number(scene.bitmap_height) }}><Mountain />DROP IN 3D</Link></Button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 font-mono text-[10px] text-muted-foreground">NO VERIFIED BSS SCENES DISCOVERED HERE YET</p>}
            <p className="mt-4 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground" data-no-translate>
              <Radar className="size-3 text-signal" />
              {(discovery.data?.scanned ?? 0).toLocaleString("en-US")} BITMAPS CHECKED · {(discovery.data?.scenes ?? scenes.length).toLocaleString("en-US")} SCENES FOUND
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground" data-no-translate>
              <Radar className="size-3 text-signal/60" />
              {(sweepStats.data?.blocksSwept ?? 0).toLocaleString("en-US")} BLOCKS SWEPT ·{" "}
              {(sweepStats.data?.inscriptionsSeen ?? 0).toLocaleString("en-US")} INSCRIPTIONS READ ·{" "}
              {(sweepStats.data?.bmpSeen ?? 0).toLocaleString("en-US")} BMP CANDIDATES
            </p>
            <BssCrawlerDriver lo={range.lo} hi={range.hi} />
          </section>
          <section className="border border-border bg-surface/60 p-5">
            <div className="flex items-center gap-2"><Compass className="size-4 text-signal"/><h2 className="label text-signal">SPATIAL RECORD</h2></div>
            <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border font-mono text-[10px]">
              <div className="bg-background p-3"><dt className="text-muted-foreground">COORDINATES</dt><dd className="mt-1 text-signal">{point.x.toString().padStart(4, "0")} : {point.y.toString().padStart(4, "0")}</dd></div>
              <div className="bg-background p-3"><dt className="text-muted-foreground">ATLAS CELL</dt><dd className="mt-1">{story.column + 1} : {story.row + 1}</dd></div>
              <div className="col-span-2 bg-background p-3"><dt className="text-muted-foreground">ANCHOR BITMAP</dt><dd className="mt-1 text-bitcoin">{district.anchorHeight.toLocaleString("en-US")}.BITMAP</dd></div>
              <div className="col-span-2 bg-background p-3"><dt className="text-muted-foreground">ERA / BIOME</dt><dd className="mt-1">{era.label} · {era.biome}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button asChild variant="terminal"><Link to="/map/place/$block" params={{ block: String(district.anchorHeight) }}><Navigation />ANCHOR PLACE</Link></Button>
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