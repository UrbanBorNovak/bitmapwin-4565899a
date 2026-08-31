import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Database, RefreshCw, Search } from "lucide-react";
import {
  getBitmapRegistryRange,
  getBitmapRegistryStats,
} from "@/lib/oci.functions";
import { MAX_BITMAP, type BitmapIndexEntry } from "@/lib/oci";
import { BlockMosaic } from "@/components/BlockMosaic";

const PAGE = 60;

const rangeQuery = (start: number) =>
  queryOptions({
    queryKey: ["bitmap-registry", start, PAGE],
    queryFn: () => getBitmapRegistryRange({ data: { start, count: PAGE, resolveLimit: 40 } }),
    staleTime: 5 * 60_000,
  });

const statsQuery = queryOptions({
  queryKey: ["bitmap-registry-stats"],
  queryFn: () => getBitmapRegistryStats(),
  staleTime: 60_000,
});

const DEFAULT_START = MAX_BITMAP - PAGE + 1;

export const Route = createFileRoute("/bitmaps")({
  head: () => ({
    meta: [
      { title: "Bitmap Registry — On-Chain Index of 907,000 Parcels" },
      {
        name: "description",
        content:
          "Browse every Bitcoin Bitmap parcel from block 0 to 906,999, resolved from the on-chain index: sat number, claiming inscription and validity for each block.",
      },
      { property: "og:title", content: "Bitmap Registry — On-Chain Index of 907,000 Parcels" },
      {
        property: "og:description",
        content:
          "Every bitmap from block 0 to 906,999, resolved sat by sat from the on-chain index.",
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
  loader: ({ context }) => context.queryClient.ensureQueryData(rangeQuery(DEFAULT_START)),
  component: BitmapsPage,
});

function EntryRow({ entry }: { entry: BitmapIndexEntry }) {
  const state = entry.inscriptionId
    ? entry.isValid
      ? "VALID"
      : "MISMATCH"
    : entry.resolvedAt
      ? "UNCLAIMED"
      : "PENDING";

  return (
    <li className="grid grid-cols-[3rem_1fr] items-center gap-3 px-4 py-3 md:grid-cols-[3rem_7rem_1fr_auto]">
      <div className="size-10 shrink-0 border border-border">
        <BlockMosaic height={entry.blockHeight} animate={false} />
      </div>
      <div>
        <Link
          to="/bitmap/$block"
          params={{ block: String(entry.blockHeight) }}
          className="display text-lg hover:underline"
        >
          {entry.blockHeight}
        </Link>
        <div className="font-mono text-[11px] text-muted-foreground">
          SAT {entry.sat ? entry.sat.toLocaleString() : "—"}
          {entry.satIndex ? ` · IDX ${entry.satIndex}` : ""}
        </div>
      </div>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="break-all font-mono text-[11px] text-muted-foreground">
          {entry.inscriptionId ?? "> NOT RESOLVED YET"}
        </div>
        {entry.content ? (
          <div className="font-mono text-[11px] text-foreground">&quot;{entry.content}&quot;</div>
        ) : null}
      </div>
      <div className="col-span-2 flex items-center gap-2 md:col-span-1">
        <span
          className={`border px-2 py-0.5 font-mono text-[11px] ${
            state === "VALID"
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground"
          }`}
        >
          {state}
        </span>
        {entry.ownerAddress ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {entry.ownerAddress.slice(0, 6)}…{entry.ownerAddress.slice(-4)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function BitmapsPage() {
  const [start, setStart] = useState(DEFAULT_START);
  const [jump, setJump] = useState("");
  const { data, isFetching, refetch } = useSuspenseQuery(rangeQuery(start));
  const stats = useQuery(statsQuery);

  const go = (next: number) => {
    setStart(Math.max(0, Math.min(MAX_BITMAP - PAGE + 1, next)));
  };

  const onJump = () => {
    const n = Number(jump.trim());
    if (!Number.isFinite(n)) return;
    go(Math.floor(n));
  };

  const validOnPage = data.entries.filter((e) => e.isValid).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <div className="mb-8 border border-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Database className="size-4" />
          <h1 className="display text-2xl md:text-3xl">BITMAP REGISTRY</h1>
        </div>
        <p className="px-4 py-3 font-mono text-sm text-muted-foreground">
          Resolved from the on-chain index inscriptions: every bitmap number from 0 to{" "}
          {MAX_BITMAP.toLocaleString()} maps to a sat, that sat carries the first{" "}
          <span className="text-foreground">&lt;height&gt;.bitmap</span> inscription, and the
          registry caches the result so pages load instantly on the next visit.
        </p>
        <div className="grid grid-cols-2 border-t border-border font-mono text-xs md:grid-cols-4">
          <div className="border-r border-border px-4 py-3">
            <div className="label">UNIVERSE</div>
            <div className="mt-1 text-foreground">
              {(stats.data?.universe ?? MAX_BITMAP + 1).toLocaleString()}
            </div>
          </div>
          <div className="border-r border-border px-4 py-3">
            <div className="label">INDEXED</div>
            <div className="mt-1 text-foreground">
              {(stats.data?.indexed ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="border-r border-border px-4 py-3">
            <div className="label">VALID CLAIMS</div>
            <div className="mt-1 text-foreground">{(stats.data?.valid ?? 0).toLocaleString()}</div>
          </div>
          <div className="px-4 py-3">
            <div className="label">VALID ON PAGE</div>
            <div className="mt-1 text-foreground">
              {validOnPage}/{data.entries.length}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 border border-border px-3 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onJump()}
            placeholder="JUMP TO BITMAP NUMBER (0 – 906999)"
            spellCheck={false}
            inputMode="numeric"
            className="min-w-[180px] flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onJump} className="btn-term">
            GO
          </button>
        </div>
        <button onClick={() => go(start - PAGE)} className="btn-term inline-flex items-center gap-1">
          <ChevronLeft className="size-3.5" /> PREV
        </button>
        <button onClick={() => go(start + PAGE)} className="btn-term inline-flex items-center gap-1">
          NEXT <ChevronRight className="size-3.5" />
        </button>
        <button onClick={() => void refetch()} className="btn-term inline-flex items-center gap-2">
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> RESOLVE
        </button>
      </div>

      <div className="border border-border">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 font-mono text-xs text-muted-foreground">
          <span>
            RANGE {start.toLocaleString()} – {(start + data.entries.length - 1).toLocaleString()}
          </span>
          <span>
            RESOLVED {data.resolved} THIS PASS
            {data.pending > 0 ? ` · ${data.pending} STILL PENDING — HIT RESOLVE` : ""}
          </span>
        </header>
        <ul className="divide-y divide-border">
          {data.entries.map((entry) => (
            <EntryRow key={entry.blockHeight} entry={entry} />
          ))}
        </ul>
      </div>

      <p className="mt-6 font-mono text-[11px] text-muted-foreground">
        &gt; DECODE A RAW TRANSACTION IN THE{" "}
        <Link to="/extractor" className="text-foreground underline">
          EXTRACTOR
        </Link>{" "}
        TO INDEX CLAIMS THE INDEX HAS NOT PICKED UP YET.
      </p>
    </div>
  );
}
