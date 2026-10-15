import { createFileRoute, Link } from "@tanstack/react-router";
import { OtherthingsHierarchy } from "@/components/OtherthingsHierarchy";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlockMosaic } from "@/components/BlockMosaic";
import { CLUBS, clubOf, clubSupply, formatRange } from "@/lib/clubs";
import { GALLERY_COLLECTIONS, type GalleryCollection } from "@/lib/bitmap-collections";
import { usePunkFilter } from "@/lib/punk-filter";
import { ordContentUrl } from "@/lib/oci";
import { registryBaseQuery } from "@/lib/registry";
import { formatSats } from "@/lib/trades";

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title: "Bitmap Collections — Clubs, Punks & Patterns" },
      {
        name: "description",
        content:
          "Browse Bitmap clubs and inscribed punk collections: SUB 1K to SUB 1M clubs plus pristine, standard, wide neck and perfect punks, with real indexed counts, floors and on-chain volume.",
      },
      { property: "og:title", content: "Bitmap Collections — Clubs, Punks & Patterns" },
      {
        property: "og:description",
        content:
          "Bitmap clubs by block height and the inscribed punk collections decided by fixed on-chain facts: transaction count and render shape.",
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
  const registryHeights = useMemo(() => parcels.map((p) => p.bitmapHeight), [parcels]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">BITMAP COLLECTIONS</h1>
      <p className="label mt-3">
        EVERY BITMAP BELONGS TO EXACTLY ONE CLUB, DECIDED BY ITS BLOCK HEIGHT
      </p>

      <div className="mt-8"><OtherthingsHierarchy /></div>
      <Link
        to="/collections/jigglypuff"
        className="mt-8 flex items-baseline justify-between border border-border bg-card/60 p-4 backdrop-blur hover:border-primary"
      >
        <span className="display text-xl">JIGGLYPUFF</span>
        <span className="label text-muted-foreground">218 INSCRIPTIONS · VALUE, SALES & TRADING →</span>
      </Link>
      <Link
        to="/collections/guardians"
        className="mt-3 flex items-baseline justify-between border border-bitcoin/70 bg-card/60 p-4 backdrop-blur hover:border-primary"
      >
        <span className="display text-xl">BLOCK-DNA GUARDIANS</span>
        <span className="label text-muted-foreground">V6 COLLECTION · BUY, SELL, PRICE CHART & HOW-TO →</span>
      </Link>
      <Link
        to="/guardians"
        className="mt-3 flex items-baseline justify-between border border-signal/60 bg-card/60 p-4 backdrop-blur hover:border-primary"
      >
        <span className="display text-xl">GUARDIANS DROP</span>
        <span className="label text-muted-foreground">MINT ANNOUNCEMENT · SUPPLY · SPECS →</span>
      </Link>
      <Link to="/traits" className="mt-3 flex items-baseline justify-between border border-bitcoin/70 bg-card/60 p-4 backdrop-blur hover:border-primary">
        <span className="display text-xl">OFFICIAL TRAITS</span>
        <span className="label text-muted-foreground">COMPLETE GLOSSARY · INDEXED INSCRIPTIONS · HOLDER STATUS →</span>
      </Link>
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
                {club.future ? (
                  <div className="flex aspect-square items-center justify-center border border-dashed border-border">
                    <span className="label text-muted-foreground">NOT MINED YET</span>
                  </div>
                ) : (
                  <BlockMosaic height={club.min} />
                )}
                <div className="label mt-2">
                  {club.future
                    ? "NO SAMPLE AVAILABLE"
                    : `SAMPLE ${club.min.toLocaleString("en-US")}.BITMAP`}
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

      <div className="mt-16">
        <h2 className="display text-2xl md:text-4xl">PUNKS &amp; PATTERNS</h2>
        <p className="label mt-3">
          INSCRIBED COLLECTIONS DECIDED BY FIXED ON-CHAIN FACTS — TRANSACTION COUNT AND RENDER SHAPE
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {GALLERY_COLLECTIONS.map((collection) => (
            <PunkCard
              key={collection.id}
              collection={collection}
              heights={registryHeights}
              pending={registry.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PunkCard({
  collection,
  heights,
  pending,
}: {
  collection: GalleryCollection;
  heights: number[];
  pending: boolean;
}) {
  const punk = usePunkFilter(heights, collection.id);
  const matches = useMemo(
    () => heights.filter((h) => punk.matches(h)),
    [heights, punk],
  );

  return (
    <a
      href={`https://ordinals.com/inscription/${collection.coverInscription}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${collection.label} — view the inscribed gallery on chain`}
      className="group rounded-lg border border-border bg-card p-5 transition-[border-color,transform] duration-150 hover:border-primary hover:-translate-y-0.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="display text-lg">{collection.label}</h3>
        <span className="label">PATTERN</span>
      </div>

      <div className="mt-4 border border-border p-3">
        <div className="flex aspect-square items-center justify-center overflow-hidden">
          <img
            src={ordContentUrl(collection.coverInscription)}
            alt={`${collection.label} cover inscription`}
            loading="lazy"
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        </div>
        <div className="label mt-2">INSCRIBED GALLERY COVER</div>
      </div>

      <p className="mt-4 font-mono text-[11px] text-muted-foreground">{collection.blurb}</p>

      <dl className="mt-4 space-y-1 text-[11px]">
        <Row
          k="MATCHES IN INDEX"
          v={
            pending || punk.loading
              ? "…"
              : matches.length.toLocaleString("en-US")
          }
        />
        {punk.skipped > 0 ? (
          <Row k="SHAPE LOOKUPS SKIPPED" v={String(punk.skipped)} />
        ) : null}
      </dl>

      <span className="btn-term-ghost mt-4 inline-block !px-2 !py-2">
        VIEW ON-CHAIN GALLERY →
      </span>
    </a>
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
