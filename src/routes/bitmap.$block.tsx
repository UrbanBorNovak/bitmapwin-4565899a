import { Activity, ArrowLeft, ArrowLeftRight, Database, Fingerprint, Globe, MapPin, ScrollText, ShieldCheck, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getBlockInscriptions } from "@/lib/ordinals-scan.functions";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { MAX_BITMAP } from "@/lib/oci";
import { atlasPlace, districtBlockRange } from "@/lib/atlas-places";
import { getAtlasRegionStats } from "@/lib/atlas-land.functions";
import { TraitBadges } from "@/components/TraitBadges";
import { ClubBadge } from "@/components/ClubBadge";
import { ForgeBadge } from "@/components/ForgeBadge";
import { StasisPods } from "@/components/StasisPods";
import { GalleryBadges } from "@/components/GalleryBadges";
import { SatBadges } from "@/components/SatBadges";
import { toast } from "sonner";
import { BlockMosaic } from "@/components/BlockMosaic";

import { blockSizeMapQuery, blockRenderSidesQuery } from "@/lib/block-bytes";
import { blockStatsQuery, patternSiblingsQuery } from "@/lib/block-stats";


import { BidPanel } from "@/components/BidPanel";
import { BitmapChat } from "@/components/BitmapChat";
import { BitmapPriceChart } from "@/components/BitmapPriceChart";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { BssScriptPanel } from "@/components/BssScriptPanel";
import { WatchBitmapButton } from "@/components/WatchBitmapButton";
import { BitmapValuation } from "@/components/BitmapValuation";
import { BitmapDevelopment } from "@/components/BitmapDevelopment";
import { ParcelPagePanel } from "@/components/ParcelPagePanel";
import { ParcelPanel } from "@/components/ParcelPanel";
import { DistrictReinscriptions } from "@/components/DistrictReinscriptions";
import { LeasePanel } from "@/components/leases/LeasePanel";
import { BitmapEvents } from "@/components/coins/BitmapEvents";
import { MakeOfferButton } from "@/components/MakeOfferButton";
import { BuyButton } from "@/components/BuyButton";
import { BitmapOrderBook } from "@/components/BitmapOrderBook";
import { BitmapStorefront } from "@/components/BitmapStorefront";
import { TerritoryKiosk } from "@/components/territory/TerritoryKiosk";
import { TerritoryDispatches } from "@/components/territory/TerritoryDispatches";
import { BitmapStreamPlayer } from "@/components/territory/BitmapStreamPlayer";
import { GuardianMintStatus } from "@/components/bitmon/GuardianMintStatus";
import { StreamChat } from "@/components/territory/StreamChat";
import { ClientOnly } from "@tanstack/react-router";
import { TerritoryPanel } from "@/components/extenders/TerritoryPanel";
import { getBitmapHolderFn } from "@/lib/locate-bitmap.functions";
import { LoopNavigator } from "@/components/LoopNavigator";
import { TerritoryShareCard } from "@/components/TerritoryShareCard";
import { SummonGuardianButton } from "@/components/bitmon/SummonGuardianDialog";
import { TerritoryChronicle } from "@/components/TerritoryChronicle";
import { ShadowGatePanel } from "@/components/territory/ShadowGatePanel";
import { Button } from "@/components/ui/button";

import { provenanceStreamQuery } from "@/lib/provenance-stream";

import { InscriptionContent } from "@/components/InscriptionContent";
import { shortId } from "@/lib/chain";
import { registryParcelQuery, shortenAddress, PARCEL_STATUS_LABEL } from "@/lib/registry";

import { tradesForHeightQuery } from "@/lib/trade-store";
import { traceBitmapTradesFn } from "@/lib/trades.functions";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";


const blockScanQuery = (height: number) =>
  queryOptions({
    queryKey: ["block-scan", height],
    queryFn: () => getBlockInscriptions({ data: { height, txPages: 6 } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

const ociQuery = (height: number) =>
  queryOptions({
    queryKey: ["oci-entry", height],
    queryFn: () => getBitmapRegistryEntry({ data: { height } }),
    enabled: height >= 0 && height <= MAX_BITMAP,
    staleTime: 30 * 60_000,
    retry: 1,
  });

const liveHolderQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap-live-holder", height],
    queryFn: () => getBitmapHolderFn({ data: { height } }),
    staleTime: 60_000,
    retry: 1,
  });

export const Route = createFileRoute("/bitmap/$block")({
  loader: async ({ context, params }) => {
    const block = Number(params.block);
    if (!Number.isFinite(block) || block < 0) throw notFound();
    await context.queryClient.ensureQueryData(registryParcelQuery(block));
    return { block };
  },
  head: ({ params }) => {
    const title = `Bitmap #${params.block} — Bitcoin Digital Land`;
    const description = `Ownership, status and price data for Bitmap #${params.block} on the Bitcoin land layer.`;
    const url = `https://bitmapwin.app/bitmap/${params.block}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "player" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:player", content: `https://bitmapwin.app/embed/bitmap/${params.block}` },
        { name: "twitter:player:width", content: "1280" },
        { name: "twitter:player:height", content: "720" },
        { property: "og:image", content: `https://bitmapwin.app/api/public/og/bitmap/${params.block}.png` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:image", content: `https://bitmapwin.app/api/public/og/bitmap/${params.block}.png` },
      ],
    };
  },
  component: BitmapDetail,
  notFoundComponent: BitmapMissing,
  errorComponent: ({ error, reset }) => <ParcelError error={error as Error} reset={reset} />,
});

function ParcelError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">BITMAP DATA UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
      <button
        type="button"
        className="btn-term mt-8"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        [ RETRY ]
      </button>
    </div>
  );
}

function BitmapDetail() {
  const { block } = Route.useLoaderData();
  const { data: parcel } = useSuspenseQuery(registryParcelQuery(block));
  const scan = useQuery(blockScanQuery(block));
  const sizeMap = useQuery(blockSizeMapQuery(block));
  const stats = useQuery(blockStatsQuery(block));
  const siblings = useQuery(patternSiblingsQuery(stats.data?.pattern));
  // Two-transaction blocks: fetch the real render sides so the punk badges
  // can tell pristine / standard / wide neck apart by shape.
  const punkSides = useQuery({
    ...blockRenderSidesQuery(block),
    enabled: (stats.data?.txCount ?? scan.data?.txCount ?? null) === 2,
  });

  const oci = useQuery(ociQuery(block));
  const liveHolder = useQuery(liveHolderQuery(block));
  const trades = useQuery(tradesForHeightQuery(block));
  const localHistory = useQuery(provenanceStreamQuery("all", 12, undefined, block));
  const queryClient = useQueryClient();
  const tab = useBitmapTab();
  const selectTab = (id: TabId) => {
    history_replace(id);
  };
  const moveTab = (current: TabId, direction: -1 | 1) => {
    const currentIndex = TABS.findIndex((item) => item.id === current);
    const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (!next) return;
    selectTab(next.id);
    document.getElementById(`bitmap-tab-${next.id}`)?.focus();
  };

  const place = atlasPlace(block);
  const regionStats = useQuery({
    queryKey: ["atlas-region-stats", place.slug],
    queryFn: () => getAtlasRegionStats({ data: districtBlockRange(place) }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const claims = (scan.data?.inscriptions ?? []).filter((i) => i.isBitmapClaim);
  const history = [...(trades.data ?? [])].sort((a, b) => b.hop - a.hop);
  const lastSale = history.find((t) => t.price_sats > 0) ?? null;
  const owner = liveHolder.data?.ownerAddress ?? parcel?.ownerAddress ?? history[0]?.buyer_address ?? oci.data?.ownerAddress ?? null;

  const tradedVolume = history.reduce((sum, t) => sum + (t.price_sats > 0 ? t.price_sats : 0), 0);
  const distinctTraders = new Set(history.flatMap((t) => [t.seller_address, t.buyer_address])).size;
  const txCount = stats.data?.txCount ?? scan.data?.txCount ?? null;
  const region = regionStats.data ?? null;
  const regionHeld = region ? Math.max(0, region.indexed - region.unowned) : 0;
  const inscriptionId = parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null;
  const status = parcel
    ? PARCEL_STATUS_LABEL[lastSale ? "sold" : parcel.status]
    : PARCEL_STATUS_LABEL.unclaimed;
  const headlinePrice = parcel?.listedSats
    ? formatSats(parcel.listedSats)
    : lastSale
      ? formatSats(lastSale.price_sats)
      : "NOT LISTED";

  const trace = useMutation({
    mutationFn: async () => {
      const txid = parcel?.txid ?? oci.data?.inscriptionId?.slice(0, 64) ?? null;
      if (!txid) throw new Error("NO CLAIM TRANSACTION KNOWN FOR THIS BITMAP");
      const result = await traceBitmapTradesFn({
        data: {
          claims: [
            { bitmapHeight: block, txid, inscriptionId: parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null },
          ],
          maxHops: 8,
        },
      });
      return result.stored;
    },
    onSuccess: (stored) => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["registry"] });
      toast(`${block}.BITMAP`, { description: `${stored} ON-CHAIN TRANSFER(S) INDEXED` });
    },
    onError: (e) => toast("TRADE TRACE FAILED", { description: (e as Error).message }),
  });



  return (
    <div className="land-terminal mx-auto min-h-screen max-w-[1400px] px-3 py-5 md:px-6 md:py-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Link to="/marketplace" className="label inline-flex items-center gap-1.5 hover:text-foreground"><ArrowLeft className="size-3.5" /> MARKETPLACE</Link>
        <Link to="/map/place/$block" params={{ block: String(block) }} className="label text-bitcoin hover:text-foreground">
          <MapPin className="mr-1 inline size-3.5 align-[-2px]" />{place.localName} · {place.name}
        </Link>
      </div>

      <header className="border border-border">
        <div className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col justify-between border-b border-border p-5 md:p-10 lg:col-span-8 lg:border-b-0 lg:border-r">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="h-2 w-2 bg-signal motion-safe:animate-pulse" aria-hidden="true" />
                <span className="label inline-flex items-center gap-1.5 text-signal"><ShieldCheck className="size-3.5" strokeWidth={1.75} /> BITCOIN MAINNET · {status}</span>
              </div>
              <h1 className="display break-all text-[clamp(3.25rem,9vw,8.5rem)] leading-[0.78]">
                {block}<span className="text-bitcoin">.</span><br />BITMAP
              </h1>
            </div>
            <div className="mt-10 flex flex-wrap items-end gap-5 md:gap-8">
              <div>
                <p className="label text-bitcoin">{parcel?.listedSats ? "CURRENT ASK" : lastSale ? "LAST VERIFIED SALE" : "MARKET STATUS"}</p>
                <p className="display mt-1 text-2xl md:text-4xl">{headlinePrice}</p>
              </div>
              {parcel?.listedSats && lastSale ? (
                <a
                  href={`https://mempool.space/tx/${lastSale.txid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-l border-border pl-5 hover:text-signal"
                >
                  <p className="label text-signal">LAST TRADED</p>
                  <p className="display mt-1 text-2xl text-signal md:text-4xl" data-no-translate>{formatSats(lastSale.price_sats)}</p>
                  <p className="label mt-1 text-muted-foreground" data-no-translate>
                    {lastSale.block_height ? `BLOCK #${lastSale.block_height}` : "UNCONFIRMED"} ·{" "}
                    {parcel.listedSats >= lastSale.price_sats ? "+" : ""}
                    {Math.round(((parcel.listedSats - lastSale.price_sats) / lastSale.price_sats) * 100)}% VS ASK
                  </p>
                </a>
              ) : null}
              <Link
                to="/oasis"
                search={{ height: block }}
                className="btn-term inline-flex min-h-14 items-center gap-2 px-8 text-base shadow-[0_0_24px_hsl(var(--bitcoin)/0.45)] motion-safe:animate-pulse hover:animate-none"
              >
                <Globe className="size-5" aria-hidden="true" /> ENTER THE OASIS
              </Link>
              {parcel?.listedOfferId && parcel.listedSats !== null && (
                <BuyButton offerId={parcel.listedOfferId} priceSats={parcel.listedSats} inscriptionId={parcel.inscriptionId} height={block} className="btn-term min-h-12 px-6" />
              )}
              <MakeOfferButton height={block} askSats={parcel?.listedSats ?? null} className="btn-term min-h-12 px-6" label="MAKE OFFER" />
              <WatchBitmapButton height={block} />
            </div>
          </div>
          <aside className="flex flex-col justify-between bg-card/40 p-5 md:p-8 lg:col-span-4">
            <dl className="space-y-6">
              <HeroField icon={Wallet} label="OWNER" value={owner ? shortenAddress(owner) : liveHolder.isPending ? "RESOLVING…" : "UNCLAIMED"} signal />
              <HeroField icon={Fingerprint} label="INSCRIPTION ID" value={inscriptionId ? shortId(inscriptionId) : oci.isLoading ? "RESOLVING…" : "—"} />
              <HeroField icon={MapPin} label="ATLAS PLACE" value={`${place.localName} · ${place.name}`} />
            </dl>
            <div className="mt-8 grid grid-cols-2 gap-px border-t border-border bg-border pt-px">
              <HeroStat icon={Activity} label="TRANSACTIONS" value={txCount !== null ? txCount.toLocaleString("en-US") : "…"} />
              <HeroStat icon={ArrowLeftRight} label="TRANSFERS" value={String(history.length)} />
            </div>
          </aside>
        </div>
        <nav className="flex overflow-x-auto border-t border-border" role="tablist" aria-label="BITMAP sections">
          {TABS.map((t) => (
            <Button
              key={t.id}
              id={`bitmap-tab-${t.id}`}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`bitmap-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => selectTab(t.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                moveTab(t.id, event.key === "ArrowLeft" ? -1 : 1);
              }}
              className={`label flex h-auto shrink-0 items-center gap-2 rounded-none border-r border-border border-b-2 px-5 py-3.5 ${tab === t.id ? "border-b-signal" : "border-b-transparent"} hover:bg-card ${tab === t.id ? "bg-card text-signal" : "hover:text-bitcoin"}`}
            >
              <t.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t.label}
            </Button>
          ))}
        </nav>
      </header>

      <div className="mt-px"><LoopNavigator active="provenance" compact /></div>
      <div className="mt-px"><StasisPods height={block} /></div>

      <div className="border-x border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClubBadge height={block} />
          <ForgeBadge height={block} live />
          <GalleryBadges
            height={block}
            txCount={stats.data?.txCount ?? scan.data?.txCount ?? null}
            sides={(stats.data?.txCount ?? scan.data?.txCount ?? null) === 2 ? punkSides.data?.sides ?? null : null}
          />
          <TraitBadges height={block} showRarity />
          <SatBadges height={block} />
          <GuardianMintStatus height={block} />
        </div>
      </div>

      {tab === "world" && (
        <div id="bitmap-panel-world" role="tabpanel" aria-labelledby="bitmap-tab-world" className="mt-6 space-y-6">
      <Link
        to="/oasis"
        search={{ height: block }}
        className="group flex flex-wrap items-center justify-between gap-4 border border-bitcoin bg-bitcoin/10 p-5 hover:bg-bitcoin/20 md:p-7"
      >
        <div>
          <p className="label text-bitcoin">3D WORLD · DROP IN</p>
          <p className="display mt-1 text-2xl md:text-4xl">WALK INTO {block}.BITMAP</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">One click — you land right on this BITMAP in the Oasis.</p>
        </div>
        <span className="btn-term inline-flex min-h-14 items-center gap-2 px-8 text-base">
          <Globe className="size-5" aria-hidden="true" /> ENTER THE OASIS →
        </span>
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BitmapStreamPlayer height={block} />
        <StreamChat height={block} />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="group rounded-lg border border-border bg-card p-6">
          <BlockMosaic height={block} txCount={stats.data?.txCount ?? scan.data?.txCount ?? null} />
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            {sizeMap.isLoading
              ? "> LOADING BLOCK SIZE MAP…"
              : sizeMap.data
                ? `> PACKED FROM ${sizeMap.data.classes.length.toLocaleString("en-US")} REAL TRANSACTIONS${
                    sizeMap.data.txCount ? ` OF ${sizeMap.data.txCount.toLocaleString("en-US")}` : ""
                  }`
                : "> SIZE MAP UNAVAILABLE — DETERMINISTIC FALLBACK RENDER"}
          </p>
        </div>


        <details className="group border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b border-border px-6 py-3">
            <h2 className="label">BITMAP DATA</h2>
            <svg
              className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <dl className="divide-y divide-border">
            <Field k="BLOCK HEIGHT" v={String(block)} />
            <Field k="BITCOIN NETWORK" v="MAINNET" />
            <Field
              k="OWNER"
               v={owner ? shortenAddress(owner) : liveHolder.isPending ? "RESOLVING…" : "UNCLAIMED"}
            />
            <Field
              k="STATUS"
              v={
                parcel
                  ? PARCEL_STATUS_LABEL[lastSale ? "sold" : parcel.status]
                  : PARCEL_STATUS_LABEL.unclaimed
              }
            />
            <Field
              k="ASKING PRICE"
              v={
                parcel?.listedSats
                  ? `${formatSats(parcel.listedSats)}${parcel.listedBuyerAddress ? ` · RESERVED FOR ${shortenAddress(parcel.listedBuyerAddress)}` : ""}`
                  : "NO OPEN OFFER"
              }
            />
            <Field
              k="LAST PRICE PAID"
              v={lastSale ? formatSats(lastSale.price_sats) : "NO SALE ON CHAIN"}
            />
            <Field
              k="LAST TRADE BLOCK"
              v={history[0]?.block_height ? String(history[0].block_height) : "—"}
            />

            <Field
              k="INSCRIPTION ID"
              v={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? (oci.isLoading ? "…" : "—")}
            />
            <Field
              k="INDEX SAT"
              v={oci.data?.sat ? oci.data.sat.toLocaleString() : oci.isLoading ? "…" : "—"}
            />
            <Field
              k="ON-CHAIN CONTENT"
              v={
                oci.data?.content
                  ? `"${oci.data.content}"`
                  : oci.isLoading
                    ? "…"
                    : "NO CLAIM ON THE INDEX SAT"
              }
            />
            <Field
              k="BITMAP THEORY CHECK"
              v={
                oci.isLoading
                  ? "…"
                  : oci.data?.isValid
                    ? "VALID — FIRST INSCRIPTION ON THE INDEXED SAT"
                    : oci.data?.inscriptionId
                      ? "CONTENT DOES NOT MATCH <HEIGHT>.BITMAP"
                      : "UNCLAIMED"
              }
            />
            <Field
              k="CLAIM INSCRIBED IN BLOCK"
              v={oci.data?.genesisHeight !== null && oci.data?.genesisHeight !== undefined ? String(oci.data.genesisHeight) : "—"}
            />
            <Field k="REVEAL TXID" v={parcel?.txid ?? "—"} />
            <Field k="TRANSFERS" v={parcel ? String(parcel.transfers) : "—"} />
            <Field
              k="DUPLICATE CLAIMS"
              v={parcel ? (parcel.supersedes === 0 ? "NONE" : `${parcel.supersedes} INVALID`) : "—"}
            />
            <Field
              k="ON-CHAIN INSCRIPTIONS (SCANNED)"
              v={scan.data ? String(scan.data.inscriptions.length) : "…"}
            />
            <Field
              k="BITMAP CLAIMS IN BLOCK"
              v={
                claims.length === 0
                  ? scan.data
                    ? "NONE"
                    : "…"
                  : claims.map((c) => `${c.bitmapHeight}.bitmap`).join(", ")
              }
            />
            <Field
              k="BLOCK TRANSACTIONS"
              v={
                stats.data
                  ? stats.data.txCount.toLocaleString("en-US")
                  : stats.isLoading
                    ? "…"
                    : "NOT IN DATASET"
              }
            />
            <Field
              k="PREVIEW SIZE"
              v={stats.data ? `${stats.data.previewWidth} × ${stats.data.previewHeight}` : "—"}
            />
            <Field
              k="SHAPE GROUP"
              v={
                stats.data?.pattern === null || stats.data?.pattern === undefined
                  ? stats.isLoading
                    ? "…"
                    : "—"
                  : `#${stats.data.pattern}${
                      siblings.data === undefined
                        ? ""
                        : siblings.data === 0
                          ? " — UNIQUE SHAPE"
                          : ` — SHARED WITH ${siblings.data.toLocaleString("en-US")} BITMAP(S)`
                    }`
              }
            />
          </dl>
        </details>
      </div>
      <ParcelPagePanel height={block} ownerAddress={owner} />
      <div id="market" className="scroll-mt-20">
        <DistrictReinscriptions height={block} districtInscriptionId={inscriptionId} />
      </div>
      <div className="mt-8">
        <BssScriptPanel height={block} />
      </div>
<ClientOnly><TerritoryKiosk height={block} /></ClientOnly>
      <div className="mt-6">
        <TerritoryPanel height={block} ownerAddress={owner} ownerPending={liveHolder.isPending} />
      </div>
      <BitmapDevelopment
        height={block}
        districtInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
      />
      <div className="mt-8 flex flex-wrap items-center gap-3 border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="label text-bitcoin">BLOCK-DNA GUARDIAN</p>
          <p className="font-mono text-[11px] text-muted-foreground">A creature read from this block's real data. The holder can summon it to patrol this land in the Oasis.</p>
        </div>
        <SummonGuardianButton height={block} />
      </div>
        </div>
      )}
      {tab === "market" && (
        <div id="bitmap-panel-market" role="tabpanel" aria-labelledby="bitmap-tab-market" className="mt-6 space-y-6">
        <BitmapOrderBook height={block} />
        <BitmapStorefront height={block} />
      <BidPanel
        height={block}
        ownerAddress={owner}
        askSats={parcel?.listedSats ?? null}
      />
      <BitmapPriceChart height={block} />
      <div className="mt-6">
        <LeasePanel height={block} ownerAddress={owner} />
      </div>
      <BitmapValuation
        height={block}
        claimInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
      />
        </div>
      )}
      {tab === "facts" && (
        <div id="bitmap-panel-facts" role="tabpanel" aria-labelledby="bitmap-tab-facts" className="mt-6 space-y-6">
      <section id="facts" className="mt-8 scroll-mt-20 border border-border" aria-label="Block analytics">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="label">BLOCK ANALYTICS</h2>
          <Link to="/map/district/$slug" params={{ slug: place.slug }} className="label text-bitcoin hover:text-foreground">
            {place.name.toUpperCase()} →
          </Link>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="BLOCK TRANSACTIONS" value={txCount !== null ? txCount.toLocaleString("en-US") : "…"} />
          <Metric label="ON-CHAIN TRANSFERS" value={String(history.length)} />
          <Metric
            label="TOTAL TRADED VOLUME"
            value={tradedVolume > 0 ? formatSats(tradedVolume) : history.length > 0 ? "TRANSFERS ONLY" : "NO TRADES"}
          />
          <Metric label="DISTINCT TRADERS" value={String(distinctTraders)} />
          <Metric
            label="INSCRIPTIONS IN BLOCK"
            value={scan.data ? scan.data.inscriptions.length.toLocaleString("en-US") : "…"}
          />
          <Metric
            label="BITMAP CLAIMS HERE"
            value={scan.data ? String(claims.length) : "…"}
          />
          <Metric label="WORLD EVENTS HERE" value={localHistory.data ? String(localHistory.data.length) : "…"} />
          <Metric
            label="INSCRIPTION VALUE"
            value={
              liveHolder.data?.valueSats
                ? formatSats(liveHolder.data.valueSats)
                : liveHolder.isPending
                  ? "…"
                  : "—"
            }
          />
        </div>
        <div className="border-t border-border px-4 py-4">
          <p className="label text-muted-foreground">
            DISTRICT OWNERSHIP · {place.name.toUpperCase()} · {place.landmark.toUpperCase()}
          </p>
          {regionStats.isPending ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; READING REGION LEDGER…</p>
          ) : region ? (
            <>
              <div className="mt-3 grid gap-px bg-border sm:grid-cols-3">
                <Metric label="HOLDER ADDRESSES" value={region.owners.toLocaleString("en-US")} />
                <Metric label="BITMAPS HELD" value={regionHeld.toLocaleString("en-US")} />
                <Metric
                  label="AVERAGE PER HOLDER"
                  value={region.owners > 0 ? (regionHeld / region.owners).toFixed(1) : "—"}
                />
              </div>
              {region.top.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {region.top.slice(0, 5).map((holder, rank) => (
                    <li key={holder.address ?? rank} className="flex min-w-0 items-center gap-3 font-mono text-xs">
                      <span className="label w-6 shrink-0">{String(rank + 1).padStart(2, "0")}</span>
                      {holder.address ? (
                        <Link
                          to="/profile/$address"
                          params={{ address: holder.address }}
                          className="min-w-0 truncate text-foreground hover:text-bitcoin"
                        >
                          {shortenAddress(holder.address)}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate text-muted-foreground">UNKNOWN HOLDER</span>
                      )}
                      <span className="relative h-1.5 min-w-10 flex-1 overflow-hidden bg-border">
                        <span
                          className="absolute inset-y-0 left-0 bg-bitcoin/70"
                          style={{ width: `${regionHeld > 0 ? Math.min(100, (holder.held / regionHeld) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="label shrink-0">
                        {holder.held} · {regionHeld > 0 ? ((holder.held / regionHeld) * 100).toFixed(2) : "0.00"}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; NO REGION DATA INDEXED YET_</p>
          )}
        </div>
      </section>
      <ParcelPanel
        height={block}
        districtInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
        txCount={stats.data?.txCount ?? scan.data?.txCount ?? null}
      />
      {scan.data && scan.data.inscriptions.length > 0 && (
        <div className="mt-8 border border-border">
          <div className="border-b border-border px-6 py-3">
            <h2 className="label">INSCRIPTIONS FOUND IN BLOCK {block}</h2>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {scan.data.inscriptions.slice(0, 40).map((i) => (
              <a
                key={i.id}
                href={`https://ordinals.com/inscription/${i.id}`}
                target="_blank"
                rel="noreferrer"
                className="border border-border transition-colors hover:border-primary"
              >
                <InscriptionContent
                  inscriptionId={i.id}
                  contentType={i.contentType}
                  className="aspect-square w-full"
                  title={i.isBitmapClaim ? `${i.bitmapHeight}.bitmap` : `Inscription ${shortId(i.id)}`}
                />
                <div className="border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  <span className="block truncate text-foreground">
                    {i.isBitmapClaim ? `${i.bitmapHeight}.BITMAP` : shortId(i.id)}
                  </span>
                  <span className="block truncate">
                    {i.contentType ?? "UNKNOWN"} · {i.bodyBytes} B
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
        </div>
      )}
      {tab === "chronicle" && (
        <div id="bitmap-panel-chronicle" role="tabpanel" aria-labelledby="bitmap-tab-chronicle" className="mt-6 space-y-6">
      <ProvenancePanel height={block} ownerAddress={owner} />
      <TerritoryChronicle height={block} />
      <div className="mt-8 border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <h2 className="label">ON-CHAIN TRADE HISTORY</h2>
          <span className="label">{history.length} TRANSFER(S)</span>
        </div>
        {history.length === 0 ? (
          <p className="px-6 py-6 font-mono text-xs text-muted-foreground">
            &gt;{" "}
            {trades.isLoading
              ? "READING INDEXED TRANSFERS…"
              : "NO CONFIRMED TRANSFER INDEXED — RUN [ TRACE ON-CHAIN TRADES ]"}
            <span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((t) => (
              <li key={t.txid} className="px-6 py-4 font-mono text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="display text-sm">
                    {t.price_sats > 0 ? `SOLD ${formatSats(t.price_sats)}` : "TRANSFER"}
                  </span>
                  <span className="text-muted-foreground">
                    BLOCK {t.block_height ?? "—"} · {timeAgo(t.block_time ?? t.created_at)}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {shortenAddress(t.seller_address)} → {shortenAddress(t.buyer_address)}
                </div>
                <a
                  className="mt-1 block break-all text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                  href={`https://mempool.space/tx/${t.txid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.txid}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="btn-term disabled:opacity-30"
          disabled={trace.isPending || (!parcel && !oci.data?.inscriptionId)}
          onClick={() => trace.mutate()}
        >
          {trace.isPending ? "[ TRACING… ]" : "[ TRACE ON-CHAIN TRADES ]"}
        </button>

        <a
          className="btn-term-ghost"
          href={`https://mempool.space/block/${block}`}
          target="_blank"
          rel="noreferrer"
        >
          [ VIEW ON EXPLORER ]
        </a>
        {parcel && (
          <a
            className="btn-term-ghost"
            href={`https://mempool.space/tx/${parcel.txid}`}
            target="_blank"
            rel="noreferrer"
          >
            [ VIEW CLAIM TRANSACTION ]
          </a>
        )}
      </div>
        </div>
      )}
      {tab === "community" && (
        <div id="bitmap-panel-community" role="tabpanel" aria-labelledby="bitmap-tab-community" className="mt-6 space-y-6">
      <div id="community" className="scroll-mt-20"><BitmapChat height={block} /></div>
<ClientOnly><TerritoryDispatches height={block} /></ClientOnly>
      <div className="mt-6">
        <BitmapEvents height={block} ownerAddress={owner} />
      </div>
      <ShadowGatePanel height={block} />
      <div className="mt-8 max-w-2xl">
        <TerritoryShareCard height={block} placeName={`${place.localName} · ${place.name}`} tags={[parcel ? "CLAIMED LAND" : "UNCLAIMED LAND", "BITCOIN BLOCK"]} />
      </div>
        </div>
      )}

    </div>
  );
}

const TABS = [
  { id: "world", label: "WORLD", icon: Globe },
  { id: "market", label: "MARKET", icon: Store },
  { id: "facts", label: "FACTS", icon: Database },
  { id: "chronicle", label: "CHRONICLE", icon: ScrollText },
  { id: "community", label: "COMMUNITY", icon: Users },
] as const;
type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function readBitmapTab(): TabId {
  const hash = window.location.hash.slice(1);
  return isTabId(hash) ? hash : "world";
}

function subscribeToBitmapTab(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener("bitmap-tab-change", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("bitmap-tab-change", onChange);
  };
}

function useBitmapTab() {
  return useSyncExternalStore(subscribeToBitmapTab, readBitmapTab, () => "world");
}

function history_replace(id: string) {
  window.history.replaceState(window.history.state, "", `#${id}`);
  window.dispatchEvent(new Event("bitmap-tab-change"));
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="label">{k}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-foreground">{v}</dd>
    </div>
  );
}

function HeroField({ icon: I, label, value, signal = false }: { icon: LucideIcon; label: string; value: string; signal?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="label flex items-center gap-2"><I className="size-3.5" strokeWidth={1.75} aria-hidden="true" />{label}</dt>
      <dd className={`mt-2 break-words font-mono text-sm ${signal ? "text-signal" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

function HeroStat({ icon: I, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-3 py-3">
      <dt className="label flex items-center gap-1.5"><I className="size-3.5" strokeWidth={1.75} aria-hidden="true" />{label}</dt>
      <dd className="display mt-1 truncate text-lg">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="label text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function BitmapMissing() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
      <h1 className="display text-3xl">BITMAP NOT INDEXED</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; THIS BLOCK IS NOT PRESENT IN THE DEMO REGISTRY<span className="blink">_</span>
      </p>
      <Link to="/marketplace" className="btn-term mt-8">
        [ BACK TO MARKETPLACE ]
      </Link>
    </div>
  );
}
