/**
 * Filtering the market registry by an inscribed gallery collection (the punks
 * and the 999 club).
 *
 * The rules live in `bitmap-collections.ts`. Two kinds of data are needed:
 * - transaction count, read in bulk from the pre-computed `block_stats` table;
 * - render square sides, only for the three shape punks, and only for the
 *   two-transaction candidates inside the loaded registry page, fetched from
 *   `/api/public/blocks/<height>?sides=1`.
 *
 * Nothing is estimated: a bitmap only matches once its real shape is in hand.
 */

import { useQuery } from "@tanstack/react-query";
import { blockStatsManyQuery, BLOCK_STATS_MAX_HEIGHT } from "@/lib/block-stats";
import { fetchBlockRenderSides } from "@/lib/block-bytes";
import { GALLERY_COLLECTIONS, type GalleryCollection } from "@/lib/bitmap-collections";

/** Hard cap on per-block shape lookups so a filter click never storms the chain. */
const SHAPE_LOOKUP_LIMIT = 150;

export function galleryById(id: string): GalleryCollection | null {
  return GALLERY_COLLECTIONS.find((c) => c.id === id) ?? null;
}

async function matchingShapeHeights(
  heights: number[],
  sidePair: [number, number],
): Promise<Set<number>> {
  const results = await Promise.all(
    heights.map(async (height) => {
      try {
        const data = await fetchBlockRenderSides(height);
        const sorted = [...data.sides].sort((a, b) => a - b);
        return sorted.length === 2 &&
          sorted[0] === sidePair[0] &&
          sorted[1] === sidePair[1]
          ? height
          : null;
      } catch {
        return null;
      }
    }),
  );
  return new Set(results.filter((h): h is number => h !== null));
}

export type PunkFilter = {
  /** Null when no gallery filter is active. */
  gallery: GalleryCollection | null;
  matches: (height: number) => boolean;
  /** True while the data the rule needs is still being read. */
  loading: boolean;
  /** Number of shape lookups skipped because of the safety cap. */
  skipped: number;
};

/**
 * Builds a membership test for one gallery collection over the loaded registry
 * heights. Pass `null` while no gallery is selected.
 */
export function usePunkFilter(heights: number[], galleryId: string | null): PunkFilter {
  const gallery = galleryId ? galleryById(galleryId) : null;
  const needsTxCount = !!gallery && gallery.maxHeight === undefined;

  const stats = useQuery({
    ...blockStatsManyQuery(needsTxCount ? heights : []),
    enabled: needsTxCount && heights.length > 0,
  });

  const twoTxCandidates: number[] = [];
  if (gallery?.sidePair && stats.data) {
    for (const height of heights) {
      if (height > BLOCK_STATS_MAX_HEIGHT) continue;
      if (stats.data.get(height)?.txCount === 2) twoTxCandidates.push(height);
    }
  }
  const lookups = twoTxCandidates.slice(0, SHAPE_LOOKUP_LIMIT);

  const shapes = useQuery({
    queryKey: ["punk-shape-match", gallery?.id ?? "none", lookups.join(",")],
    queryFn: () => matchingShapeHeights(lookups, gallery?.sidePair as [number, number]),
    enabled: !!gallery?.sidePair && lookups.length > 0,
    staleTime: Infinity,
  });

  if (!gallery) {
    return { gallery: null, matches: () => true, loading: false, skipped: 0 };
  }

  if (gallery.maxHeight !== undefined) {
    const max = gallery.maxHeight;
    return { gallery, matches: (h) => h <= max, loading: false, skipped: 0 };
  }

  if (gallery.sidePair) {
    const matched = shapes.data;
    return {
      gallery,
      matches: (h) => !!matched?.has(h),
      loading: stats.isPending || (lookups.length > 0 && shapes.isPending),
      skipped: Math.max(0, twoTxCandidates.length - lookups.length),
    };
  }

  const want = gallery.txCount;
  return {
    gallery,
    matches: (h) => stats.data?.get(h)?.txCount === want,
    loading: stats.isPending,
    skipped: 0,
  };
}
