/**
 * Gallery membership (999 Club + punk shapes) for every BITMAP that appears in
 * the live book, tape and sales history. Read from indexed block records only:
 * tx counts from block_stats, renderer sides from /api/public/blocks/<h>?sides=1.
 * A BITMAP without a record never matches; it is counted as "missing" instead.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { offersQuery } from "@/lib/offers";
import { openBidsQuery } from "@/lib/bids";
import { fetchRecentTrades, paidSalesQuery } from "@/lib/trade-store";
import { BLOCK_STATS_MAX_HEIGHT, fetchBlockStatsMany } from "@/lib/block-stats";
import { fetchBlockRenderSides } from "@/lib/block-bytes";
import { GALLERY_COLLECTIONS, galleriesFor } from "@/lib/bitmap-collections";

const SIDE_LOOKUP_LIMIT = 150;

export type GalleryIndex = {
  match: (galleryId: string, h: number) => boolean;
  /** Market heights the gallery rule could not judge (no record / over cap). */
  missing: (galleryId: string) => number;
  loading: boolean;
  error: boolean;
};

export function useGalleryIndex(): GalleryIndex {
  const offers = useQuery(offersQuery());
  const bids = useQuery(openBidsQuery(500));
  const tape = useQuery({ queryKey: ["live-trades-feed"], queryFn: () => fetchRecentTrades(150), staleTime: 15_000, refetchInterval: 60_000 });
  const paid = useQuery(paidSalesQuery());

  const heights = useMemo(() => {
    const s = new Set<number>();
    for (const o of offers.data ?? []) if (o.bitmapHeight !== null) s.add(o.bitmapHeight);
    for (const b of bids.data ?? []) if (b.bitmapHeight !== null) s.add(b.bitmapHeight);
    for (const t of tape.data ?? []) if (t.bitmap_height !== null) s.add(t.bitmap_height);
    for (const t of (paid.data ?? []) as { bitmap_height: number | null }[]) if (t.bitmap_height !== null) s.add(t.bitmap_height);
    return [...s].sort((a, b) => a - b);
  }, [offers.data, bids.data, tape.data, paid.data]);
  const indexable = heights.filter((h) => h > 999 && h <= BLOCK_STATS_MAX_HEIGHT);
  const live = heights.filter((h) => h > BLOCK_STATS_MAX_HEIGHT);

  const stats = useQuery({
    queryKey: ["gallery-index-stats", indexable.join(",")],
    enabled: indexable.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const out = new Map<number, number>();
      for (let i = 0; i < indexable.length; i += 200) {
        const m = await fetchBlockStatsMany(indexable.slice(i, i + 200));
        for (const [h, s] of m) out.set(h, s.txCount);
      }
      return out;
    },
  });
  // Blocks above the imported dataset: read the real tx count from the
  // block header (immutable, CDN-cached). Failed reads stay "missing".
  const liveStats = useQuery({
    queryKey: ["gallery-index-live", live.join(",")],
    enabled: live.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const out = new Map<number, number>();
      let cursor = 0;
      const worker = async () => {
        while (cursor < live.length) {
          const h = live[cursor++]!;
          try {
            const r = await fetch(`/api/public/blocks/${h}/meta`);
            if (!r.ok) continue;
            const m = (await r.json()) as { txCount?: number };
            if (typeof m.txCount === "number" && m.txCount > 0) out.set(h, m.txCount);
          } catch { /* missing */ }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      return out;
    },
  });
  const txOf = (h: number) => stats.data?.get(h) ?? liveStats.data?.get(h);
  const twoTx = heights.filter((h) => h > 999 && txOf(h) === 2);
  const lookups = twoTx.slice(0, SIDE_LOOKUP_LIMIT);
  const sides = useQuery({
    queryKey: ["gallery-index-sides", lookups.join(",")],
    enabled: lookups.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const out = new Map<number, number[]>();
      await Promise.all(lookups.map(async (h) => { try { out.set(h, (await fetchBlockRenderSides(h)).sides); } catch { /* missing */ } }));
      return out;
    },
  });

  return useMemo(() => {
    const members = new Map<string, Set<number>>(GALLERY_COLLECTIONS.map((g) => [g.id, new Set<number>()]));
    const miss = new Map<string, number>(GALLERY_COLLECTIONS.map((g) => [g.id, 0]));
    for (const h of heights) {
      const tx = h <= 999 ? null : stats.data?.get(h) ?? liveStats.data?.get(h) ?? null;
      for (const g of galleriesFor(h, tx, sides.data?.get(h) ?? null)) members.get(g.id)!.add(h);
      if (h <= 999) continue;
      for (const g of GALLERY_COLLECTIONS) {
        if (g.maxHeight !== undefined) continue;
        const unknownTx = tx === null;
        const unknownSides = !!g.sidePair && tx === 2 && !sides.data?.has(h);
        if (unknownTx || unknownSides) miss.set(g.id, miss.get(g.id)! + 1);
      }
    }
    return {
      match: (id, h) => !!members.get(id)?.has(h),
      missing: (id) => miss.get(id) ?? 0,
      loading: offers.isPending || stats.isFetching || sides.isFetching || liveStats.isFetching,
      error: stats.isError,
    };
  }, [heights, stats.data, liveStats.data, sides.data, offers.isPending, stats.isFetching, sides.isFetching, liveStats.isFetching, stats.isError]);
}
