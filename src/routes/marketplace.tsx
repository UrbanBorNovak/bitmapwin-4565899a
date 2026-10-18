import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveTradesFeed } from "@/components/market/LiveTradesFeed";
import { MarketTerminal } from "@/components/market/MarketTerminal";
import { TraitMatrix } from "@/components/market/TraitMatrix";
import { useGalleryIndex } from "@/lib/use-gallery-index";
import { GALLERY_COLLECTIONS } from "@/lib/bitmap-collections";
import { useEffect, useMemo, useRef, useState } from "react";
import { BITMON_FILTER_KEY, loadBitmonFilters } from "@/lib/bitmon-filters";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ParcelCard } from "@/components/ParcelCard";

import {
  parcelOwnersQuery,
  registryBaseQuery,
  registryScopeQuery,
  fetchTradedHeights,
  registryCountQuery,
  registryIndexPageQuery,
  type RegistryParcel,
  fetchRegistryParcel,
} from "@/lib/registry";
import { formatSats } from "@/lib/trades";
import { paidSalesQuery, recentTradesQuery } from "@/lib/trade-store";
import { timeAgo } from "@/lib/bitmap";
import { useLiveOffers } from "@/lib/use-live-offers";
import { TrendingParcels } from "@/components/TrendingParcels";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { MyBitmapsPanel } from "@/components/MyBitmapsPanel";
import { BitmapOrderBook } from "@/components/BitmapOrderBook";
import { BitmapMarketChart } from "@/components/BitmapMarketChart";
import { TrendExplorer } from "@/components/TrendExplorer";
import { ALL_OFFICIAL_TRAITS, hasTrait, OFFICIAL_TRAITS, TRAIT_GROUPS, type TraitId } from "@/lib/traits";

const HEIGHT_TRAIT_IDS = new Set<string>(OFFICIAL_TRAITS.map((t) => t.id));
const matchesTrait = (h: number, t: string) => !HEIGHT_TRAIT_IDS.has(t) || hasTrait(h, t as TraitId);
import { traitHolderBadgesQuery } from "@/lib/trait-collections";

import { SalesLog } from "@/components/SalesLog";
import { TradeCrawlerStatus } from "@/components/TradeCrawlerStatus";
import { useServerFn } from "@tanstack/react-start";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";
import { liveOciStatusFn } from "@/lib/live-oci.functions";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { useVerifiedBitmons } from "@/lib/use-verified-bitmons";
import { confirmedRarity } from "@/lib/bitmon-verify";
import type { GuardianRarity, GuardianSpecies } from "@/lib/bitmon";
import { priceUnit, usePriceUnit, type PriceUnit } from "@/lib/price-unit";
import { btcPriceQuery } from "@/lib/btc-price";
import { BitmonsShelf } from "@/components/market/BitmonsShelf";
import { BitmonPatternFilter } from "@/components/market/BitmonPatternFilter";
import { patternHeightsQuery } from "@/lib/block-stats";
import { LiveMarketTicker } from "@/components/market/LiveMarketTicker";
import { FloorSweeper, ProTable } from "@/components/market/TradingDesk";
import { TradeSlip } from "@/components/market/TradeSlip";
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
  const [gallery, setGallery] = useState<string>("any");
  const galleryIndex = useGalleryIndex();
  const [bitmonPattern, setBitmonPattern] = useState<number | null>(null);
  const patternQ = useQuery(patternHeightsQuery(bitmonPattern));
  const patternSet = useMemo(() => (bitmonPattern === null ? null : new Set(patternQ.data ?? [])), [bitmonPattern, patternQ.data]);
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


  const [view, setViewState] = useState<"cards" | "table">("cards");
  const setView = (v: "cards" | "table") => { setViewState(v); try { localStorage.setItem("bitmapwin.market-view.v1", v); } catch { /* ignore */ } };
  const { unit, rate } = usePriceUnit();
  const btcPrice = useQuery(btcPriceQuery());
  useEffect(() => { priceUnit.hydrate(); try { const v = localStorage.getItem("bitmapwin.market-view.v1"); if (v === "cards" || v === "table") setViewState(v); } catch { /* ignore */ } }, []);
  useEffect(() => { priceUnit.setUsdRate(btcPrice.data?.usd ?? null); }, [btcPrice.data?.usd]);
  const [bitmonSpecies, setBitmonSpecies] = useState<GuardianSpecies | "ALL">("ALL");
  const bitmonFiltersLoaded = useRef(false);
  const [minBtc, setMinBtc] = useState("");
  const [maxBtc, setMaxBtc] = useState("");
  const [onlyInhabited, setOnlyInhabited] = useState(false);
  const [onlyBuilt, setOnlyBuilt] = useState(false);
  const [onlySold, setOnlySold] = useState(false);
  const builtWorld = useQuery(builtWorldQuery());
  const builtSet = useMemo(() => new Set((builtWorld.data?.built ?? []).map((b) => b.height)), [builtWorld.data]);
  const inhabitedSet = useMemo(() => new Set(inhabited.data?.keys() ?? []), [inhabited.data]);
  const [bitmonRarity, setBitmonRarity] = useState<GuardianRarity | "ALL">("ALL");
  const { checks: bitmonChecks } = useVerifiedBitmons();
  // Bitmon creature/rarity filters survive reloads; restoring a filter reopens the Bitmons tab so it applies.
  useEffect(() => {
    try {
      const saved = loadBitmonFilters(localStorage.getItem(BITMON_FILTER_KEY));
      if (saved.rarity !== "ALL" || saved.species !== "ALL") { setBitmonRarity(saved.rarity); setBitmonSpecies(saved.species); setTab("inhabited"); }
    } catch { /* ignore */ }
    bitmonFiltersLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!bitmonFiltersLoaded.current) return;
    try { localStorage.setItem(BITMON_FILTER_KEY, JSON.stringify({ rarity: bitmonRarity, species: bitmonSpecies })); } catch { /* ignore */ }
  }, [bitmonRarity, bitmonSpecies]);
  const speciesByHeight = useMemo(() => new Map([...bitmonChecks].map(([h, c]) => [h, c.status === "unverified" ? null : c.species])), [bitmonChecks]);
  const rarityByHeight = useMemo(() => new Map([...bitmonChecks].map(([h, c]) => [h, confirmedRarity(c)])), [bitmonChecks]);
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
  const chartScope = useMemo(() => {
    const def = club !== "any" ? CLUBS.find((c) => c.id === club) : undefined;
    const t = trait !== "any" ? ALL_OFFICIAL_TRAITS.find((x) => x.id === trait) : undefined;
    const heightTrait = t && HEIGHT_TRAIT_IDS.has(t.id) ? t : undefined;
    const gal = gallery !== "any" ? GALLERY_COLLECTIONS.find((g) => g.id === gallery) : undefined;
    const bm = tab === "inhabited";
    const bmLabel = bm ? (bitmonRarity === "ALL" ? "GUARDIANS" : `GUARDIANS ${bitmonRarity}`) : null;
    const parts = [bmLabel, def ? def.label : null, heightTrait ? `TRAIT ${heightTrait.label ?? heightTrait.id}` : null, gal ? `GALLERY ${gal.label}` : null, patternSet ? `BITMON PATTERN #${bitmonPattern}` : null].filter(Boolean);
    const match = bm || def || heightTrait || gal || patternSet ? (h: number) => (!patternSet || patternSet.has(h)) && (!bm || (inhabitedSet.has(h) && (bitmonRarity === "ALL" || rarityByHeight.get(h) === bitmonRarity))) && (!def || inClub(h, def)) && (!heightTrait || hasTrait(h, heightTrait.id as TraitId)) && (!gal || galleryIndex.match(gal.id, h)) : null;
    const galMiss = gal && gal.maxHeight === undefined ? galleryIndex.missing(gal.id) : 0;
    const galNote = gal && gal.maxHeight === undefined ? (galleryIndex.error ? `${gal.label}: BLOCK INDEX UNAVAILABLE — NOTHING CAN MATCH` : galleryIndex.loading ? `${gal.label}: READING BLOCK INDEX…` : galMiss ? `${gal.label}: ${galMiss} BITMAPS HAVE NO BLOCK RECORD AND ARE EXCLUDED` : undefined) : undefined;
    return {
      label: parts.length ? parts.join(" + ").toUpperCase() : "ALL BITMAPS",
      match,
      caveat: [t && !heightTrait ? `${String(t.label ?? t.id).toUpperCase()} NEEDS INDEXED RECORDS, SO CHARTS IGNORE IT` : null, galNote, bm && inhabited.isPending ? "GUARDIANS: READING CHAIN…" : null, bm && bitmonRarity !== "ALL" && [...inhabitedSet].some((h) => !rarityByHeight.get(h)) ? `${[...inhabitedSet].filter((h) => !rarityByHeight.get(h)).length} UNVERIFIED GUARDIANS ARE EXCLUDED FROM RARITY SCOPE` : null].filter(Boolean).join(" · ") || undefined,
    };
  }, [club, trait, gallery, galleryIndex, tab, bitmonRarity, inhabitedSet, rarityByHeight, inhabited.isPending, patternSet, bitmonPattern]);
  const visible = useMemo(() => {
    let base = tab === "traded" ? traded : tab === "listed" ? listed : parcels;
    if (tab === "inhabited") {
      base = inhabitedParcels.data ?? [];
      if (bitmonRarity !== "ALL") base = base.filter((p) => rarityByHeight.get(p.bitmapHeight) === bitmonRarity);
      if (bitmonSpecies !== "ALL") base = base.filter((p) => speciesByHeight.get(p.bitmapHeight) === bitmonSpecies);
    }
    if (club !== "any") {
      const def = CLUBS.find((c) => c.id === club);
      if (def) base = base.filter((p) => inClub(p.bitmapHeight, def));
    }
    if (trait !== "any") base = base.filter((p) => matchesTrait(p.bitmapHeight, trait));
    if (gallery !== "any") base = base.filter((p) => galleryIndex.match(gallery, p.bitmapHeight));
    if (patternSet) base = base.filter((p) => patternSet.has(p.bitmapHeight));
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
  }, [tab, traded, listed, parcels, search, club, trait, sort, inhabitedParcels.data, minSats, maxSats, onlyInhabited, onlyBuilt, onlySold, inhabitedSet, builtSet, gallery, galleryIndex, bitmonRarity, rarityByHeight, bitmonSpecies, speciesByHeight, unit, rate, patternSet]);

  // Paginate first, then resolve holders on chain for the visible page only.
  // ALL tab reads the full on-chain index page by page on the server.
  // Server paging only knows height order + trait/search; any other filter or
  // sort falls back to the fully filtered client list so cards match charts.
  const clientOnlyFilters =
    club !== "any" || gallery !== "any" || minSats !== null || maxSats !== null ||
    onlyInhabited || onlyBuilt || onlySold ||
    (sort !== "default" && sort !== "height-asc" && sort !== "height-desc");
  // A Bitmon shape group pages its own verified heights against the full index.
  const patternServer = !!patternSet && !search.trim() && trait === "any" && !clientOnlyFilters;
  const serverMode = tab === "all" && !clientOnlyFilters && (!patternSet || patternServer);
  const patternHeights = patternServer ? (patternQ.isError ? [] : patternQ.data ?? null) : null;

  // Combined filters on ALL: query the full index for the exact scope instead of the loaded subset.
  const galDef = gallery === "any" ? null : GALLERY_COLLECTIONS.find((g) => g.id === gallery) ?? null;
  const traitIsHeight = trait === "any" || HEIGHT_TRAIT_IDS.has(trait);
  const qTrim = search.trim();
  const priceBand = minSats !== null || maxSats !== null;
  const scopeUnsupported =
    (galDef !== null && galDef.maxHeight === undefined) || !traitIsHeight || (qTrim !== "" && !/^\d+$/.test(qTrim));
  const scanMode = tab === "all" && !serverMode && !scopeUnsupported && (clientOnlyFilters || !!patternSet);
  const paidSales = useQuery({ ...paidSalesQuery(), enabled: scanMode && (onlySold || priceBand || sort === "recent") });
  const tradedHeights = useQuery({ queryKey: ["registry", "traded-heights"], queryFn: fetchTradedHeights, staleTime: 120_000, enabled: scanMode && sort === "transfers" });
  const clubDef = club === "any" ? null : CLUBS.find((c) => c.id === club) ?? null;
  const scope = useMemo(() => {
    if (!scanMode) return null;
    const sets: (number[] | null)[] = [];
    let waiting = false;
    const need = (q: { data: number[] | null | undefined; isError: boolean }) => { if (q.data) sets.push(q.data); else if (q.isError) sets.push([]); else waiting = true; };
    if (patternSet) need({ data: patternQ.data, isError: patternQ.isError });
    if (onlyInhabited) { if (inhabited.data) sets.push([...inhabitedSet]); else waiting = true; }
    if (onlyBuilt) { if (builtWorld.data) sets.push([...builtSet]); else waiting = true; }
    const soldH = paidSales.data ? [...new Set(paidSales.data.map((t) => t.bitmap_height).filter((h): h is number => h !== null))] : null;
    const listedH = registry.data ? listed.map((p) => p.bitmapHeight) : null;
    if (onlySold || sort === "recent") need({ data: soldH, isError: paidSales.isError });
    if (priceBand) { if (soldH && listedH) sets.push([...soldH, ...listedH]); else if (paidSales.isError) sets.push(listedH ?? []); else waiting = true; }
    if (sort === "ask") { if (listedH) sets.push(listedH); else waiting = true; }
    if (sort === "transfers") need({ data: tradedHeights.data, isError: tradedHeights.isError });
    if (/^\d+$/.test(qTrim)) sets.push([Number(qTrim)]);
    if (waiting) return "waiting" as const;
    let heights: number[] | null = null;
    for (const s of sets) { if (heights === null) heights = s; else { const keep = new Set(s); heights = heights.filter((h: number) => keep.has(h)); } }
    const min = Math.max(clubDef?.min ?? 0, 0);
    const max = Math.min(clubDef?.max ?? Number.MAX_SAFE_INTEGER, galDef?.maxHeight ?? Number.MAX_SAFE_INTEGER);
    const buildAll = priceBand || onlySold || (sort !== "default" && sort !== "height-asc" && sort !== "height-desc");
    return { heights, min, max, buildAll };
  }, [scanMode, patternSet, patternQ.data, patternQ.isError, onlyInhabited, inhabited.data, inhabitedSet, onlyBuilt, builtWorld.data, builtSet, onlySold, sort, priceBand, paidSales.data, paidSales.isError, registry.data, listed, tradedHeights.data, tradedHeights.isError, qTrim, clubDef, galDef]);
  const scopeArgs = scope && scope !== "waiting" ? { ...scope, heightTrait: trait === "any" ? null : trait, ascending: sort === "height-asc", page, pageSize: PAGE_SIZE } : null;
  const scopeQ = useQuery({
    ...registryScopeQuery(scopeArgs ?? { heights: [], min: 0, max: 0, heightTrait: null, ascending: false, page: 0, pageSize: PAGE_SIZE, buildAll: false }),
    enabled: scopeArgs !== null,
  });
  // Built-all scopes are small; apply desk filters + sorts to the exact full set.
  const scopeVisible = useMemo(() => {
    if (!scanMode || !scopeQ.data?.all) return null;
    let base = scopeQ.data.parcels.filter(passesDesk);
    if (galDef) base = base.filter((p) => galleryIndex.match(galDef.id, p.bitmapHeight) || (galDef.maxHeight !== undefined && p.bitmapHeight <= galDef.maxHeight));
    if (sort !== "default" && sort !== "height-asc") {
      const cmp: Record<string, (a: RegistryParcel, b: RegistryParcel) => number> = {
        recent: (a, b) => (b.lastSaleBlock ?? -1) - (a.lastSaleBlock ?? -1),
        ask: (a, b) => (a.listedSats ?? Infinity) - (b.listedSats ?? Infinity),
        "height-desc": (a, b) => b.bitmapHeight - a.bitmapHeight,
        transfers: (a, b) => b.transfers - a.transfers,
      };
      base = [...base].sort(cmp[sort]);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, scopeQ.data, minSats, maxSats, onlyInhabited, onlyBuilt, onlySold, inhabitedSet, builtSet, galDef, sort]);
  const scopeTotal = scanMode ? (scopeVisible ? scopeVisible.length : scopeQ.data?.total ?? null) : null;
  const scopePending = scanMode && (scope === "waiting" || scopeQ.isPending);

  const indexPage = useQuery({
    ...registryIndexPageQuery({
      page,
      pageSize: PAGE_SIZE,
      search: qTrim,
      ascending: sort === "height-asc",
      trait: trait === "any" ? null : trait,
      heights: patternHeights,
    }),
    enabled: serverMode && (!patternServer || patternHeights !== null),
  });
  const serverTotal = serverMode ? indexPage.data?.total ?? null : scopeTotal;
  const pagedMode = serverMode || scanMode;
  const pageCount = pagedMode
    ? serverTotal !== null
      ? Math.max(1, Math.ceil(serverTotal / PAGE_SIZE))
      : page + ((serverMode ? indexPage.data?.hasMore : scopeQ.data?.hasMore) ? 2 : 1)
    : Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = pagedMode && !scopeVisible ? page : Math.min(page, pageCount - 1);
  const pageParcels = useMemo(
    () =>
      serverMode
        ? (indexPage.data?.parcels ?? []).filter((p) => (!clubDef || inClub(p.bitmapHeight, clubDef)) && passesDesk(p))
        : scanMode
          ? scopeVisible
            ? scopeVisible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
            : (scopeQ.data?.parcels ?? []).filter(passesDesk)
          : visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverMode, scanMode, scopeVisible, scopeQ.data, indexPage.data, clubDef, visible, current, minSats, maxSats, onlyInhabited, onlyBuilt, onlySold, inhabitedSet, builtSet],
  );
  const totalLabel = pagedMode
    ? serverTotal !== null
      ? serverTotal.toLocaleString("en-US")
      : serverMode && !search && trait === "any"
        ? (liveOci.data?.total ?? registryCount.data ?? 0).toLocaleString("en-US")
        : `${(page * PAGE_SIZE + pageParcels.length).toLocaleString("en-US")}${(serverMode ? indexPage.data?.hasMore : scopeQ.data?.hasMore) ? "+" : ""}`
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

  

  const listedFloor = listed.length ? Math.min(...listed.map((p) => p.listedSats ?? Infinity)) : null;
  const activeFilters = [tab === "inhabited" && bitmonRarity !== "ALL", tab === "inhabited" && bitmonSpecies !== "ALL", gallery !== "any", bitmonPattern !== null, club !== "any", trait !== "any", !!search, sort !== "default", minSats !== null || maxSats !== null, onlyInhabited, onlyBuilt, onlySold].filter(Boolean).length;
  const clearAll = () => { setBitmonPattern(null); setBitmonRarity("ALL"); setBitmonSpecies("ALL"); setGallery("any"); setClub("any"); setTrait("any"); setSearch(""); setSort("default"); setMinBtc(""); setMaxBtc(""); setOnlyInhabited(false); setOnlyBuilt(false); setOnlySold(false); setPage(0); };

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
            <p className="mt-2 max-w-xl font-mono text-[11px] text-signal">BETA TRADING DESK · TRY FLOOR SWEEP AND PRO TABLE · <Link to="/beta" className="text-bitcoin underline">WHAT'S NEW →</Link></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex" role="group" aria-label="Price unit">
              {(["btc", "sats", "usd"] as PriceUnit[]).map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} disabled={u === "usd" && !rate} onClick={() => priceUnit.set(u)}
                  title={u === "usd" ? (rate ? `LIVE RATE $${Math.round(rate).toLocaleString("en-US")} / BTC · DISPLAY ONLY` : "USD RATE UNAVAILABLE") : "DISPLAY ONLY · TRADES SETTLE IN SATS"}
                  className={`h-11 border px-3 font-mono text-[11px] disabled:opacity-40 ${unit === u ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:text-signal"}`}>
                  {u.toUpperCase()}
                </button>
              ))}
            </span>
            <a href="#sell-bitmap" className="btn-term min-h-11">◆ SELL YOUR BITMAP</a>
            <Link
              to="/bot"
              search={{
                maxSats: maxSats ?? undefined,
                minHeight: /^\d+$/.test(qTrim) ? Number(qTrim) : clubDef?.min ?? undefined,
                maxHeight: /^\d+$/.test(qTrim)
                  ? Number(qTrim)
                  : (() => {
                      const m = Math.min(clubDef?.max ?? Infinity, galDef?.maxHeight ?? Infinity);
                      return Number.isFinite(m) ? m : undefined;
                    })(),
              }}
              className="btn-term-ghost min-h-11"
            >
              ◉ WATCH LISTINGS
            </Link>
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
        <BitmonsShelf rarity={bitmonRarity} onRarity={setBitmonRarity} species={bitmonSpecies} onReset={() => { setBitmonRarity("ALL"); setBitmonSpecies("ALL"); setPage(0); }} onSpecies={(sp) => { setBitmonSpecies(sp); setPage(0); }} onOpen={() => { setTab("inhabited"); setPage(0); }} />
      </div>
      <div className="mt-4">
        <BitmonPatternFilter pattern={bitmonPattern} onPattern={(p) => { setBitmonPattern(p); setPage(0); }} count={patternQ.data?.length ?? null} loading={patternQ.isPending && bitmonPattern !== null} error={patternQ.isError} tooCommon={patternQ.error?.message.startsWith("PATTERN_TOO_COMMON:") ? Number(patternQ.error.message.split(":")[1]) : null} />
      </div>

      <div className="mt-4">
        <TraitMatrix
          activeKey={tab === "inhabited" && gallery === "any" && club === "any" && trait === "any" ? "bitmons" : gallery !== "any" ? `gallery:${gallery}` : club !== "any" && trait === "any" ? `club:${club}` : club === "any" && trait !== "any" && HEIGHT_TRAIT_IDS.has(trait) ? `trait:${trait}` : null}
          scoped={tab === "inhabited" || club !== "any" || trait !== "any" || gallery !== "any"}
          onPick={(seg) => {
            setPage(0); setClub("any"); setTrait("any"); setGallery("any");
            if (!seg) { setBitmonRarity("ALL"); if (tab === "inhabited") setTab("all"); return; }
            if (seg.id === "bitmons") setBitmonRarity("ALL");
            if (seg.id === "bitmons") { setTab("inhabited"); return; }
            if (seg.kind === "club") setClub(seg.id as ClubId); else if (seg.kind === "gallery") setGallery(seg.id); else setTrait(seg.id);
          }}
        />
      </div>

      <div className="mt-4">
        <MarketTerminal scope={chartScope} />
      </div>
      <TradeSlip />

      <div className="mt-4">
        <LiveTradesFeed scope={chartScope} />
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
              ["inhabited", "GUARDIANS", inhabited.data?.size ?? 0],
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
            {tab === "inhabited" && bitmonRarity !== "ALL" && <Chip label={`GUARDIANS ${bitmonRarity}`} onClear={() => setBitmonRarity("ALL")} />}
            {tab === "inhabited" && bitmonSpecies !== "ALL" && <Chip label={bitmonSpecies} onClear={() => setBitmonSpecies("ALL")} />}
            {bitmonPattern !== null && <Chip label={`BITMON PATTERN #${bitmonPattern}`} onClear={() => setBitmonPattern(null)} />}
            {club !== "any" && <Chip label={CLUBS.find((c) => c.id === club)?.short ?? club} onClear={() => setClub("any")} />}
            {gallery !== "any" && <Chip label={GALLERY_COLLECTIONS.find((g) => g.id === gallery)?.short ?? gallery} onClear={() => setGallery("any")} />}
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
                  <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
                    <TraitRow active={trait === "any"} label="ALL" count={serverMode ? null : parcels.length} onClick={() => { setTrait("any"); setPage(0); }} />
                    {TRAIT_GROUPS.map((group) => {
                      const items = traitList.filter((item) => item.group === group.id);
                      if (items.length === 0) return null;
                      return (
                        <div key={group.id}>
                          <p className="label text-foreground">{group.label}</p>
                          <p className="mb-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{group.description}</p>
                          <div className="grid gap-1">
                            {items.map((item) => {
                              const count = serverMode ? null : traitCounts.get(item.id as TraitId) ?? 0;
                              const fl = traitFloors.get(item.id);
                              const label = fl ? `${item.label} · FLOOR ${formatSats(fl.floor)} (${fl.count})` : item.label;
                              return (
                                <TraitRow key={item.id} active={trait === item.id} label={label} count={count} title={`${item.sourceKey} — ${item.description}`} disabled={count === 0 && trait !== item.id} onClick={() => { setTrait(item.id); setPage(0); }} />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {trait !== "any" && ALL_OFFICIAL_TRAITS.find((t) => t.id === trait) && (
                    <p className="mt-2 border-l-2 border-bitcoin pl-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {ALL_OFFICIAL_TRAITS.find((t) => t.id === trait)!.description}
                    </p>
                  )}
                  {trait !== "any" && (
                    <Link to="/traits/$trait" params={{ trait }} className="label mt-2 inline-block text-bitcoin hover:text-foreground">
                      FULL {ALL_OFFICIAL_TRAITS.find((t) => t.id === trait)?.label} INDEX →
                    </Link>
                  )}
                </div>
                <div>
                  <span className="label mb-2 block">PRICE (BTC · ASK OR LAST SALE)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input inputMode="decimal" value={minBtc} onChange={(e) => { setMinBtc(e.target.value); setPage(0); }} placeholder="MIN" aria-label="Minimum price in BTC"
                      className="h-9 w-full border border-input bg-card px-2 font-mono text-xs text-foreground outline-none focus:border-signal" />
                    <input inputMode="decimal" value={maxBtc} onChange={(e) => { setMaxBtc(e.target.value); setPage(0); }} placeholder="MAX" aria-label="Maximum price in BTC"
                      className="h-9 w-full border border-input bg-card px-2 font-mono text-xs text-foreground outline-none focus:border-signal" />
                  </div>
                </div>
                <div>
                  <span className="label mb-2 block">QUICK FILTERS</span>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterPill active={onlyInhabited} onClick={() => { setOnlyInhabited((v) => !v); setPage(0); }}>GUARDIAN</FilterPill>
                    <FilterPill active={onlyBuilt} onClick={() => { setOnlyBuilt((v) => !v); setPage(0); }}>BUILT</FilterPill>
                    <FilterPill active={onlySold} onClick={() => { setOnlySold((v) => !v); setPage(0); }}>HAS SALE</FilterPill>
                  </div>
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
          {tab === "listed" && <FloorSweeper listed={visible} />}
          {(serverMode ? indexPage.isPending : scanMode ? scopePending : registry.isPending) ? (
            <p className="grid min-h-48 place-items-center border border-dashed border-border font-mono text-sm text-muted-foreground">
              READING THE REGISTRY FROM CHAIN…
            </p>
          ) : scanMode && scopeQ.isError ? (
            <p className="grid min-h-48 place-items-center border border-dashed border-destructive/60 p-6 text-center font-mono text-sm text-muted-foreground">
              INDEX QUERY FAILED — NO TOTAL SHOWN. TRY SYNC OR ADJUST FILTERS.
            </p>
          ) : (pagedMode ? pageParcels.length === 0 : visible.length === 0) ? (
            clientOnlyFilters || patternSet || trait !== "any" || search.trim() || tab !== "all" ? (
              <div className="border border-dashed border-border p-8 font-mono text-sm" role="status">
                <p className="text-[11px] text-muted-foreground">0 BITMAPS MATCH · PAGE 1 / 1</p>
                <p className="mt-2 text-foreground">NO BITMAPS MATCH THIS SCOPE: <span data-no-translate>{chartScope.label}</span></p>
                <p className="mt-2 text-[11px] text-muted-foreground">CHECKED AGAINST THE FULL INDEX — LOOSEN A FILTER TO SEE RESULTS.</p>
              </div>
            ) : (
              <EmptyRegistry />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="label text-muted-foreground" data-no-translate>
                  {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + pageParcels.length} OF {totalLabel} BITMAPS
                </span>
                <span className="flex items-center gap-3">
                  <span className="label text-muted-foreground">
                    {owners.isFetching || (serverMode && indexPage.isFetching) || (scanMode && scopeQ.isFetching) ? <span className="text-signal">RESOLVING HOLDERS ON CHAIN…</span> : pagedMode && serverTotal === null ? `PAGE ${current + 1}` : `PAGE ${current + 1} / ${pageCount.toLocaleString("en-US")}`}
                  </span>
                  <span className="flex" role="group" aria-label="View mode">
                    {(["cards", "table"] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                        className={`h-7 border px-2 font-mono text-[10px] ${view === v ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:text-signal"}`}>
                        {v === "cards" ? "CARDS" : "PRO TABLE"}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
              {view === "table" ? (
                <ProTable parcels={pageWithOwners} inhabited={inhabitedSet} built={builtSet} bitmons={bitmonChecks} floorSats={listedFloor} />
              ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pageWithOwners.map((p) => (
                  <ParcelCard
                    key={p.inscriptionId}
                    parcel={p}
                    floorSats={listedFloor}
                    {...(p.ownerAddress && traitHolders.data?.get(p.ownerAddress.toLowerCase())
                      ? { traitHolder: traitHolders.data.get(p.ownerAddress.toLowerCase())! }
                      : {})}
                  />
                ))}
              </div>
              )}
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
