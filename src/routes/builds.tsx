import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BlockMosaic } from "@/components/BlockMosaic";
import { ClubBadge } from "@/components/ClubBadge";
import { FollowBuilderButton } from "@/components/FollowBuilderButton";
import { buildsQuery, type BuildEntry } from "@/lib/builds";
import { districtsQuery } from "@/lib/districts";
import { followerCountsQuery, myFollowsQuery } from "@/lib/follows";
import { useAuthSession } from "@/lib/auth";
import { inscriptionImageUrl } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";

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

const TABS: { id: FeedTab; label: string }[] = [
  { id: "recent", label: "RECENTLY BUILT" },
  { id: "visited", label: "MOST VISITED" },
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
}: {
  entry: BuildEntry;
  followers?: number;
}) {
  const { page, totalViews, uniqueVisitors } = entry;
  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-[border-color,transform] duration-150 hover:border-primary hover:-translate-y-0.5">
      <Link to="/bitmap/$block" params={{ block: String(page.bitmapHeight) }}>
        {page.bannerInscriptionId ? (
          <img
            src={inscriptionImageUrl(page.bannerInscriptionId)}
            alt={`Banner built on bitmap ${page.bitmapHeight}`}
            loading="lazy"
            className="aspect-square w-full border border-border object-cover"
          />
        ) : (
          <div className="border border-border">
            <BlockMosaic height={page.bitmapHeight} />
          </div>
        )}
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="display text-sm">{page.bitmapHeight}.BITMAP</span>
          <ClubBadge height={page.bitmapHeight} />
        </div>
        <div className="mt-2 font-mono text-[11px]">{page.title || "UNTITLED BUILD"}</div>
        <div className="label mt-2 flex justify-between">
          <span>{page.buildKind.toUpperCase()}</span>
          <span className="text-primary">
            {totalViews} VIEWS · {uniqueVisitors} UNIQUE
          </span>
        </div>
        <div className="label mt-1 text-muted-foreground">
          BUILT {timeAgo(page.updatedAt ?? null)}
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Link
          to="/profile/$address"
          params={{ address: page.ownerAddress }}
          className="label hover:text-primary"
        >
          {shortenAddress(page.ownerAddress)}
        </Link>
        <FollowBuilderButton address={page.ownerAddress} followers={followers} />
      </div>
    </div>
  );
}

function BuildsPage() {
  const [tab, setTab] = useState<FeedTab>("recent");
  const { user } = useAuthSession();
  const builds = useQuery(buildsQuery(60));
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

  const entries = useMemo(() => {
    const all = builds.data ?? [];
    if (tab === "visited") {
      return [...all].sort(
        (a, b) => b.totalViews - a.totalViews || b.uniqueVisitors - a.uniqueVisitors,
      );
    }
    if (tab === "following") {
      const set = new Set(follows.data ?? []);
      return all.filter((entry) => set.has(entry.page.ownerAddress));
    }
    return [...all].sort(
      (a, b) =>
        new Date(b.page.updatedAt ?? 0).getTime() - new Date(a.page.updatedAt ?? 0).getTime(),
    );
  }, [builds.data, tab, follows.data]);

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

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">BUILDS FEED</h1>
      <p className="label mt-3">
        NEWEST BUILDS, MOST VISITED BITMAPS AND THE BUILDERS YOU FOLLOW
      </p>

      <section className="mt-10">
        <h2 className="display text-lg">BUILDERS</h2>
        <p className="label mt-2">RANKED BY REAL VISITORS ACROSS THEIR BUILDS</p>
        {topBuilders.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {topBuilders.map((builder) => (
              <div
                key={builder.address}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
              >
                <Link
                  to="/profile/$address"
                  params={{ address: builder.address }}
                  className="min-w-0"
                >
                  <div className="display text-sm">{shortenAddress(builder.address)}</div>
                  <div className="label mt-1 text-muted-foreground">
                    {builder.builds} BUILD(S) · {builder.views} VIEWS
                  </div>
                </Link>
                <FollowBuilderButton
                  address={builder.address}
                  followers={counts.data?.get(builder.address) ?? 0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6">
            <span className="label text-muted-foreground">
              {builds.isPending ? "SYNC" : "NO BUILDERS YET"}
            </span>
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`label rounded border px-3 py-1.5 transition-colors ${
                tab === entry.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {entry.label}
            </button>
          ))}
          <span className="label ml-auto text-muted-foreground">{entries.length} BUILD(S)</span>
        </div>

        {entries.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {entries.map((entry) => (
              <BuildCard
                key={entry.page.bitmapHeight}
                entry={entry}
                followers={counts.data?.get(entry.page.ownerAddress) ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6">
            <span className="label text-muted-foreground">
              {builds.isPending ? "SYNC" : emptyLabel}
            </span>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">DISTRICTS</h2>
        <p className="label mt-2">NEIGHBORHOODS ASSEMBLED FROM BITMAPS ONE HOLDER CONTROLS</p>
        {districts.data && districts.data.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                {d.description ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{d.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6">
            <span className="label text-muted-foreground">
              {districts.isPending ? "SYNC" : "NO DISTRICTS YET — CREATE ONE FROM YOUR WALLET"}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
