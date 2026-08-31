import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getBlockInscriptions } from "@/lib/ordinals-scan.functions";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { MAX_BITMAP } from "@/lib/oci";
import { TraitBadges } from "@/components/TraitBadges";
import { toast } from "sonner";
import { BlockMosaic } from "@/components/BlockMosaic";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { OfferBook } from "@/components/OfferBook";
import { BidPanel } from "@/components/BidPanel";
import { ParcelPagePanel } from "@/components/ParcelPagePanel";
import { MakeOfferButton } from "@/components/MakeOfferButton";

import { TradeWatcher } from "@/components/TradeWatcher";
import { SettlementWatcher } from "@/components/SettlementWatcher";
import { registryParcelQuery, shortenAddress, PARCEL_STATUS_LABEL } from "@/lib/registry";
import { saveTrades, tradesForHeightQuery } from "@/lib/trade-store";
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
  const oci = useQuery(ociQuery(block));
  const trades = useQuery(tradesForHeightQuery(block));
  const queryClient = useQueryClient();

  const claims = (scan.data?.inscriptions ?? []).filter((i) => i.isBitmapClaim);
  const history = [...(trades.data ?? [])].sort((a, b) => b.hop - a.hop);
  const lastSale = history.find((t) => t.price_sats > 0) ?? null;
  const owner = history[0]?.buyer_address ?? parcel?.ownerAddress ?? null;

  const trace = useMutation({
    mutationFn: async () => {
      const txid = parcel?.txid ?? oci.data?.inscriptionId?.slice(0, 64) ?? null;
      if (!txid) throw new Error("NO CLAIM TRANSACTION KNOWN FOR THIS BITMAP");
      const traces = await traceBitmapTradesFn({
        data: {
          claims: [
            { bitmapHeight: block, txid, inscriptionId: parcel?.inscriptionId ?? oci.data?.inscriptionId ?? null },
          ],
          maxHops: 8,
        },
      });
      return saveTrades(traces);
    },
    onSuccess: (stored) => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["registry"] });
      toast(`${block}.BITMAP`, { description: `${stored} ON-CHAIN TRANSFER(S) INDEXED` });
    },
    onError: (e) => toast("TRADE TRACE FAILED", { description: (e as Error).message }),
  });



  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/explore" className="label hover:text-foreground">
        ← BACK TO EXPLORER
      </Link>
      <h1 className="display mt-4 text-4xl md:text-6xl">{block}.BITMAP</h1>
      <p className="label mt-3">
        {parcel
          ? `CLAIMED ON CHAIN${parcel.inscribedInBlock !== null ? ` IN BLOCK ${parcel.inscribedInBlock}` : ""}`
          : "UNCLAIMED — NO VALID INSCRIPTION IN THE REGISTRY"}
      </p>

      <TraitBadges height={block} showRarity className="mt-4" />

      <div className="mt-6 flex flex-wrap gap-2">
        <MakeOfferButton
          height={block}
          askSats={parcel?.listedSats ?? null}
          className="btn-term"
          label="[ MAKE OFFER ]"
        />
      </div>

      <ParcelPagePanel height={block} ownerAddress={owner ?? oci.data?.ownerAddress ?? null} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="group rounded-lg border border-border bg-card p-6">
          <BlockMosaic height={block} txCount={scan.data?.txCount ?? null} />
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

        <div className="border border-border">
          <div className="border-b border-border px-6 py-3">
            <span className="label">BITMAP DATA</span>
          </div>
          <dl className="divide-y divide-border">
            <Field k="BLOCK HEIGHT" v={String(block)} />
            <Field k="BITCOIN NETWORK" v="MAINNET" />
            <Field
              k="OWNER"
              v={owner ? shortenAddress(owner) : oci.data?.ownerAddress ? shortenAddress(oci.data.ownerAddress) : "UNCLAIMED"}
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
          </dl>
        </div>
      </div>

      <div className="mt-8 border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <span className="label">ON-CHAIN TRADE HISTORY</span>
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
            <span className="label">INSCRIPTIONS FOUND IN BLOCK {block}</span>
          </div>
          <ul className="divide-y divide-border">
            {scan.data.inscriptions.slice(0, 40).map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 font-mono text-xs text-muted-foreground"
              >
                <span className="break-all">{i.id}</span>
                <span>
                  {i.contentType ?? "UNKNOWN"} · {i.bodyBytes} B
                  {i.isBitmapClaim ? ` · ${i.bitmapHeight}.BITMAP` : ""}
                </span>
              </li>
            ))}
          </ul>
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

      <TradeWatcher heights={[block]} limit={5} />

      <SettlementWatcher heights={[block]} limit={10} />

      <OfferBook height={block} />

      <BidPanel
        height={block}
        ownerAddress={owner ?? oci.data?.ownerAddress ?? null}
        askSats={parcel?.listedSats ?? null}
      />

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

function BitmapMissing() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
      <h1 className="display text-3xl">BITMAP NOT INDEXED</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; THIS BLOCK IS NOT PRESENT IN THE DEMO REGISTRY<span className="blink">_</span>
      </p>
      <Link to="/explore" className="btn-term mt-8">
        [ BACK TO EXPLORER ]
      </Link>
    </div>
  );
}
