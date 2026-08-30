import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BitmapCard } from "@/components/BitmapCard";
import { bitmapsQuery } from "@/lib/bitmap-queries";
import type { Bitmap } from "@/lib/bitmap";

type Filter = "ALL" | "FOR SALE" | "OWNED" | "UNCLAIMED";
type Sort = "NEWEST" | "LOWEST PRICE" | "HIGHEST PRICE" | "BLOCK NUMBER";

export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const raw = search["q"];
    return typeof raw === "string" && raw.length > 0 ? { q: raw } : {};
  },

  head: () => ({
    meta: [
      { title: "Explore Bitmaps — Bitmap Marketplace" },
      {
        name: "description",
        content: "Search the Bitmap registry by block number, inscription or owner address.",
      },
      { property: "og:title", content: "Explore Bitmaps — Bitmap Marketplace" },
      {
        property: "og:description",
        content: "Search the Bitmap registry by block number, inscription or owner address.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bitmapsQuery(200)),
  component: Explore,
});

const FILTERS: Filter[] = ["ALL", "FOR SALE", "OWNED", "UNCLAIMED"];
const SORTS: Sort[] = ["NEWEST", "LOWEST PRICE", "HIGHEST PRICE", "BLOCK NUMBER"];

function Explore() {
  const { q } = Route.useSearch();
  const { data: bitmaps } = useSuspenseQuery(bitmapsQuery(200));
  const [term, setTerm] = useState(q ?? "");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("NEWEST");

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    let out: Bitmap[] = bitmaps.filter((b) => {
      if (filter === "FOR SALE" && b.status !== "for_sale") return false;
      if (filter === "OWNED" && b.status !== "owned") return false;
      if (filter === "UNCLAIMED" && b.status !== "unclaimed") return false;
      if (!needle) return true;
      return (
        String(b.block_height).includes(needle) ||
        (b.inscription_id ?? "").toLowerCase().includes(needle) ||
        (b.owner_address ?? "").toLowerCase().includes(needle)
      );
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "LOWEST PRICE":
          return (a.price_btc ?? Infinity) - (b.price_btc ?? Infinity);
        case "HIGHEST PRICE":
          return (b.price_btc ?? -1) - (a.price_btc ?? -1);
        case "BLOCK NUMBER":
          return a.block_height - b.block_height;
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return out;
  }, [bitmaps, term, filter, sort]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">EXPLORE BITMAPS</h1>
      <p className="label mt-3">{rows.length} PARCELS INDEXED</p>

      <div className="mt-8 border border-border">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search block number, inscription or owner..."
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

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((b) => (
          <BitmapCard key={b.id} bitmap={b} dense />
        ))}
      </div>

      {rows.length === 0 && (
        <div className="mt-12 border border-border p-8 font-mono text-sm text-muted-foreground">
          &gt; NO MATCHING PARCELS<span className="blink">_</span>
        </div>
      )}
    </div>
  );
}
