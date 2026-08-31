import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { getRecentInscriptions } from "@/lib/ordinals-scan.functions";
import type { ChainInscription, ScannedBlock } from "@/lib/ordinals-scan";
import { storedInscriptionsQuery, type StoredInscription } from "@/lib/inscription-store";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { shortId, timeAgoFromUnix } from "@/lib/chain";

const BLOCKS = 6;
const TX_PAGES = 4;

const chainInscriptionsQuery = queryOptions({
  queryKey: ["chain-inscriptions", BLOCKS, TX_PAGES],
  queryFn: () => getRecentInscriptions({ data: { blocks: BLOCKS, txPages: TX_PAGES } }),
  staleTime: 60_000,
});

export const Route = createFileRoute("/bitmaps")({
  head: () => ({
    meta: [
      { title: "Live Inscription Registry — Bitmap Parcels by Block" },
      {
        name: "description",
        content:
          "Ordinal inscriptions decoded straight from live Bitcoin blocks and indexed by block height, with every <height>.bitmap claim flagged as it lands on chain.",
      },
      { property: "og:title", content: "Live Inscription Registry — Bitmap Parcels by Block" },
      {
        property: "og:description",
        content:
          "Real ordinal inscriptions decoded from recent Bitcoin blocks, indexed by block height.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-16 font-mono text-sm text-foreground">
      &gt; REGISTRY ERROR: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-[900px] px-4 py-16 font-mono text-sm">&gt; NOT FOUND</div>
  ),
  loader: ({ context }) => context.queryClient.ensureQueryData(chainInscriptionsQuery),
  component: BitmapsPage,
});

function InscriptionRow({ row }: { row: ChainInscription }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="break-all font-mono text-xs text-muted-foreground">{row.id}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {row.contentType ?? "UNKNOWN"} · {row.bodyBytes} B
      </span>
      {row.isBitmapClaim && row.bitmapHeight !== null ? (
        <span className="border border-foreground px-2 py-0.5 font-mono text-[11px] text-foreground">
          {row.bitmapHeight}.BITMAP
        </span>
      ) : null}
    </li>
  );
}

function BlockSection({ block }: { block: ScannedBlock }) {
  const claims = block.inscriptions.filter((i) => i.isBitmapClaim);
  return (
    <section className="border border-border bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 border border-border">
            <BitmapPixelMap
              blockHeight={block.height}
              txCount={block.txCount}
              vsizes={block.vsizes}
              animate={false}
            />
          </div>
          <div>
            <div className="label">BLOCK</div>
            <div className="display text-xl">{block.height}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {timeAgoFromUnix(block.timestamp)} · {shortId(block.hash)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>
            {block.inscriptions.length} INSCRIPTION(S) IN {block.scannedTxCount}/{block.txCount} TX
          </span>
          <span>{claims.length} CLAIM(S)</span>
          <Link
            to="/bitmap/$block"
            params={{ block: String(block.height) }}
            className="btn-term"
          >
            VIEW PARCEL →
          </Link>
        </div>
      </header>
      {block.inscriptions.length === 0 ? (
        <p className="px-4 py-3 font-mono text-xs text-muted-foreground">
          &gt; NO ORD ENVELOPES IN THE SCANNED WINDOW OF THIS BLOCK
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {block.inscriptions.map((row) => (
            <InscriptionRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function storedToChain(row: StoredInscription): ChainInscription {
  return {
    id: row.id,
    txid: row.txid,
    inputIndex: row.input_index,
    blockHeight: row.block_height ?? 0,
    contentType: row.content_type,
    bodyBytes: row.body_bytes,
    bodyText: row.body_text,
    isBitmapClaim: row.is_bitmap_claim,
    bitmapHeight: row.bitmap_height,
  };
}

function BitmapsPage() {
  const { data, refetch, isFetching } = useSuspenseQuery(chainInscriptionsQuery);
  const stored = useQuery(storedInscriptionsQuery());
  const [onlyClaims, setOnlyClaims] = useState(false);
  const [term, setTerm] = useState("");

  const blocks = useMemo(() => {
    // Inscriptions saved from the extractor are folded into their block so the
    // registry stays a single index over the chain.
    const extra = new Map<number, ChainInscription[]>();
    for (const row of stored.data ?? []) {
      if (row.block_height === null) continue;
      const list = extra.get(row.block_height) ?? [];
      list.push(storedToChain(row));
      extra.set(row.block_height, list);
    }

    const merged: ScannedBlock[] = data.map((block) => {
      const seen = new Set(block.inscriptions.map((i) => i.id));
      const added = (extra.get(block.height) ?? []).filter((i) => !seen.has(i.id));
      extra.delete(block.height);
      return { ...block, inscriptions: [...block.inscriptions, ...added] };
    });

    for (const [height, inscriptions] of extra) {
      merged.push({
        height,
        hash: "",
        timestamp: 0,
        txCount: 0,
        scannedTxCount: 0,
        vsizes: [],
        inscriptions,
      });
    }

    const q = term.trim().toLowerCase();
    return merged
      .map((block) => ({
        ...block,
        inscriptions: block.inscriptions.filter((row) => {
          if (onlyClaims && !row.isBitmapClaim) return false;
          if (!q) return true;
          return (
            row.id.toLowerCase().includes(q) ||
            row.txid.toLowerCase().includes(q) ||
            String(row.blockHeight).includes(q) ||
            (row.bodyText ?? "").toLowerCase().includes(q)
          );
        }),
      }))
      .filter((block) => !(onlyClaims || q) || block.inscriptions.length > 0)
      .sort((a, b) => b.height - a.height);
  }, [data, stored.data, onlyClaims, term]);

  const allInscriptions = blocks.flatMap((b) => b.inscriptions);
  const claimCount = allInscriptions.filter((r) => r.isBitmapClaim).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <div className="mb-8 border border-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Database className="size-4" />
          <h1 className="display text-2xl md:text-3xl">LIVE INSCRIPTION REGISTRY</h1>
        </div>
        <p className="px-4 py-3 font-mono text-sm text-muted-foreground">
          Ordinal envelopes decoded from the witness data of the most recent Bitcoin blocks and
          indexed by block height. Every parcel below is rendered from that block&apos;s real
          transaction vbytes; any <span className="text-foreground">&lt;height&gt;.bitmap</span>{" "}
          text inscription is flagged as a claim.
        </p>
        <div className="grid grid-cols-3 border-t border-border font-mono text-xs">
          <div className="border-r border-border px-4 py-3">
            <div className="label">INSCRIPTIONS</div>
            <div className="mt-1 text-foreground">{allInscriptions.length}</div>
          </div>
          <div className="border-r border-border px-4 py-3">
            <div className="label">BITMAP CLAIMS</div>
            <div className="mt-1 text-foreground">{claimCount}</div>
          </div>
          <div className="px-4 py-3">
            <div className="label">BLOCKS</div>
            <div className="mt-1 text-foreground">{blocks.length}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="SEARCH BLOCK / TXID / INSCRIPTION ID"
          spellCheck={false}
          className="min-w-[260px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
        />
        <button
          onClick={() => setOnlyClaims((v) => !v)}
          className={`btn-term ${onlyClaims ? "bg-foreground text-background" : ""}`}
        >
          BITMAP CLAIMS ONLY
        </button>
        <button
          onClick={() => void refetch()}
          className="btn-term inline-flex items-center gap-2"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> RESCAN CHAIN
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="border border-border px-4 py-10 text-center font-mono text-sm text-muted-foreground">
          &gt; NO INSCRIPTIONS MATCHED — WIDEN THE SEARCH OR DECODE A TRANSACTION IN THE{" "}
          <Link to="/extractor" className="text-foreground underline">
            EXTRACTOR
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-6">
          {blocks.map((block) => (
            <BlockSection key={block.height} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
