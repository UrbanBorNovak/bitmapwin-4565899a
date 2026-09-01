import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";

import { parcelOwnersQuery, registryBaseQuery, type RegistryParcel } from "@/lib/registry";
import { formatSats } from "@/lib/trades";
import { useLiveOffers } from "@/lib/use-live-offers";
import { TrendingParcels } from "@/components/TrendingParcels";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";


export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — On-Chain Bitmap Trades" },
      {
        name: "description",
        content:
          "Bitmap parcels priced by real Bitcoin transactions: every sale, buyer and holder traced from the chain.",
      },
      { property: "og:title", content: "Marketplace — On-Chain Bitmap Trades" },
      {
        property: "og:description",
        content:
          "Bitmap parcels priced by real Bitcoin transactions: every sale, buyer and holder traced from the chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">MARKET FEED UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <EmptyRegistry />,
});

type Tab = "traded" | "listed" | "all";

const PAGE_SIZE = 24;

function Marketplace() {
  const registry = useQuery(registryBaseQuery(300));
  const parcels = registry.data ?? [];
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState<ClubId | "any">("any");
  const [page, setPage] = useState(0);
  useLiveOffers();

  const listed = useMemo(() => parcels.filter((p) => p.listedSats !== null), [parcels]);
  const traded = useMemo(() => parcels.filter((p) => p.transfers > 0), [parcels]);
  const sold = useMemo(() => parcels.filter((p) => p.lastSaleSats), [parcels]);
  const visible = useMemo(() => {
    let base = tab === "traded" ? traded : tab === "listed" ? listed : parcels;
    if (club !== "any") {
      const def = CLUBS.find((c) => c.id === club);
      if (def) base = base.filter((p) => inClub(p.bitmapHeight, def));
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        String(p.bitmapHeight).includes(q) ||
        p.inscriptionId.toLowerCase().includes(q) ||
        p.txid.toLowerCase().includes(q) ||
        (p.ownerAddress ?? "").toLowerCase().includes(q),
    );
  }, [tab, traded, listed, parcels, search, club]);

  // Paginate first, then resolve holders on chain for the visible page only.
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageParcels = useMemo(
    () => visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    [visible, current],
  );
  const owners = useQuery({
    ...parcelOwnersQuery(pageParcels.map((p) => p.txid)),
    enabled: pageParcels.length > 0,
  });
  const pageWithOwners = useMemo(
    () =>
      pageParcels.map((parcel) => {
        const owner = owners.data?.get(parcel.txid);
        if (!owner) return parcel;
        return {
          ...parcel,
          ownerAddress: parcel.ownerAddress ?? owner.address,
          transfers: parcel.transfers || owner.transfers,
        } satisfies RegistryParcel;
      }),
    [pageParcels, owners.data],
  );

  const saleSats = sold.map((p) => p.lastSaleSats ?? 0).filter((v) => v > 0);
  const floor = saleSats.length ? Math.min(...saleSats) : null;
  const volume = saleSats.reduce((a, b) => a + b, 0);
  const holders = new Set(parcels.map((p) => p.ownerAddress).filter(Boolean)).size;

  

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">MARKETPLACE</h1>
      <p className="label mt-3">PRICES AND STATUS TRACED FROM REAL BITCOIN TRANSACTIONS</p>

      <div className="mt-8 grid grid-cols-2 divide-border border border-border sm:grid-cols-5 sm:divide-x">
        <Stat k="REGISTERED BITMAPS" v={String(parcels.length)} />
        <Stat k="TRADED ON CHAIN" v={String(traded.length)} />
        <Stat
          k="LISTED"
          v={
            listed.length === 0
              ? "0"
              : `${listed.length} · ${formatSats(Math.min(...listed.map((p) => p.listedSats ?? 0)))}`
          }
        />
        <Stat k="LOWEST SALE" v={floor ? formatSats(floor) : "—"} />
        <Stat k="SALE VOLUME" v={volume ? formatSats(volume) : "—"} />
      </div>

      <TrendingParcels limit={3} />



      <div className="mt-6 flex flex-wrap items-center gap-2 border border-border p-3">
        <span className="label">COLLECTION</span>
        <button
          className={club === "any" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setClub("any");
            setPage(0);
          }}
        >
          [ ALL CLUBS ]
        </button>
        {CLUBS.map((c) => (
          <button
            key={c.id}
            className={club === c.id ? "btn-term" : "btn-term-ghost"}
            onClick={() => {
              setClub(c.id);
              setPage(0);
            }}
          >
            [ {c.short} ]
          </button>
        ))}
        <Link to="/collections" className="label ml-auto hover:text-foreground">
          COLLECTION STATS →
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          className={tab === "all" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setTab("all");
            setPage(0);
          }}
        >
          [ ALL BITMAPS ]
        </button>
        <button
          className={tab === "traded" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setTab("traded");
            setPage(0);
          }}
        >
          [ TRADED ]
        </button>
        <button
          className={tab === "listed" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setTab("listed");
            setPage(0);
          }}
        >
          [ LISTED ]
        </button>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="SEARCH HEIGHT / OWNER / TXID"
          className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <span className="label">HOLDERS {holders}</span>
      </div>

      {registry.isPending ? (
        <p className="mt-10 border border-border p-10 font-mono text-sm text-muted-foreground">
          &gt; READING THE REGISTRY FROM CHAIN<span className="blink">_</span>
        </p>
      ) : visible.length === 0 ? (
        <EmptyRegistry />
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3 border border-border p-4">
            <span className="label">
              SHOWING {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + pageParcels.length} OF{" "}
              {visible.length} BITMAP(S)
            </span>
            <span className="label">
              {owners.isFetching ? (
                <>
                  RESOLVING HOLDERS ON CHAIN<span className="blink">_</span>
                </>
              ) : (
                `PAGE ${current + 1} / ${pageCount}`
              )}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageWithOwners.map((p) => (
              <ParcelCard key={p.inscriptionId} parcel={p} />
            ))}
          </div>

          <Pager page={current} pageCount={pageCount} onPage={setPage} />
        </>
      )}

    </div>
  );
}

/** Terminal-style pager: windowed page numbers plus prev/next. */
function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const start = Math.max(0, Math.min(page - 2, pageCount - 5));
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i).filter(
    (n) => n < pageCount,
  );
  return (
    <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label="Parcel pages">
      <button className="btn-term-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        [ PREV ]
      </button>
      {start > 0 && <span className="label">…</span>}
      {numbers.map((n) => (
        <button
          key={n}
          className={n === page ? "btn-term" : "btn-term-ghost"}
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
        >
          {String(n + 1).padStart(2, "0")}
        </button>
      ))}
      {start + numbers.length < pageCount && <span className="label">…</span>}
      <button
        className="btn-term-ghost"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        [ NEXT ]
      </button>
    </nav>
  );
}


function EmptyRegistry() {
  return (
    <div className="mt-10 border border-border p-10">
      <h2 className="display text-2xl">NO BITMAPS IN THE REGISTRY YET</h2>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; CHECK BACK SOON — BITMAPS ARE INDEXED FROM REAL BITCOIN BLOCKS
        <span className="blink">_</span>
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/collections" className="btn-term">
          [ BROWSE COLLECTIONS ]
        </Link>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-6">
      <div className="label">{k}</div>
      <div className="display mt-2 text-2xl">{v}</div>
    </div>
  );
}
