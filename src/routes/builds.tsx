import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { BlockMosaic } from "@/components/BlockMosaic";
import { ClubBadge } from "@/components/ClubBadge";
import { FollowBuilderButton } from "@/components/FollowBuilderButton";
import { buildsQuery, type BuildEntry } from "@/lib/builds";
import { districtsQuery } from "@/lib/districts";
import { followerCountsQuery, myFollowsQuery } from "@/lib/follows";
import { useAuthSession } from "@/lib/auth";
import { inscriptionImageUrl, profilesQuery, type WalletProfile } from "@/lib/profiles";
import { BuilderName } from "@/components/BuilderName";
import { DistrictRarity } from "@/components/DistrictRarity";
import { shortenAddress } from "@/lib/registry";
import { Button } from "@/components/ui/button";
import { BUILD_KIND_LABELS, BUILD_KINDS, type BuildKind } from "@/lib/build-sdk";

export const Route = createFileRoute("/builds")({
  head: () => ({
    meta: [
      { title: "Builds Feed — Recently Built & Most Visited Bitmaps" },
      {
        name: "description",
        content:
          "Live feed of Bitcoin bitmaps people build on: newest builds, most visited builds, districts, and the builders you follow.",
      },
      { property: "og:title", content: "Builds Feed — Recently Built & Most Visited Bitmaps" },
      {
        property: "og:description",
        content: "Newest and most visited owner-built bitmap pages, plus the builders you follow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildsPage,
});

type FeedTab = "recent" | "visited" | "following";
type KindFilter = "all" | BuildKind;

const PAGE_SIZE = 12;

const TABS: { id: FeedTab; label: string }[] = [
  { id: "recent", label: "NEWEST" },
  { id: "visited", label: "POPULAR" },
  { id: "following", label: "FOLLOWING" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "NOW";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.floor(hours / 24)}D AGO`;
}

function BuildCard({
  entry,
  followers,
  profile,
}: {
  entry: BuildEntry;
  followers?: number;
  profile?: WalletProfile | null;
}) {
  const { page, totalViews, uniqueVisitors } = entry;
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary">
      <Link to="/bitmap/$block" params={{ block: String(page.bitmapHeight) }}>
        <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-background">
          {page.bannerInscriptionId ? (
            <img
              src={inscriptionImageUrl(page.bannerInscriptionId)}
              alt={`Banner built on bitmap ${page.bitmapHeight}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="h-full w-full [&>div]:h-full [&_svg]:h-full [&_svg]:w-full">
              <BlockMosaic height={page.bitmapHeight} />
            </div>
          )}
          <span className="label absolute left-2 top-2 rounded border border-border bg-background/90 px-2 py-1 text-primary backdrop-blur-sm">
            {BUILD_KIND_LABELS[page.buildKind]}
          </span>
          <span className="label absolute bottom-2 right-2 rounded border border-border bg-background/90 px-2 py-1 text-foreground backdrop-blur-sm">
            {totalViews.toLocaleString("en-US")} VIEWS
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="display truncate text-base leading-tight">
                {page.title || `${page.bitmapHeight}.BITMAP`}
              </h2>
              <div className="label mt-1 text-muted-foreground">{page.bitmapHeight}.BITMAP</div>
            </div>
            <ClubBadge height={page.bitmapHeight} />
          </div>
          <div className="label mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span>{uniqueVisitors.toLocaleString("en-US")} VISITORS</span>
            <span>UPDATED {timeAgo(page.updatedAt ?? null)}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <Link
          to="/profile/$address"
          params={{ address: page.ownerAddress }}
          className="label min-w-0 hover:text-primary"
        >
          <BuilderName address={page.ownerAddress} profile={profile ?? null} avatar />
        </Link>
        <FollowBuilderButton address={page.ownerAddress} followers={followers} />
      </div>
    </article>
  );
}

function BuildsPage() {
  const [tab, setTab] = useState<FeedTab>("recent");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { user } = useAuthSession();
  const builds = useQuery(buildsQuery(500));
  const districts = useQuery(districtsQuery(40));

  const addresses = useMemo(
    () => Array.from(new Set((builds.data ?? []).map((b) => b.page.ownerAddress))),
    [builds.data],
  );
  const counts = useQuery({
    ...followerCountsQuery(addresses),
    enabled: addresses.length > 0,
  });
  const follows = useQuery({ ...myFollowsQuery(), enabled: Boolean(user) });
  const profiles = useQuery({ ...profilesQuery(addresses), enabled: addresses.length > 0 });

  const entries = useMemo(() => {
    const all = builds.data ?? [];
    const followed = new Set(follows.data ?? []);
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = all.filter((entry) => {
      if (tab === "following" && !followed.has(entry.page.ownerAddress)) return false;
      if (kind !== "all" && entry.page.buildKind !== kind) return false;
      if (!normalizedQuery) return true;
      const profileName = profiles.data?.get(entry.page.ownerAddress)?.displayName ?? "";
      return [
        String(entry.page.bitmapHeight),
        entry.page.title ?? "",
        entry.page.description ?? "",
        entry.page.ownerAddress,
        profileName,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
    if (tab === "visited") {
      return [...filtered].sort(
        (a, b) => b.totalViews - a.totalViews || b.uniqueVisitors - a.uniqueVisitors,
      );
    }
    return [...filtered].sort(
      (a, b) =>
        new Date(b.page.updatedAt ?? 0).getTime() - new Date(a.page.updatedAt ?? 0).getTime(),
    );
  }, [builds.data, tab, follows.data, kind, query, profiles.data]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [tab, query, kind]);

  const visibleEntries = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;
  const totalViews = useMemo(
    () => (builds.data ?? []).reduce((sum, entry) => sum + entry.totalViews, 0),
    [builds.data],
  );

  const topBuilders = useMemo(() => {
    const byAddress = new Map<string, { builds: number; views: number }>();
    for (const entry of builds.data ?? []) {
      const current = byAddress.get(entry.page.ownerAddress) ?? { builds: 0, views: 0 };
      byAddress.set(entry.page.ownerAddress, {
        builds: current.builds + 1,
        views: current.views + entry.totalViews,
      });
    }
    return Array.from(byAddress.entries())
      .map(([address, stat]) => ({ address, ...stat }))
      .sort((a, b) => b.views - a.views || b.builds - a.builds)
      .slice(0, 8);
  }, [builds.data]);

  const emptyLabel =
    tab === "following"
      ? user
        ? "YOU FOLLOW NO BUILDERS YET — FOLLOW ONE FROM ANY BUILD"
        : "SIGN IN TO FOLLOW BUILDERS AND SEE THEIR FEED"
      : "NOTHING BUILT YET — OPEN A BITMAP YOU HOLD AND BUILD ON IT";

  const clearFilters = () => {
    setQuery("");
    setKind("all");
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8 md:py-12">
      <header className="border-b border-border pb-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="label text-primary">BITMAP WORLDS · LIVE DIRECTORY</div>
            <h1 className="display mt-3 text-4xl md:text-6xl">DISCOVER BUILDS</h1>
            <p className="mt-4 max-w-2xl font-mono text-xs leading-6 text-muted-foreground">
              ENTER OWNER-BUILT WORLDS, GALLERIES, SHOPS, GAMES AND PERSONAL SPACES.
            </p>
          </div>
          <dl className="grid grid-cols-3 border border-border bg-card lg:min-w-[420px]">
            <div className="border-r border-border p-4">
              <dt className="label">BUILDS</dt>
              <dd className="display mt-2 text-2xl text-primary">{(builds.data ?? []).length}</dd>
            </div>
            <div className="border-r border-border p-4">
              <dt className="label">BUILDERS</dt>
              <dd className="display mt-2 text-2xl">{addresses.length}</dd>
            </div>
            <div className="p-4">
              <dt className="label">VIEWS</dt>
              <dd className="display mt-2 text-2xl">{totalViews.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-8" aria-label="Build directory">
        <div className="sticky top-16 z-20 border-y border-border bg-background/95 py-3 backdrop-blur-md">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SEARCH TITLE, BITMAP OR BUILDER"
                aria-label="Search builds"
                className="h-10 w-full rounded-md border border-input bg-card pl-10 pr-10 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 h-10 w-10 -translate-y-1/2"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X />
                </Button>
              ) : null}
            </div>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as KindFilter)}
              aria-label="Filter by build type"
              className="h-10 rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="all">ALL BUILD TYPES</option>
              {BUILD_KINDS.map((buildKind) => (
                <option key={buildKind} value={buildKind}>{BUILD_KIND_LABELS[buildKind]}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 rounded-md border border-border bg-card p-1">
              {TABS.map((entry) => (
                <Button
                  key={entry.id}
                  type="button"
                  size="sm"
                  variant={tab === entry.id ? "default" : "ghost"}
                  onClick={() => setTab(entry.id)}
                  className="label h-8 px-3"
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="label">
            <span className="text-foreground">{entries.length.toLocaleString("en-US")}</span> RESULT{entries.length === 1 ? "" : "S"}
            {hasMore ? ` · SHOWING ${visibleEntries.length}` : ""}
          </p>
          {(query || kind !== "all") ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="label">
              <X /> RESET
            </Button>
          ) : null}
        </div>

        {visibleEntries.length > 0 ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visibleEntries.map((entry) => (
              <BuildCard
                key={entry.page.bitmapHeight}
                entry={entry}
                followers={counts.data?.get(entry.page.ownerAddress) ?? 0}
                profile={profiles.data?.get(entry.page.ownerAddress) ?? null}
              />
            ))}
            </div>
            {hasMore ? (
              <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-8">
                <span className="label">{entries.length - visibleCount} MORE BUILDS</span>
                <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  LOAD {Math.min(PAGE_SIZE, entries.length - visibleCount)} MORE
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 flex min-h-48 flex-col items-center justify-center border border-dashed border-border p-8 text-center">
            <span className="display text-xl">{builds.isPending ? "SYNCING BUILDS" : "NO BUILDS FOUND"}</span>
            <span className="label mt-3 max-w-lg text-muted-foreground">{builds.isPending ? "READING THE LIVE DIRECTORY" : (query || kind !== "all") ? "TRY A DIFFERENT SEARCH OR BUILD TYPE" : emptyLabel}</span>
            {!builds.isPending && (query || kind !== "all") ? (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="mt-5">RESET FILTERS</Button>
            ) : null}
          </div>
        )}
      </section>

      <div className="mt-16 grid gap-12 xl:grid-cols-[1fr_1.35fr]">
        <section>
          <div className="flex items-end justify-between border-b border-border pb-3">
            <div>
              <h2 className="display text-xl">TOP BUILDERS</h2>
              <p className="label mt-2">RANKED BY REAL BUILD VIEWS</p>
            </div>
          </div>
          <div className="divide-y divide-border border-b border-border">
            {topBuilders.map((builder, index) => (
              <div key={builder.address} className="flex items-center gap-3 py-3">
                <span className="display w-7 text-lg text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <Link to="/profile/$address" params={{ address: builder.address }} className="min-w-0 flex-1">
                  <div className="display text-sm"><BuilderName address={builder.address} profile={profiles.data?.get(builder.address) ?? null} avatar /></div>
                  <div className="label mt-1">{builder.builds} BUILDS · {builder.views.toLocaleString("en-US")} VIEWS</div>
                </Link>
                <FollowBuilderButton address={builder.address} followers={counts.data?.get(builder.address) ?? 0} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="border-b border-border pb-3">
            <h2 className="display text-xl">EXPLORE ZONES</h2>
            <p className="label mt-2">BITMAP NEIGHBORHOODS BUILT BY HOLDERS</p>
          </div>
          {districts.data && districts.data.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {districts.data.map((d) => (
              <Link
                key={d.id}
                to="/district/$slug"
                params={{ slug: d.slug }}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="display text-base">{d.name.toUpperCase()}</span>
                  <span className="label">{d.heights.length} BITMAPS</span>
                </div>
                <div className="label mt-2">{shortenAddress(d.ownerAddress)}</div>
                <DistrictRarity heights={d.heights} max={4} className="mt-2" />
                {d.description ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{d.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6">
            <span className="label text-muted-foreground">
              {districts.isPending ? "SYNC" : "NO ZONES YET — CREATE ONE FROM YOUR WALLET"}
            </span>
          </div>
        )}
        </section>
      </div>
    </main>
  );
}
