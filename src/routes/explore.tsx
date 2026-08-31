import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChainBlockCard } from "@/components/ChainBlockCard";
import { getChainBlocks } from "@/lib/chain.functions";
import type { ChainBlock } from "@/lib/chain";

type Filter = "ALL" | "VALID BITMAPS" | "UNCLAIMED" | "WITH INSCRIPTIONS" | "NO INSCRIPTIONS";
type Sort = "NEWEST" | "OLDEST" | "MOST INSCRIPTIONS" | "MOST TXS";

export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const raw = search["q"];
    return typeof raw === "string" && raw.length > 0 ? { q: raw } : {};
  },

  head: () => ({
    meta: [
      { title: "Explore Bitmaps — Live Bitcoin Blocks" },
      {
        name: "description",
        content:
          "Explore live Bitcoin blocks and the inscriptions committed in each one, indexed from public chain and ordinals APIs.",
      },
      { property: "og:title", content: "Explore Bitmaps — Live Bitcoin Blocks" },
      {
        property: "og:description",
        content:
          "Explore live Bitcoin blocks and the inscriptions committed in each one, indexed from public chain and ordinals APIs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});

const FILTERS: Filter[] = [
  "ALL",
  "VALID BITMAPS",
  "UNCLAIMED",
  "WITH INSCRIPTIONS",
  "NO INSCRIPTIONS",
];
const SORTS: Sort[] = ["NEWEST", "OLDEST", "MOST INSCRIPTIONS", "MOST TXS"];

function Explore() {
  const { q } = Route.useSearch();
  const fetchBlocks = useServerFn(getChainBlocks);
  const [pages, setPages] = useState(2);
  const [term, setTerm] = useState(q ?? "");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("NEWEST");

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["chain-blocks", pages],
    queryFn: () => fetchBlocks({ data: { pages } }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const blocks = data ?? [];

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const out: ChainBlock[] = blocks.filter((b) => {
      if (filter === "WITH INSCRIPTIONS" && b.inscriptionCount === 0) return false;
      if (filter === "NO INSCRIPTIONS" && b.inscriptionCount > 0) return false;
      if (filter === "VALID BITMAPS" && b.bitmapStatus !== "valid") return false;
      if (filter === "UNCLAIMED" && b.bitmapStatus === "valid") return false;
      if (!needle) return true;
      return (
        String(b.height).includes(needle) ||
        b.hash.toLowerCase().includes(needle) ||
        (b.miner ?? "").toLowerCase().includes(needle) ||
        b.sampleInscriptions.some((id) => id.toLowerCase().includes(needle)) ||
        (b.bitmapInscriptionId ?? "").toLowerCase().includes(needle)
      );
    });
    return [...out].sort((a, b) => {
      switch (sort) {
        case "OLDEST":
          return a.height - b.height;
        case "MOST INSCRIPTIONS":
          return b.inscriptionCount - a.inscriptionCount;
        case "MOST TXS":
          return b.txCount - a.txCount;
        default:
          return b.height - a.height;
      }
    });
  }, [blocks, term, filter, sort]);

  const totalInscriptions = blocks.reduce((sum, b) => sum + b.inscriptionCount, 0);
  const validBitmaps = blocks.filter((b) => b.bitmapStatus === "valid").length;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">EXPLORE BITMAPS</h1>
      <p className="label mt-3">
        {isPending
          ? "SYNCING CHAIN..."
          : `${rows.length} BLOCKS · ${validBitmaps} VALID BITMAPS · ${totalInscriptions.toLocaleString("en-US")} INSCRIPTIONS · LIVE FROM MEMPOOL.SPACE + ORDINALS.COM`}
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        &gt; BITMAP THEORY: A BLOCK&apos;S BITMAP IS THE FIRST PLAIN-TEXT
        &nbsp;&lt;HEIGHT&gt;.BITMAP&nbsp; INSCRIPTION EVER MADE. LATER DUPLICATES ARE INVALID.
      </p>

      <div className="mt-8 border border-border">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search block height, block hash, miner or inscription id..."
          className="w-full bg-background px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-col gap-4 border-t border-border p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={f === filter ? "btn-term !px-3 !py-2" : "btn-term-ghost !px-3 !py-2"}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="label self-center">SORT</span>
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={s === sort ? "btn-term !px-3 !py-2" : "btn-term-ghost !px-3 !py-2"}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isError && (
        <div className="mt-8 border border-border p-6 font-mono text-sm">
          <p>&gt; CHAIN INDEXER UNREACHABLE</p>
          <p className="mt-2 text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button className="btn-term mt-4 !px-3 !py-2" onClick={() => void refetch()}>
            RETRY
          </button>
        </div>
      )}

      {isPending && (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[340px] animate-pulse border border-border bg-card" />
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((b) => (
          <ChainBlockCard key={b.hash} block={b} />
        ))}
      </div>

      {!isPending && rows.length === 0 && (
        <div className="mt-12 border border-border p-8 font-mono text-sm text-muted-foreground">
          &gt; NO MATCHING BLOCKS<span className="blink">_</span>
        </div>
      )}

      {!isPending && pages < 6 && (
        <div className="mt-8 flex justify-center">
          <button
            className="btn-term !px-5 !py-3"
            disabled={isFetching}
            onClick={() => setPages((p) => Math.min(6, p + 2))}
          >
            {isFetching ? "LOADING..." : "LOAD OLDER BLOCKS"}
          </button>
        </div>
      )}
    </div>
  );
}
