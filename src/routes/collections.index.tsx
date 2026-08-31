import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BlockMosaic } from "@/components/BlockMosaic";
import { CLUBS, clubOf, clubSupply, formatRange } from "@/lib/clubs";
import { registryBaseQuery } from "@/lib/registry";
import { formatSats } from "@/lib/trades";

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title: "Bitmap Collections — Clubs by Block Height" },
      {
        name: "description",
        content:
          "Browse Bitmap clubs as collections: SUB 1K, SUB 10K, SUB 100K and SUB 1M, each with fixed supply, indexed count, floor and volume from real Bitcoin transactions.",
      },
      { property: "og:title", content: "Bitmap Collections — Clubs by Block Height" },
      {
        property: "og:description",
        content:
          "Bitmap clubs grouped by block height range, with fixed supply, indexed claims, floor price and on-chain sale volume.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionsIndex,
});

function CollectionsIndex() {
  const registry = useQuery(registryBaseQuery(300));
  const parcels = registry.data ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">COLLECTIONS</h1>
      <p className="label mt-3">
        EVERY BITMAP BELONGS TO EXACTLY ONE CLUB, DECIDED BY ITS BLOCK HEIGHT
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {CLUBS.map((club) => {
          const members = parcels.filter((p) => clubOf(p.bitmapHeight).id === club.id);
          const listed = members.filter((p) => p.listedSats !== null);
          const sales = members.map((p) => p.lastSaleSats ?? 0).filter((v) => v > 0);
          const floor = listed.length
            ? Math.min(...listed.map((p) => p.listedSats as number))
            : null;
          const volume = sales.reduce((a, b) => a + b, 0);

          return (
            <Link
              key={club.id}
              to="/collections/$club"
              params={{ club: club.id }}
              className="group rounded-lg border border-border bg-card p-5 transition-[border-color,transform] duration-150 hover:border-primary hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="display text-lg">{club.label}</h2>
                <span className="label">{formatRange(club)}</span>
              </div>

              <div className="mt-4 border border-border p-3">
                <BlockMosaic height={club.min} />
                <div className="label mt-2">
                  SAMPLE {club.min.toLocaleString("en-US")}.BITMAP
                </div>
              </div>

              <p className="mt-4 font-mono text-[11px] text-muted-foreground">{club.blurb}</p>

              <dl className="mt-4 space-y-1 text-[11px]">
                <Row k="MAX SUPPLY" v={clubSupply(club).toLocaleString("en-US")} />
                <Row
                  k="INDEXED CLAIMS"
                  v={registry.isPending ? "…" : members.length.toLocaleString("en-US")}
                />
                <Row k="LISTED" v={registry.isPending ? "…" : String(listed.length)} />
                <Row k="FLOOR" v={floor ? formatSats(floor) : "—"} />
                <Row k="SALE VOLUME" v={volume ? formatSats(volume) : "—"} />
              </dl>

              <span className="btn-term-ghost mt-4 inline-block !px-2 !py-2">
                BROWSE {club.short} →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label">{k}</dt>
      <dd className="truncate font-mono text-foreground">{v}</dd>
    </div>
  );
}
