import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Box, Eye, Search, Users, X } from "lucide-react";
import { BlockMosaic } from "@/components/BlockMosaic";
import { BuilderName } from "@/components/BuilderName";
import { ClubBadge } from "@/components/ClubBadge";
import { PublicBuildViewer } from "@/components/builds/PublicBuildViewer";
import { Button } from "@/components/ui/button";
import { BUILD_KIND_LABELS, BUILD_KINDS, type BuildKind } from "@/lib/build-sdk";
import { buildsQuery, type BuildEntry } from "@/lib/builds";
import { inscriptionImageUrl, profilesQuery } from "@/lib/profiles";

export const Route = createFileRoute("/builds")({
  head: () => ({
    meta: [
      { title: "Community Builds — Live 3D BITMAP Worlds" },
      { name: "description", content: "Browse every public BITMAP build, inspect its live 3D world, and enter the exact territory in the Oasis." },
      { property: "og:title", content: "Community Builds — Live 3D BITMAP Worlds" },
      { property: "og:description", content: "Preview and enter public BITMAP worlds built by the community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityBuildsPage,
});

type SortMode = "newest" | "popular";
type KindFilter = "all" | BuildKind;
const PAGE_SIZE = 16;

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function CommunityBuildsPage() {
  const builds = useQuery(buildsQuery());
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const stageRef = useRef<HTMLElement | null>(null);

  const addresses = useMemo(
    () => Array.from(new Set((builds.data ?? []).map((entry) => entry.page.ownerAddress).filter(Boolean))),
    [builds.data],
  );
  const profiles = useQuery({ ...profilesQuery(addresses), enabled: addresses.length > 0 });

  const entries = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = (builds.data ?? []).filter((entry) => {
      if (kind !== "all" && entry.page.buildKind !== kind) return false;
      if (!term) return true;
      const profileName = entry.page.ownerAddress ? profiles.data?.get(entry.page.ownerAddress)?.displayName ?? "" : "";
      return [
        entry.page.bitmapHeight,
        entry.page.title ?? "",
        entry.page.description ?? "",
        profileName,
        ...entry.extenderNames,
      ].some((value) => String(value).toLowerCase().includes(term));
    });
    return filtered.sort((a, b) => sort === "popular"
      ? b.totalViews - a.totalViews || b.uniqueVisitors - a.uniqueVisitors
      : timestamp(b.page.updatedAt) - timestamp(a.page.updatedAt) || b.page.bitmapHeight - a.page.bitmapHeight);
  }, [builds.data, kind, profiles.data, query, sort]);

  const selected = useMemo(() => {
    if (selectedHeight !== null) {
      const exact = (builds.data ?? []).find((entry) => entry.page.bitmapHeight === selectedHeight);
      if (exact) return exact;
    }
    return entries[0] ?? builds.data?.[0] ?? null;
  }, [builds.data, entries, selectedHeight]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [kind, query, sort]);

  function preview(entry: BuildEntry) {
    setSelectedHeight(entry.page.bitmapHeight);
    window.requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const visibleEntries = entries.slice(0, visibleCount);
  const publicExtenders = (builds.data ?? []).filter((entry) => entry.hasActiveExtender).length;
  const totalViews = (builds.data ?? []).reduce((sum, entry) => sum + entry.totalViews, 0);

  return (
    <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-5 md:py-10">
      <header className="border-b border-border pb-7">
        <div className="label text-bitcoin">DISCOVER · PUBLIC BITMAP EXPERIENCES</div>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="display text-4xl sm:text-5xl md:text-7xl">COMMUNITY BUILDS</h1>
            <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-muted-foreground">
              BROWSE LIVE 3D WORLDS BUILT ON BITCOIN LAND. PREVIEW THE EXPERIENCE, THEN ENTER ITS EXACT BITMAP.
            </p>
          </div>
          <dl className="grid grid-cols-3 border border-border bg-card lg:min-w-[440px]">
            <Metric label="PUBLIC BUILDS" value={(builds.data ?? []).length} />
            <Metric label="LIVE EXTENDERS" value={publicExtenders} />
            <Metric label="VISITS" value={totalViews} last />
          </dl>
        </div>
      </header>

      <section ref={stageRef} className="scroll-mt-24 border-x border-b border-border" aria-label="Selected live build">
        {selected ? (
          <>
            <div className="grid gap-px border-b border-border bg-border lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="bg-background px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="label text-signal">LIVE 3D · {selected.hasActiveExtender ? "EXTENDER ACTIVE" : BUILD_KIND_LABELS[selected.page.buildKind]}</div>
                    <h2 className="display mt-2 text-2xl sm:text-4xl">{selected.page.title || `${selected.page.bitmapHeight}.BITMAP`}</h2>
                    <p className="label mt-2 text-muted-foreground">{selected.page.bitmapHeight}.BITMAP{selected.extenderNames.length ? ` · ${selected.extenderNames.join(" · ")}` : ""}</p>
                  </div>
                  <ClubBadge height={selected.page.bitmapHeight} asLink={false} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-2">
                <StageMetric icon={<Eye />} label="VIEWS" value={selected.totalViews} />
                <StageMetric icon={<Users />} label="VISITORS" value={selected.uniqueVisitors} />
              </div>
            </div>
            <PublicBuildViewer key={selected.page.bitmapHeight} page={selected.page} />
            <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
              <Button asChild size="lg" className="h-12 rounded-none">
                <Link to="/oasis" search={{ height: selected.page.bitmapHeight }}><ArrowUpRight /> ENTER BUILD</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-none border-0">
                <Link to="/bitmap/$block" params={{ block: String(selected.page.bitmapHeight) }}><Box /> OPEN BITMAP</Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <p className="label text-muted-foreground">{builds.isPending ? "READING EVERY PUBLIC BUILD…" : "NO PUBLIC BUILDS RECORDED"}</p>
          </div>
        )}
      </section>

      <section className="mt-8" aria-label="Community build directory">
        <div className="sticky top-16 z-20 border-y border-border bg-background/95 py-3 backdrop-blur-md">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SEARCH BUILD, BITMAP, EXTENDER OR BUILDER"
                aria-label="Search community builds"
                className="h-10 w-full border border-input bg-card pl-10 pr-10 font-mono text-xs text-foreground outline-none focus:border-bitcoin"
              />
              {query ? <Button type="button" size="icon" variant="ghost" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-0 top-0 h-10"><X /></Button> : null}
            </div>
            <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} aria-label="Filter by build type" className="h-10 border border-input bg-card px-3 font-mono text-[11px] text-foreground">
              <option value="all">ALL BUILD TYPES</option>
              {BUILD_KINDS.map((value) => <option key={value} value={value}>{BUILD_KIND_LABELS[value]}</option>)}
            </select>
            <div className="grid grid-cols-2 border border-border bg-card p-1">
              <Button type="button" size="sm" variant={sort === "newest" ? "default" : "ghost"} onClick={() => setSort("newest")}>NEWEST</Button>
              <Button type="button" size="sm" variant={sort === "popular" ? "default" : "ghost"} onClick={() => setSort("popular")}>POPULAR</Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="display text-xl">ALL PUBLIC BUILDS</h2>
          <span className="label">{entries.length.toLocaleString("en-US")} FOUND</span>
        </div>

        {visibleEntries.length ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleEntries.map((entry) => (
                <BuildCard key={entry.page.bitmapHeight} entry={entry} active={selected?.page.bitmapHeight === entry.page.bitmapHeight} profile={entry.page.ownerAddress ? profiles.data?.get(entry.page.ownerAddress) ?? null : null} onPreview={() => preview(entry)} />
              ))}
            </div>
            {visibleCount < entries.length ? (
              <div className="mt-7 flex justify-center border-t border-border pt-7">
                <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>LOAD {Math.min(PAGE_SIZE, entries.length - visibleCount)} MORE</Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 grid min-h-40 place-items-center border border-dashed border-border px-5 text-center">
            <p className="label text-muted-foreground">{builds.isPending ? "SYNCING PUBLIC BUILDS…" : "NO BUILDS MATCH THESE FILTERS"}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, last = false }: { label: string; value: number; last?: boolean }) {
  return <div className={`${last ? "" : "border-r border-border"} p-3 sm:p-4`}><dt className="label">{label}</dt><dd className="display mt-2 text-xl text-bitcoin sm:text-2xl">{value.toLocaleString("en-US")}</dd></div>;
}

function StageMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="bg-card p-3"><div className="flex items-center gap-2 text-signal [&_svg]:size-3.5">{icon}<span className="label">{label}</span></div><div className="display mt-2 text-xl">{value.toLocaleString("en-US")}</div></div>;
}

function BuildCard({ entry, active, profile, onPreview }: { entry: BuildEntry; active: boolean; profile: NonNullable<Parameters<typeof BuilderName>[0]["profile"]> | null; onPreview: () => void }) {
  const { page } = entry;
  return (
    <article className={`overflow-hidden border bg-card ${active ? "border-signal" : "border-border"}`}>
      <button type="button" onClick={onPreview} className="group block w-full text-left" aria-label={`Preview ${page.bitmapHeight}.BITMAP`}>
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-background">
          {page.bannerInscriptionId ? <img src={inscriptionImageUrl(page.bannerInscriptionId)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" /> : <div className="h-full [&>div]:h-full [&_svg]:h-full [&_svg]:w-full"><BlockMosaic height={page.bitmapHeight} /></div>}
          <span className={`label absolute left-2 top-2 border px-2 py-1 backdrop-blur ${entry.hasActiveExtender ? "border-signal bg-background/90 text-signal" : "border-border bg-background/90 text-bitcoin"}`}>{entry.hasActiveExtender ? "LIVE 3D" : BUILD_KIND_LABELS[page.buildKind]}</span>
          <span className="label absolute bottom-2 right-2 border border-border bg-background/90 px-2 py-1">{entry.totalViews.toLocaleString("en-US")} VIEWS</span>
        </div>
        <div className="p-3">
          <h3 className="display truncate text-base">{page.title || `${page.bitmapHeight}.BITMAP`}</h3>
          <p className="label mt-1 truncate text-muted-foreground">{page.bitmapHeight}.BITMAP{entry.extenderNames[0] ? ` · ${entry.extenderNames[0]}` : ""}</p>
        </div>
      </button>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border px-3 py-2">
        <div className="min-w-0 label text-muted-foreground">
          {page.ownerAddress ? <Link to="/profile/$address" params={{ address: page.ownerAddress }} className="hover:text-bitcoin"><BuilderName address={page.ownerAddress} profile={profile} avatar /></Link> : "ACTIVE PUBLIC DEPLOYMENT"}
        </div>
        <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onPreview}><Eye /> {active ? "VIEWING" : "PREVIEW"}</Button>
      </div>
      <Button asChild variant="ghost" className="h-9 w-full rounded-none border-t border-border">
        <Link to="/oasis" search={{ height: page.bitmapHeight }}>ENTER BUILD <ArrowUpRight /></Link>
      </Button>
    </article>
  );
}
