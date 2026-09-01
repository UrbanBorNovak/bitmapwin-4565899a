import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pre-computed per-block stats for the first 840,000 bitmaps, imported from the
 * bitlodo/bitmap-utils bitmaps database (db-v1.0). Every row is derived from
 * real block data: the transaction count (which caps the number of valid
 * parcels), the pre-calculated preview size used to place a bitmap on a 2D map,
 * and a shape pattern group ("bitmon") shared by blocks that render alike.
 */

export type BlockStats = {
  blockHeight: number;
  /** Transactions in the block = maximum number of valid parcels. */
  txCount: number;
  previewWidth: number;
  previewHeight: number;
  /** Shape group id; blocks sharing it pack into the same silhouette. */
  pattern: number | null;
};

/** Highest block height covered by the imported dataset. */
export const BLOCK_STATS_MAX_HEIGHT = 839_999;

type Row = {
  block_height: number;
  tx_count: number;
  preview_width: number;
  preview_height: number;
  pattern: number | null;
};

function toStats(row: Row): BlockStats {
  return {
    blockHeight: Number(row.block_height),
    txCount: row.tx_count,
    previewWidth: row.preview_width,
    previewHeight: row.preview_height,
    pattern: row.pattern,
  };
}

export async function fetchBlockStats(height: number): Promise<BlockStats | null> {
  const { data, error } = await supabase
    .from("block_stats")
    .select("block_height, tx_count, preview_width, preview_height, pattern")
    .eq("block_height", height)
    .maybeSingle();
  if (error) throw error;
  return data ? toStats(data as Row) : null;
}

export async function fetchBlockStatsMany(heights: number[]): Promise<Map<number, BlockStats>> {
  const list = [...new Set(heights.filter((h) => Number.isFinite(h)))].slice(0, 1000);
  if (list.length === 0) return new Map();
  const { data, error } = await supabase
    .from("block_stats")
    .select("block_height, tx_count, preview_width, preview_height, pattern")
    .in("block_height", list);
  if (error) throw error;
  const map = new Map<number, BlockStats>();
  for (const row of data ?? []) {
    const stats = toStats(row as Row);
    map.set(stats.blockHeight, stats);
  }
  return map;
}

/** How many other blocks render in the same shape group. */
export async function fetchPatternSiblings(pattern: number): Promise<number> {
  const { count, error } = await supabase
    .from("block_stats")
    .select("block_height", { count: "exact", head: true })
    .eq("pattern", pattern);
  if (error) throw error;
  return Math.max(0, (count ?? 1) - 1);
}

export const blockStatsQuery = (height: number) =>
  queryOptions({
    queryKey: ["block-stats", height],
    queryFn: () => fetchBlockStats(height),
    enabled: height >= 0 && height <= BLOCK_STATS_MAX_HEIGHT,
    staleTime: Infinity,
  });

export const blockStatsManyQuery = (heights: number[]) =>
  queryOptions({
    queryKey: ["block-stats-many", [...heights].sort((a, b) => a - b).join(",")],
    queryFn: () => fetchBlockStatsMany(heights),
    enabled: heights.length > 0,
    staleTime: Infinity,
  });

export const patternSiblingsQuery = (pattern: number | null | undefined) =>
  queryOptions({
    queryKey: ["block-stats-pattern", pattern ?? -1],
    queryFn: () => fetchPatternSiblings(pattern as number),
    enabled: typeof pattern === "number",
    staleTime: Infinity,
  });
