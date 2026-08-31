import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import {
  groupByBlock,
  storedInscriptionsQuery,
  type StoredInscription,
} from "@/lib/inscription-store";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";

export const Route = createFileRoute("/bitmaps")({
  head: () => ({
    meta: [
      { title: "Indexed Bitmaps — Stored Inscription Registry" },
      {
        name: "description",
        content:
          "Browse every inscription indexed by block number. Bitmap claims decoded by the extractor are stored once and served from the registry.",
      },
      { property: "og:title", content: "Indexed Bitmaps — Stored Inscription Registry" },
      {
        property: "og:description",
        content: "Inscriptions indexed by Bitcoin block number, served from the registry.",
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
  component: BitmapsPage,
});

function InscriptionRow({ row }: { row: StoredInscription }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="break-all font-mono text-xs text-muted-foreground">{row.id}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {row.content_type ?? "UNKNOWN"} · {row.body_bytes} B
      </span>
      {row.is_bitmap_claim && row.bitmap_height !== null ? (
        <span className="border border-foreground px-2 py-0.5 font-mono text-[11px] text-foreground">
          {row.bitmap_height}.BITMAP
        </span>
      ) : null}
    </li>
  );
}

function BitmapsPage() {
  const { data, refetch, isFetching } = useSuspenseQuery(storedInscriptionsQuery());
  const [onlyClaims, setOnlyClaims] = useState(false);
  const [term, setTerm] = useState("");

  const groups = useMemo(() => {
    const q = term.trim().toLowerCase();
    const filtered = data.filter((row) => {
      if (onlyClaims && !row.is_bitmap_claim) return false;
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        row.txid.toLowerCase().includes(q) ||
        String(row.block_height ?? "").includes(q) ||
        (row.body_text ?? "").toLowerCase().includes(q)
      );
    });
    return groupByBlock(filtered);
  }, [data, onlyClaims, term]);

  const claimCount = data.filter((r) => r.is_bitmap_claim).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <div className="mb-8 border border-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Database className="size-4" />
          <h1 className="display text-2xl md:text-3xl">INDEXED BITMAPS</h1>
        </div>
        <p className="px-4 py-3 font-mono text-sm text-muted-foreground">
          Every inscription decoded by the extractor is stored in the registry and indexed by
          block number. This page reads the stored index — no hex is parsed here.
        </p>
        <div className="grid grid-cols-3 border-t border-border font-mono text-xs">
          <div className="border-r border-border px-4 py-3">
            <div className="label">INSCRIPTIONS</div>
            <div className="mt-1 text-foreground">{data.length}</div>
          </div>
          <div className="border-r border-border px-4 py-3">
            <div className="label">BITMAP CLAIMS</div>
            <div className="mt-1 text-foreground">{claimCount}</div>
          </div>
          <div className="px-4 py-3">
            <div className="label">BLOCKS</div>
            <div className="mt-1 text-foreground">{groups.length}</div>
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
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> RELOAD
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="border border-border px-4 py-10 text-center font-mono text-sm text-muted-foreground">
          &gt; REGISTRY EMPTY — DECODE A TRANSACTION IN THE{" "}
          <Link to="/extractor" className="text-foreground underline">
            EXTRACTOR
          </Link>{" "}
          TO INDEX INSCRIPTIONS.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section
              key={group.blockHeight ?? "unknown"}
              className="border border-border bg-background"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  {group.blockHeight !== null && (
                    <div className="size-10 shrink-0 border border-border">
                      <BitmapPixelMap blockHeight={group.blockHeight} />
                    </div>
                  )}
                  <div>
                    <div className="label">BLOCK</div>
                    <div className="display text-xl">
                      {group.blockHeight ?? "UNKNOWN"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span>{group.inscriptions.length} INSCRIPTION(S)</span>
                  <span>{group.bitmapClaims.length} CLAIM(S)</span>
                  {group.blockHeight !== null && (
                    <Link
                      to="/bitmap/$block"
                      params={{ block: String(group.blockHeight) }}
                      className="btn-term"
                    >
                      VIEW PARCEL →
                    </Link>
                  )}
                </div>
              </header>
              <ul className="divide-y divide-border">
                {group.inscriptions.map((row) => (
                  <InscriptionRow key={row.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
