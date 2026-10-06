import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";

import {
  parcelOwnersQuery,
  registryBaseQuery,
  registryCountQuery,
  type RegistryParcel,
  fetchRegistryParcel,
} from "@/lib/registry";
import { formatSats } from "@/lib/trades";
import { recentTradesQuery } from "@/lib/trade-store";
import { timeAgo } from "@/lib/bitmap";
import { useLiveOffers } from "@/lib/use-live-offers";
import { TrendingParcels } from "@/components/TrendingParcels";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { MyBitmapsPanel } from "@/components/MyBitmapsPanel";
import { BitmapOrderBook } from "@/components/BitmapOrderBook";
import { BitmapMarketChart } from "@/components/BitmapMarketChart";
import { TrendExplorer } from "@/components/TrendExplorer";
import { hasTrait, OFFICIAL_TRAITS, type TraitId } from "@/lib/traits";
import { traitHolderBadgesQuery } from "@/lib/trait-collections";

import { SalesLog } from "@/components/SalesLog";
import { TradeCrawlerStatus } from "@/components/TradeCrawlerStatus";
import { useServerFn } from "@tanstack/react-start";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";
import { liveOciStatusFn } from "@/lib/live-oci.functions";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { LiveMarketTicker } from "@/components/market/LiveMarketTicker";

type Sort = "default" | "recent" | "ask" | "height-asc" | "height-desc" | "transfers";
const SORTS: { id: Sort; label: string }[] = [
  { id: "default", label: "DEFAULT" },
  { id: "recent", label: "RECENT SALES" },
  { id: "ask", label: "LOWEST ASK" },
  { id: "height-asc", label: "OLDEST BLOCK" },
  { id: "height-desc", label: "NEWEST BLOCK" },
  { id: "transfers", label: "MOST TRADED" },
];




export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — On-Chain Bitmap Trades" },
      {
        name: "description",
        content:
          "Trade Bitcoin Bitmaps with real on-chain prices, bids, asks, collections and confirmed sale history.",
      },
      { property: "og:title", content: "Marketplace — On-Chain Bitmap Trades" },
      {
        property: "og:description",
        content:
          "Trade Bitcoin Bitmaps with real on-chain prices, bids, asks, collections and confirmed sale history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">MARKET FEED UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => <EmptyRegistry />,
});

type Tab = "traded" | "listed" | "all" | "inhabited";

const PAGE_SIZE = 24;

function Marketplace() {
  const registry = useQuery(registryBaseQuery(300));
  const parcels = registry.data ?? [];
  const registryCount = useQuery(registryCountQuery());
  const progressFn = useServerFn(tradeCrawlProgressFn);
  const liveOciFn = useServerFn(liveOciStatusFn);
  const liveOci = useQuery({
    queryKey: ["live-oci", "status"],
    queryFn: () => liveOciFn(),
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  // Real registry-wide numbers from the crawler, not just the loaded page.
  const crawl = useQuery({
    queryKey: ["trade-crawl", "progress"],
    queryFn: () => progressFn(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState<ClubId | "any">("any");
  const [trait, setTrait] = useState<TraitId | "any">("any");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<Sort>("default");
  const recent = useQuery({ ...recentTradesQuery(40), refetchInterval: 30_000 });
  const lastTrade = (recent.data ?? []).find((t) => t.price_sats > 0) ?? null;
  useLiveOffers();
  const inhabited = useQuery(inhabitedQuery());
  // Every inhabited BITMAP, fetched directly — not limited to the loaded page.
  const inhabitedHeights = useMemo(() => [...(inhabited.data?.keys() ?? [])].sort((a, b) => a - b), [inhabited.data]);
  const inhabitedParcels = useQuery({
    queryKey: ["registry", "inhabited", inhabitedHeights],
    enabled: tab === "inhabited" && inhabitedHeights.length > 0,
    queryFn: async () => (await Promise.all(inhabitedHeights.map((h) => fetchRegistryParcel(h).catch(() => null)))).filter((p): p is RegistryParcel => p !== null),
    staleTime: 60_000,
  });


  const listed = useMemo(() => parcels.filter((p) => p.listedSats !== null), [parcels]);
  const traded = useMemo(() => parcels.filter((p) => p.transfers > 0), [parcels]);
  const sold = useMemo(() => parcels.filter((p) => p.lastSaleSats), [parcels]);
  const traitCounts = useMemo(() => {
    const base = tab === "traded" ? traded : tab === "listed" ? listed : parcels;
    return new Map(OFFICIAL_TRAITS.map((t) => [t.id, base.filter((p) => hasTrait(p.bitmapHeight, t.id)).length]));
  }, [tab, traded, listed, parcels]);
  const visible = useMemo(() => {
    let base = tab === "traded" ? traded : tab === "listed" ? listed : parcels;
    if (tab === "inhabited") base = inhabitedParcels.data ?? [];
    if (club !== "any") {
      const def = CLUBS.find((c) => c.id === club);
      if (def) base = base.filter((p) => inClub(p.bitmapHeight, def));
    }
    if (trait !== "any") base = base.filter((p) => hasTrait(p.bitmapHeight, trait));
    if (sort !== "default") {
      const cmp: Record<Exclude<Sort, "default">, (a: RegistryParcel, b: RegistryParcel) => number> = {
        recent: (a, b) => (b.lastSaleBlock ?? -1) - (a.lastSaleBlock ?? -1),
        ask: (a, b) => (a.listedSats ?? Infinity) - (b.listedSats ?? Infinity),
        "height-asc": (a, b) => a.bitmapHeight - b.bitmapHeight,
        "height-desc": (a, b) => b.bitmapHeight - a.bitmapHeight,
        transfers: (a, b) => b.transfers - a.transfers,
      };
      base = [...base].sort(cmp[sort]);
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
  }, [tab, traded, listed, parcels, search, club, trait, sort, inhabitedParcels.data]);

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
  const traitHolders = useQuery(traitHolderBadgesQuery(pageWithOwners.map((parcel) => parcel.ownerAddress ?? "")));

  const saleSats = sold.map((p) => p.lastSaleSats ?? 0).filter((v) => v > 0);
  const floor = saleSats.length ? Math.min(...saleSats) : null;
  const volume = saleSats.reduce((a, b) => a + b, 0);
  const holders = new Set(parcels.map((p) => p.ownerAddress).filter(Boolean)).size;

  

  return (
    <div className="marketplace-shell mx-auto max-w-[1600px] px-4 py-8 md:px-8 md:py-12">
      <div>
        <header data-tour="market-header" className="flex flex-col justify-between gap-5 border-b border-border pb-7">
          <div className="border-l-2 border-primary pl-4">
            <span className="label text-primary">LIVE BITCOIN LAND MARKET</span>
            <h1 className="mt-2 font-mono text-3xl font-bold uppercase text-foreground md:text-5xl">BITMAP MARKETPLACE</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Buy, bid, list and track Bitmaps through verified Bitcoin transactions.</p>
            <a href="#sell-bitmap" className="btn-term mt-4 inline-flex">◆ SELL YOUR BITMAP</a>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-signal" />
            </span>
            <span className="text-signal">LIVE SYNC</span> · ON-CHAIN MARKET DATA · REFRESHES EVERY 15S
          </div>
        </header>

      </div>

      <LiveMarketTicker trades={recent.data ?? []} inhabited={inhabited.data} syncedAt={crawl.dataUpdatedAt} />

      <div data-tour="market-stats" className="mt-6 grid grid-cols-2 divide-border border border-border bg-card sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
        <div className="p-4">
          <p className="label">REGISTERED BITMAPS</p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground" data-no-translate>
            {liveOci.data
              ? liveOci.data.total.toLocaleString("en-US")
              : registryCount.data !== undefined
                ? registryCount.data.toLocaleString("en-US")
                : "…"}
          </p>
          {liveOci.data && (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" data-no-translate>
              OCI {liveOci.data.ociCount.toLocaleString("en-US")} + LIVEOCI {liveOci.data.liveCount.toLocaleString("en-US")}
              {liveOci.data.tip ? ` · TIP #${liveOci.data.tip.toLocaleString("en-US")}` : ""}
            </p>
          )}
        </div>
        <Stat
          k="TRADED ON CHAIN"
          v={
            crawl.data
              ? crawl.data.tradedBitmaps.toLocaleString("en-US")
              : traded.length.toLocaleString("en-US")
          }
        />
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
        <div className="border-t border-border p-4 sm:border-t-0">
          <p className="label text-signal">LAST TRADED</p>
          {lastTrade ? (
            <a
              href={`https://mempool.space/tx/${lastTrade.txid}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-mono text-sm font-bold text-foreground hover:text-signal"
              data-no-translate
            >
              {formatSats(lastTrade.price_sats)}
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                {lastTrade.bitmap_height}.BITMAP{lastTrade.block_height ? ` · #${lastTrade.block_height}` : ""}
                {lastTrade.block_time ?? lastTrade.created_at ? ` · ${timeAgo(lastTrade.block_time ?? lastTrade.created_at)}` : ""}
              </span>
            </a>
          ) : (
            <p className="mt-1 font-mono text-sm text-muted-foreground">{recent.isPending ? "…" : "—"}</p>
          )}
        </div>
      </div>

      <section className="mt-6 border border-border bg-card" aria-labelledby="market-live-panel">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 id="market-live-panel" className="font-mono text-sm font-bold text-foreground">LIVE MARKET</h2>
            <p className="label mt-1">PRICE CHART · CONFIRMED SALES · CRAWLER</p>
          </div>
          <span className="flex items-center gap-2 font-mono text-[10px] text-signal">
            <span className="size-2 animate-pulse rounded-full bg-signal" aria-hidden /> LIVE
          </span>
        </div>
        <div className="grid gap-6 p-4 md:p-5 xl:grid-cols-12">
          <div className="xl:col-span-8"><BitmapMarketChart /></div>
          <div className="space-y-6 xl:col-span-4 [&>section]:mt-0">
            <TradeCrawlerStatus />
            <TrendingParcels limit={3} />
            <SalesLog limit={12} />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div data-tour="market-filters" className="border border-border bg-card lg:sticky lg:top-24">
            <div className="border-b border-border p-4">
              <h2 className="border-l-2 border-primary pl-3 font-mono text-sm font-bold text-foreground">FIND BITMAPS</h2>
              <p className="label mt-2 pl-[14px]">FILTER THE REGISTRY</p>
            </div>
            <div className="space-y-5 p-4">
              <div>
                <label className="label mb-2 block" htmlFor="bitmap-market-search">SEARCH</label>
                <input
                  id="bitmap-market-search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="HEIGHT / OWNER / TXID"
                  className="w-full border border-border bg-background px-3 py-2.5 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <span className="label mb-2 block">MARKET STATUS</span>
                <div className="grid grid-cols-1 gap-2">
                  {(["all", "listed", "traded", "inhabited"] as const).map((value) => (
                    <button key={value} className={tab === value ? "btn-term justify-start" : "btn-term-ghost justify-start"} onClick={() => { setTab(value); setPage(0); }}>
                      {value === "all" ? "ALL BITMAPS" : value === "inhabited" ? `INHABITED${inhabited.data ? ` · ${inhabited.data.size}` : ""}` : value.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label mb-2 block">SORT</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SORTS.map((o) => (
                    <button key={o.id} type="button" aria-pressed={sort === o.id} className={`${sort === o.id ? "btn-term" : "btn-term-ghost"} !px-2`} onClick={() => { setSort(o.id); setPage(0); }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label mb-2 block">COLLECTION</span>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
                  <button
                    aria-pressed={club === "any"}
                    className={club === "any" ? "btn-term !px-2" : "btn-term-ghost !px-2"}
                    onClick={() => {
                      setClub("any");
                      setPage(0);
                    }}
                  >
                    ALL CLUBS
                  </button>
                  {CLUBS.map((c) => (
                    <button
                      key={c.id}
                      aria-label={`Filter by collection ${c.label}`}
                      aria-pressed={club === c.id}
                      className={club === c.id ? "btn-term !px-2" : "btn-term-ghost !px-2"}
                      onClick={() => {
                        setClub(c.id);
                        setPage(0);
                      }}
                    >
                      {c.short}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="label text-bitcoin">OFFICIAL TRAIT INDEX</span>
                  <Link to="/traits" className="label hover:text-bitcoin">ALL →</Link>
                </div>
                <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-1 lg:grid-cols-1 xl:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={trait === "any"}
                    className={trait === "any" ? "btn-term !px-2 justify-between" : "btn-term-ghost !px-2 justify-between"}
                    onClick={() => { setTrait("any"); setPage(0); }}
                  >
                    ALL <span className="opacity-70">{parcels.length}</span>
                  </button>
                  {OFFICIAL_TRAITS.map((item) => {
                    const count = traitCounts.get(item.id) ?? 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={`${item.sourceKey} — ${item.description}`}
                        aria-pressed={trait === item.id}
                        disabled={count === 0 && trait !== item.id}
                        className={`${trait === item.id ? "btn-term" : "btn-term-ghost"} !px-2 justify-between disabled:opacity-40`}
                        onClick={() => { setTrait(item.id); setPage(0); }}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
                {trait !== "any" && (
                  <Link to="/traits/$trait" params={{ trait }} className="label mt-2 inline-block text-bitcoin hover:text-foreground">
                    FULL {OFFICIAL_TRAITS.find((t) => t.id === trait)?.label} INDEX →
                  </Link>
                )}
              </div>
              <details className="border-t border-border pt-4">
                <summary className="label cursor-pointer text-bitcoin">TRAIT GLOSSARY</summary>
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-2">
                  {OFFICIAL_TRAITS.map((item) => (
                    <div key={item.id}>
                      <div className="font-mono text-[10px] text-foreground">{item.label}</div>
                      <div className="mt-0.5 font-mono text-[9px] leading-relaxed text-muted-foreground">{item.description}</div>
                    </div>
                  ))}
                </div>
                <a
                  href="https://docs.bitmap.community/bitmap.community/trait-definitions"
                  target="_blank"
                  rel="noreferrer"
                  className="label mt-4 inline-block text-bitcoin hover:text-foreground"
                >
                  SOURCE: BITMAP.COMMUNITY ↗
                </a>
                <Link to="/traits" className="label ml-3 inline-block text-bitcoin hover:text-foreground">FULL INDEX →</Link>
              </details>
              <Link to="/collections" className="btn-term-ghost w-full">PUNKS &amp; COLLECTION STATS →</Link>
              <div className="border-t border-border pt-4 label">{holders} HOLDERS IN LOADED INDEX</div>
            </div>
          </div>
        </aside>

        <section data-tour="market-grid" className="lg:col-span-9">

      <div className="mb-6">
        <MyBitmapsPanel />
      </div>


      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          ["all", "ALL", parcels.length],
          ["listed", "⚡ LISTED NOW", listed.length],
          ["inhabited", "◆ INHABITED", inhabited.data?.size ?? 0],
          ["traded", "▲ TRADED", traded.length],
        ] as const).map(([id, label, n]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setPage(0); }}
            className={`flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] transition-colors ${tab === id ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`}>
            {label}<span className="opacity-70" data-no-translate>{n}</span>
          </button>
        ))}
        {(club !== "any" || trait !== "any" || search || sort !== "default") && (
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        )}
        {club !== "any" && <Chip label={CLUBS.find((c) => c.id === club)?.short ?? club} onClear={() => setClub("any")} />}
        {trait !== "any" && <Chip label={OFFICIAL_TRAITS.find((t) => t.id === trait)?.label ?? trait} onClear={() => setTrait("any")} />}
        {search && <Chip label={`"${search}"`} onClear={() => setSearch("")} />}
        {sort !== "default" && <Chip label={SORTS.find((o) => o.id === sort)!.label} onClear={() => setSort("default")} />}
        {[club !== "any", trait !== "any", !!search, sort !== "default"].filter(Boolean).length > 1 && (
          <button type="button" className="font-mono text-[10px] text-muted-foreground underline hover:text-bitcoin"
            onClick={() => { setClub("any"); setTrait("any"); setSearch(""); setSort("default"); setPage(0); }}>
            CLEAR ALL
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Sort BITMAPs">
        <span className="label mr-1">SORT</span>
        {SORTS.map((o) => (
          <button key={o.id} type="button" aria-pressed={sort === o.id} onClick={() => { setSort(o.id); setPage(0); }}
            className={`border px-2.5 py-1 font-mono text-[10px] transition-colors ${sort === o.id ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`}>
            {o.label}
          </button>
        ))}
      </div>

      {registry.isPending ? (
        <p className="mt-10 border border-border p-10 font-mono text-sm text-muted-foreground">
          &gt; READING THE REGISTRY FROM CHAIN<span className="blink">_</span>
        </p>
      ) : visible.length === 0 ? (
        <EmptyRegistry />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border border-border bg-card p-4">
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

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageWithOwners.map((p) => (
              <ParcelCard
                key={p.inscriptionId}
                parcel={p}
                {...(p.ownerAddress && traitHolders.data?.get(p.ownerAddress.toLowerCase())
                  ? { traitHolder: traitHolders.data.get(p.ownerAddress.toLowerCase())! }
                  : {})}
              />
            ))}
          </div>

          <Pager page={current} pageCount={pageCount} onPage={setPage} />
        </>
      )}
        </section>
      </div>

      <section className="mt-10 space-y-6 border border-border bg-card p-4 md:p-5" aria-label="Order book and trends">
        <TrendExplorer parcels={parcels} />
        <BitmapOrderBook />
      </section>
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
    <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label="Marketplace pages">
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
    <div className="p-4 md:p-5">
      <div className="label">{k}</div>
      <div className="mt-2 font-mono text-lg font-bold text-foreground md:text-xl">{v}</div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="flex items-center gap-1.5 border border-signal/50 bg-signal/10 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/20" aria-label={`Clear ${label}`}>
      {label} <span aria-hidden>✕</span>
    </button>
  );
}
