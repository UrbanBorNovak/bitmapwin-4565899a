import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";
import { CLUBS, clubById, clubSupply, formatRange, inClub } from "@/lib/clubs";
import { parcelOwnersQuery, registryBaseQuery, type RegistryParcel } from "@/lib/registry";
import { formatSats } from "@/lib/trades";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/collections/$club")({
  loader: ({ params }) => {
    const club = clubById(params.club);
    if (!club) throw notFound();
    return { club };
  },
  head: ({ loaderData }) => {
    const club = loaderData?.club;
    const title = club ? `${club.label} — Bitmap Collection` : "Bitmap Collection";
    const description = club
      ? `${club.label}: bitmaps for blocks ${formatRange(club)}, ${clubSupply(club).toLocaleString("en-US")} max supply, with on-chain owners, listings and sales.`
      : "Bitmap collection grouped by block height.";
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
  component: ClubPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
      <h1 className="display text-3xl">UNKNOWN CLUB</h1>
      <Link to="/collections" className="btn-term mt-6 inline-block">
        [ ALL COLLECTIONS ]
      </Link>
    </div>
  ),
});

type Tab = "all" | "listed" | "traded";

function ClubPage() {
  const { club } = Route.useLoaderData();
  const registry = useQuery(registryBaseQuery(300));
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);

  const members = useMemo(
    () =>
      (registry.data ?? [])
        .filter((p) => inClub(p.bitmapHeight, club))
        .sort((a, b) => a.bitmapHeight - b.bitmapHeight),
    [registry.data, club],
  );

  const listed = members.filter((p) => p.listedSats !== null);
  const traded = members.filter((p) => p.transfers > 0);
  const sales = members.map((p) => p.lastSaleSats ?? 0).filter((v) => v > 0);
  const floor = listed.length ? Math.min(...listed.map((p) => p.listedSats as number)) : null;
  const volume = sales.reduce((a, b) => a + b, 0);
  const holders = new Set(members.map((p) => p.ownerAddress).filter(Boolean)).size;

  const visible = tab === "listed" ? listed : tab === "traded" ? traded : members;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageParcels = visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const owners = useQuery({
    ...parcelOwnersQuery(pageParcels.map((p) => p.txid)),
    enabled: pageParcels.length > 0,
  });

  const withOwners: RegistryParcel[] = pageParcels.map((parcel) => {
    const owner = owners.data?.get(parcel.txid);
    if (!owner) return parcel;
    return {
      ...parcel,
      ownerAddress: parcel.ownerAddress ?? owner.address,
      transfers: parcel.transfers || owner.transfers,
    };
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">{club.label}</h1>
      <p className="label mt-3">
        BLOCKS {formatRange(club)} · {club.blurb.toUpperCase()}
      </p>

      <div className="mt-8 grid grid-cols-2 divide-border border border-border sm:grid-cols-5 sm:divide-x">
        <Stat k="MAX SUPPLY" v={clubSupply(club).toLocaleString("en-US")} />
        <Stat k="INDEXED CLAIMS" v={registry.isPending ? "…" : String(members.length)} />
        <Stat k="LISTED" v={String(listed.length)} />
        <Stat k="FLOOR" v={floor ? formatSats(floor) : "—"} />
        <Stat k="SALE VOLUME" v={volume ? formatSats(volume) : "—"} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "listed", "traded"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "btn-term" : "btn-term-ghost"}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
          >
            [ {t.toUpperCase()} ]
          </button>
        ))}
        <span className="label">HOLDERS {holders}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {CLUBS.filter((c) => c.id !== club.id).map((c) => (
            <Link
              key={c.id}
              to="/collections/$club"
              params={{ club: c.id }}
              className="btn-term-ghost"
            >
              [ {c.short} ]
            </Link>
          ))}
        </div>
      </div>

      {registry.isPending ? (
        <p className="mt-10 border border-border p-10 font-mono text-sm text-muted-foreground">
          &gt; READING THE REGISTRY FROM CHAIN<span className="blink">_</span>
        </p>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border p-10">
          <h2 className="display text-2xl">NO INDEXED BITMAPS IN THIS CLUB YET</h2>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            &gt; SYNC MORE BLOCKS FROM /MARKETPLACE OR BROWSE THE RANGE ON /EXPLORE
          </p>
          <Link to="/marketplace" className="btn-term mt-6 inline-block">
            [ GO TO MARKETPLACE ]
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3 border border-border p-4">
            <span className="label">
              SHOWING {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + pageParcels.length} OF{" "}
              {visible.length} BITMAP(S)
            </span>
            <span className="label">
              PAGE {current + 1} / {pageCount}
            </span>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {withOwners.map((p) => (
              <ParcelCard key={p.inscriptionId} parcel={p} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                className="btn-term-ghost"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                [ PREV ]
              </button>
              <button
                className="btn-term-ghost"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                [ NEXT ]
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-4">
      <div className="label">{k}</div>
      <div className="display mt-1 text-sm">{v}</div>
    </div>
  );
}
