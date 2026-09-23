import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getBlockInscriptions } from "@/lib/ordinals-scan.functions";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { MAX_BITMAP } from "@/lib/oci";
import { atlasPlace, districtBlockRange } from "@/lib/atlas-places";
import { getAtlasRegionStats } from "@/lib/atlas-land.functions";
import { TraitBadges } from "@/components/TraitBadges";
import { ClubBadge } from "@/components/ClubBadge";
import { GalleryBadges } from "@/components/GalleryBadges";
import { SatBadges } from "@/components/SatBadges";
import { toast } from "sonner";
import { BlockMosaic } from "@/components/BlockMosaic";
import { BitmapTerritory } from "@/components/BitmapTerritory";

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
import { BitmapOrderBook } from "@/components/BitmapOrderBook";
import { TerritoryPanel } from "@/components/extenders/TerritoryPanel";
import { getBitmapHolderFn } from "@/lib/locate-bitmap.functions";
import { LoopNavigator } from "@/components/LoopNavigator";
import { StreamEventRow } from "@/components/StreamEventRow";
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
  component: BitmapDetail,
  notFoundComponent: BitmapMissing,
  errorComponent: ({ error, reset }) => <ParcelError error={error} reset={reset} />,
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
    <div className="land-terminal mx-auto min-h-screen max-w-[1400px] px-3 py-5 md:px-5 md:py-8">
      <header className="land-panel p-4 md:p-5">
        <Link to="/marketplace" className="label hover:text-foreground">← MARKETPLACE / LAND</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <h1 className="display text-3xl md:text-5xl">{block}.BITMAP</h1>
          <p className="label border border-border px-3 py-2 text-bitcoin">
            {parcel
              ? `CLAIMED${parcel.inscribedInBlock !== null ? ` · BLOCK ${parcel.inscribedInBlock}` : ""}`
              : "UNCLAIMED"}
          </p>
        </div>
      </header>
      <Link to="/map/place/$block" params={{ block: String(block) }} className="land-panel mt-px flex max-w-xl min-w-0 items-center justify-between gap-4 px-4 py-3 transition-colors hover:border-bitcoin">
        <span className="min-w-0">
          <span className="label block text-bitcoin">THIS PLACE IN THE ATLAS</span>
          <span className="mt-1 block truncate font-mono text-xs">{atlasPlace(block).localName} · {atlasPlace(block).name}</span>
        </span>
        <span className="label shrink-0 text-bitcoin">STORY →</span>
      </Link>
      <div className="mt-px"><LoopNavigator active="provenance" compact /></div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ClubBadge height={block} />
        <GalleryBadges
          height={block}
          txCount={stats.data?.txCount ?? scan.data?.txCount ?? null}
          sides={
            (stats.data?.txCount ?? scan.data?.txCount ?? null) === 2
              ? punkSides.data?.sides ?? null
              : null
          }
        />
        <TraitBadges height={block} showRarity />
        <SatBadges height={block} />
      </div>

      <DistrictReinscriptions
        height={block}
        districtInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
      />




      <div className="mt-6 flex flex-wrap gap-2">
        <MakeOfferButton
          height={block}
          askSats={parcel?.listedSats ?? null}
          className="btn-term"
          label="[ MAKE OFFER ]"
        />
      </div>

      <div className="mt-8">
        <BitmapOrderBook height={block} />
      </div>

      <ProvenancePanel height={block} ownerAddress={owner} />

      <div className="mt-8">
        <BssScriptPanel height={block} />
      </div>

      <section className="mt-8 border border-border" aria-label="Block analytics">
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

      <BitmapPriceChart height={block} />

      <ParcelPagePanel height={block} ownerAddress={owner} />

      <ParcelPanel
        height={block}
        districtInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
        txCount={stats.data?.txCount ?? scan.data?.txCount ?? null}
      />
      <BitmapDevelopment
        height={block}
        districtInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
      />
      <section className="mt-8 border border-border"><header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="display text-xl">HISTORY CREATED HERE</h2><Link to="/stream" className="label text-bitcoin">WORLD STREAM →</Link></header>{localHistory.data?.length ? localHistory.data.map((item) => <StreamEventRow key={item.id} event={item}/>) : <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NO RECORDED WORLD HISTORY ON THIS BITMAP YET_</p>}</section>

      <div className="mt-6">
        <WatchBitmapButton height={block} />
      </div>

      <BitmapValuation
        height={block}
        claimInscriptionId={parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null}
      />

      <BitmapChat height={block} />


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
          <div className="mt-6 border-t border-border pt-6">
            <BitmapTerritory height={block} />
          </div>
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


      <BidPanel
        height={block}
        ownerAddress={owner}
        askSats={parcel?.listedSats ?? null}
      />

      <div className="mt-6">
        <TerritoryPanel height={block} ownerAddress={owner} ownerPending={liveHolder.isPending} />
      </div>

      <div className="mt-6">
        <LeasePanel height={block} ownerAddress={owner} />
      </div>

      <div className="mt-6">
        <BitmapEvents height={block} ownerAddress={owner} />
      </div>



    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="label">{k}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-foreground">{v}</dd>
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
