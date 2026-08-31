import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BlockMosaic } from "@/components/BlockMosaic";
import { ClubBadge } from "@/components/ClubBadge";
import { buildsQuery } from "@/lib/builds";
import { districtsQuery } from "@/lib/districts";
import { inscriptionImageUrl } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/builds")({
  head: () => ({
    meta: [
      { title: "Builds — Bitmaps People Have Built On" },
      {
        name: "description",
        content:
          "Discover every Bitcoin bitmap with a build on it: owner-made pages, districts and real visitor counts, ranked by traffic.",
      },
      { property: "og:title", content: "Builds — Bitmaps People Have Built On" },
      {
        property: "og:description",
        content: "Owner-built bitmap pages and districts, ranked by real visitor counts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildsPage,
});

function BuildsPage() {
  const builds = useQuery(buildsQuery(60));
  const districts = useQuery(districtsQuery(40));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">BUILDS</h1>
      <p className="label mt-3">
        BITMAPS THAT SOMEONE HAS BUILT ON — RANKED BY REAL VISITORS
      </p>

      <section className="mt-10">
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

      <section className="mt-12">
        <h2 className="display text-lg">BITMAP BUILDS</h2>
        {builds.data && builds.data.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {builds.data.map(({ page, totalViews, uniqueVisitors }) => (
              <Link
                key={page.bitmapHeight}
                to="/bitmap/$block"
                params={{ block: String(page.bitmapHeight) }}
                className="group rounded-lg border border-border bg-card p-4 transition-[border-color,transform] duration-150 hover:border-primary hover:-translate-y-0.5"
              >
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
                <div className="mt-2 font-mono text-[11px]">
                  {page.title || "UNTITLED BUILD"}
                </div>
                <div className="label mt-2 flex justify-between">
                  <span>{shortenAddress(page.ownerAddress)}</span>
                  <span className="text-primary">
                    {totalViews} VIEWS · {uniqueVisitors} UNIQUE
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6">
            <span className="label text-muted-foreground">
              {builds.isPending ? "SYNC" : "NOTHING BUILT YET — OPEN A BITMAP YOU HOLD AND BUILD ON IT"}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
