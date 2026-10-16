import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ParcelCard } from "@/components/ParcelCard";

import {
  parcelOwnersQuery,
  registryBaseQuery,
  registryCountQuery,
  registryIndexPageQuery,
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
import { ALL_OFFICIAL_TRAITS, hasTrait, OFFICIAL_TRAITS, type TraitId } from "@/lib/traits";

const HEIGHT_TRAIT_IDS = new Set<string>(OFFICIAL_TRAITS.map((t) => t.id));
const matchesTrait = (h: number, t: string) => !HEIGHT_TRAIT_IDS.has(t) || hasTrait(h, t as TraitId);
import { traitHolderBadgesQuery } from "@/lib/trait-collections";

import { SalesLog } from "@/components/SalesLog";
import { TradeCrawlerStatus } from "@/components/TradeCrawlerStatus";
import { useServerFn } from "@tanstack/react-start";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";
import { liveOciStatusFn } from "@/lib/live-oci.functions";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { LiveMarketTicker } from "@/components/market/LiveMarketTicker";
import { FloorSweeper, ProTable } from "@/components/market/TradingDesk";
import { builtWorldQuery } from "@/lib/built-bitmaps";
import { btcInputToSats, floorsBy, inPriceBand } from "@/lib/market-sweep";

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
  const [trait, setTrait] = useState<string>("any");
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


  const [view, setView] = useState<"cards" | "table">("cards");
  const [minBtc, setMinBtc] = useState("");
  const [maxBtc, setMaxBtc] = useState("");
  const [onlyInhabited, setOnlyInhabited] = useState(false);
  const [onlyBuilt, setOnlyBuilt] = useState(false);
  const [onlySold, setOnlySold] = useState(false);
  const builtWorld = useQuery(builtWorldQuery());
  const builtSet = useMemo(() => new Set((builtWorld.data?.built ?? []).map((b) => b.height)), [builtWorld.data]);
  const inhabitedSet = useMemo(() => new Set(inhabited.data?.keys() ?? []), [inhabited.data]);
  const minSats = btcInputToSats(minBtc);
  const maxSats = btcInputToSats(maxBtc);
  const passesDesk = (p: RegistryParcel) =>
    inPriceBand(p.listedSats ?? p.lastSaleSats ?? null, minSats, maxSats) &&
    (!onlyInhabited || inhabitedSet.has(p.bitmapHeight)) &&
    (!onlyBuilt || builtSet.has(p.bitmapHeight)) &&
    (!onlySold || !!p.lastSaleSats);

  const listed = useMemo(() => parcels.filter((p) => p.listedSats !== null), [parcels]);
  const traded = useMemo(() => parcels.filter((p) => p.transfers > 0), [parcels]);
  const sold = useMemo(() => parcels.filter((p) => p.lastSaleSats), [parcels]);
  const traitFloors = useMemo(
    () => floorsBy(listed, (p) => OFFICIAL_TRAITS.filter((t) => hasTrait(p.bitmapHeight, t.id)).map((t) => t.id)),
    [listed],
  );
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
    if (trait !== "any") base = base.filter((p) => matchesTrait(p.bitmapHeight, trait));
    base = base.filter(passesDesk);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, traded, listed, parcels, search, club, trait, sort, inhabitedParcels.data, minSats, maxSats, onlyInhabited, onlyBuilt, onlySold, inhabitedSet, builtSet]);

  // Paginate first, then resolve holders on chain for the visible page only.
  // ALL tab reads the full on-chain index page by page on the server.
  const serverMode = tab === "all";
  const indexPage = useQuery({
    ...registryIndexPageQuery({
      page,
      pageSize: PAGE_SIZE,
      search: search.trim(),
      ascending: sort === "height-asc",
      trait: trait === "any" ? null : trait,
    }),
    enabled: serverMode,
  });
  const serverTotal = indexPage.data?.total ?? null;
  const pageCount = serverMode
    ? serverTotal !== null
      ? Math.max(1, Math.ceil(serverTotal / PAGE_SIZE))
      : page + (indexPage.data?.hasMore ? 2 : 1)
    : Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = serverMode ? page : Math.min(page, pageCount - 1);
  const clubDef = club === "any" ? null : CLUBS.find((c) => c.id === club) ?? null;
  const pageParcels = useMemo(
    () =>
      serverMode
        ? (indexPage.data?.parcels ?? []).filter((p) => (!clubDef || inClub(p.bitmapHeight, clubDef)) && passesDesk(p))
        : visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverMode, indexPage.data, clubDef, visible, current, minSats, maxSats, onlyInhabited, onlyBuilt, onlySold, inhabitedSet, builtSet],
  );
  const totalLabel = serverMode
    ? serverTotal !== null
      ? serverTotal.toLocaleString("en-US")
      : !search && trait === "any"
        ? (liveOci.data?.total ?? registryCount.data ?? 0).toLocaleString("en-US")
        : `${(page * PAGE_SIZE + pageParcels.length).toLocaleString("en-US")}${indexPage.data?.hasMore ? "+" : ""}`
    : visible.length.toLocaleString("en-US");
  const traitList = serverMode ? ALL_OFFICIAL_TRAITS.filter((t) => t.supported) : OFFICIAL_TRAITS;
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

  

  const activeFilters = [club !== "any", trait !== "any", !!search, sort !== "default"].filter(Boolean).length;
  const clearAll = () => { setClub("any"); setTrait("any"); setSearch(""); setSort("default"); setPage(0); };

  return (
    <div className="marketplace-shell mx-auto max-w-[1600px] px-3 py-6 sm:px-5 md:py-10">
      <header data-tour="market-header" className="border border-border bg-card/60 p-5 backdrop-blur-md sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="label text-bitcoin">TRADE · BITCOIN LAND</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-signal">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-signal" />
                </span>
                LIVE SYNC
              </span>
            </div>
            <h1 className="display mt-2 text-4xl sm:text-5xl">BITMAP MARKET</h1>
            <p className="mt-2 max-w-xl font-mono text-xs leading-6 text-muted-foreground">BUY, BID, LIST AND TRACK BITMAPS THROUGH VERIFIED BITCOIN TRANSACTIONS.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#sell-bitmap" className="btn-term min-h-11">◆ SELL YOUR BITMAP</a>
            <Link to="/history" className="btn-term-ghost min-h-11">SALES HISTORY →</Link>
            <Link to="/leases" className="btn-term-ghost min-h-11">LEASES →</Link>
          </div>
        </div>

        <dl data-tour="market-stats" className="mt-5 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-card p-3 md:p-4">
            <dt className="label">REGISTERED</dt>
            <dd className="mt-1 font-mono text-base font-bold text-signal md:text-lg" data-no-translate>
              {liveOci.data
                ? liveOci.data.total.toLocaleString("en-US")
                : registryCount.data !== undefined
                  ? registryCount.data.toLocaleString("en-US")
                  : "…"}
            </dd>
            {liveOci.data?.tip ? (
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" data-no-translate>TIP #{liveOci.data.tip.toLocaleString("en-US")}</p>
            ) : null}
          </div>
          <Stat k="TRADED ON CHAIN" v={crawl.data ? crawl.data.tradedBitmaps.toLocaleString("en-US") : traded.length.toLocaleString("en-US")} tone="signal" />
          <Stat k="LISTED" v={listed.length === 0 ? "0" : `${listed.length} · ${formatSats(Math.min(...listed.map((p) => p.listedSats ?? 0)))}`} tone="bitcoin" />
          <Stat k="LOWEST SALE" v={floor ? formatSats(floor) : "—"} tone="bitcoin" />
          <Stat k="SALE VOLUME" v={volume ? formatSats(volume) : "—"} tone="bitcoin" />
          <div className="bg-card p-3 md:p-4">
            <dt className="label text-signal">LAST TRADED</dt>
            {lastTrade ? (
              <a href={`https://mempool.space/tx/${lastTrade.txid}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-base font-bold text-foreground hover:text-signal md:text-lg" data-no-translate>
                {formatSats(lastTrade.price_sats)}
                <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                  {lastTrade.bitmap_height}.BITMAP
                  {lastTrade.block_time ?? lastTrade.created_at ? ` · ${timeAgo(lastTrade.block_time ?? lastTrade.created_at)}` : ""}
                </span>
              </a>
            ) : (
              <dd className="mt-1 font-mono text-base text-muted-foreground">{recent.isPending ? "…" : "—"}</dd>
            )}
          </div>
        </dl>
      </header>

      <div className="mt-4">
        <LiveMarketTicker trades={recent.data ?? []} inhabited={inhabited.data} syncedAt={crawl.dataUpdatedAt} />
      </div>

      <div className="mt-4">
        <MyBitmapsPanel />
      </div>

      {/* Sticky control bar */}
      <div className="sticky top-16 z-20 mt-4 border border-border bg-background/90 p-2 backdrop-blur-md">
        <div className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Market status">
            {([
              ["all", "ALL INDEXED", liveOci.data?.total ?? registryCount.data ?? parcels.length],
              ["listed", "LISTED", listed.length],
              ["inhabited", "INHABITED", inhabited.data?.size ?? 0],
              ["traded", "TRADED", traded.length],
            ] as const).map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setPage(0); }}
                className={`flex h-9 items-center gap-2 border px-3 font-mono text-[11px] transition-colors ${tab === id ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-transparent text-muted-foreground hover:border-signal hover:text-signal"}`}>
                {label}<span className="opacity-70" data-no-translate>{n}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="bitmap-market-search"
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="SEARCH ALL BITMAPS: HEIGHT, INSCRIPTION ID OR OWNER"
              aria-label="Search BITMAPs"
              className="h-9 w-full border border-input bg-card pl-10 pr-3 font-mono text-xs uppercase text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
            />
          </div>
          <label className="flex items-center gap-2">
            <span className="label">SORT</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}
              aria-label="Sort BITMAPs"
              className="h-9 border border-input bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-signal"
            >
              {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>
        {activeFilters > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {club !== "any" && <Chip label={CLUBS.find((c) => c.id === club)?.short ?? club} onClear={() => setClub("any")} />}
            {trait !== "any" && <Chip label={ALL_OFFICIAL_TRAITS.find((t) => t.id === trait)?.label ?? trait} onClear={() => setTrait("any")} />}
            {search && <Chip label={`"${search}"`} onClear={() => setSearch("")} />}
            {sort !== "default" && <Chip label={SORTS.find((o) => o.id === sort)!.label} onClear={() => setSort("default")} />}
            {activeFilters > 1 && (
              <button type="button" className="font-mono text-[10px] text-muted-foreground underline hover:text-bitcoin" onClick={clearAll}>CLEAR ALL</button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div data-tour="market-filters" className="border border-border bg-card/60 backdrop-blur-md lg:sticky lg:top-36">
            <details className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between border-b border-border p-4">
                <span className="label text-foreground">FILTERS</span>
                <span className="label text-muted-foreground group-open:rotate-180" aria-hidden>▾</span>
              </summary>
              <div className="space-y-5 p-4">
                <div>
                  <span className="label mb-2 block">COLLECTION</span>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterPill active={club === "any"} onClick={() => { setClub("any"); setPage(0); }}>ALL CLUBS</FilterPill>
                    {CLUBS.map((c) => (
                      <FilterPill key={c.id} active={club === c.id} label={`Filter by collection ${c.label}`} onClick={() => { setClub(c.id); setPage(0); }}>{c.short}</FilterPill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="label text-bitcoin">OFFICIAL TRAITS</span>
                    <Link to="/traits" className="label hover:text-bitcoin">INDEX →</Link>
                  </div>
                  <div className="grid max-h-72 gap-1 overflow-y-auto pr-1">
                    <TraitRow active={trait === "any"} label="ALL" count={serverMode ? null : parcels.length} onClick={() => { setTrait("any"); setPage(0); }} />
                    {traitList.map((item) => {
                      const count = serverMode ? null : traitCounts.get(item.id as TraitId) ?? 0;
                      return (
                        <TraitRow key={item.id} active={trait === item.id} label={item.label} count={count} title={`${item.sourceKey} — ${item.description}`} disabled={count === 0 && trait !== item.id} onClick={() => { setTrait(item.id); setPage(0); }} />
                      );
                    })}
                  </div>
                  {trait !== "any" && (
                    <Link to="/traits/$trait" params={{ trait }} className="label mt-2 inline-block text-bitcoin hover:text-foreground">
                      FULL {ALL_OFFICIAL_TRAITS.find((t) => t.id === trait)?.label} INDEX →
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                  <Link to="/collections" className="label hover:text-bitcoin">COLLECTION STATS →</Link>
                  <a href="https://docs.bitmap.community/bitmap.community/trait-definitions" target="_blank" rel="noreferrer" className="label hover:text-bitcoin">TRAIT SOURCE ↗</a>
                </div>
                <div className="label text-muted-foreground" data-no-translate>{holders} HOLDERS IN LOADED INDEX</div>
              </div>
            </details>
          </div>
        </aside>

        <section data-tour="market-grid" className="lg:col-span-9">
          {(serverMode ? indexPage.isPending : registry.isPending) ? (
            <p className="grid min-h-48 place-items-center border border-dashed border-border font-mono text-sm text-muted-foreground">
              READING THE REGISTRY FROM CHAIN…
            </p>
          ) : (serverMode ? pageParcels.length === 0 : visible.length === 0) ? (
            <EmptyRegistry />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="label text-muted-foreground" data-no-translate>
                  {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + pageParcels.length} OF {totalLabel} BITMAPS
                </span>
                <span className="label text-muted-foreground">
                  {owners.isFetching || (serverMode && indexPage.isFetching) ? <span className="text-signal">RESOLVING HOLDERS ON CHAIN…</span> : serverMode && serverTotal === null ? `PAGE ${current + 1}` : `PAGE ${current + 1} / ${pageCount.toLocaleString("en-US")}`}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      <section className="mt-8 border border-border bg-card/60 backdrop-blur-md" aria-labelledby="market-live-panel">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 id="market-live-panel" className="display text-xl">LIVE MARKET</h2>
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

      <section className="mt-6 space-y-6 border border-border bg-card/60 p-4 backdrop-blur-md md:p-5" aria-label="Order book and trends">
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
    <div className="border border-dashed border-border p-10">
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

function Stat({ k, v, tone }: { k: string; v: string; tone: "bitcoin" | "signal" }) {
  return (
    <div className="bg-card p-3 md:p-4">
      <dt className="label">{k}</dt>
      <dd className={`mt-1 font-mono text-base font-bold md:text-lg ${tone === "bitcoin" ? "text-bitcoin" : "text-signal"}`} data-no-translate>{v}</dd>
    </div>
  );
}

function FilterPill({ active, label, onClick, children }: { active: boolean; label?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} aria-label={label} onClick={onClick}
      className={`border px-2.5 py-1 font-mono text-[10px] transition-colors ${active ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`}>
      {children}
    </button>
  );
}

function TraitRow({ active, label, count, title, disabled, onClick }: { active: boolean; label: string; count: number | null; title?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} title={title} disabled={disabled} onClick={onClick}
      className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors disabled:opacity-40 ${active ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-transparent text-muted-foreground hover:border-signal hover:text-signal"}`}>
      <span className="truncate">{label}</span>
      {count !== null && <span className="opacity-70" data-no-translate>{count}</span>}
    </button>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="flex items-center gap-1.5 border border-signal/50 bg-signal/10 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/20" aria-label={`Clear ${label}`}>
      {label} <span aria-hidden>✕</span>
    </button>
  );
}
