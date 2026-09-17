import { queryOptions } from "@tanstack/react-query";
import { worldStatsFn, type WorldStats } from "./world-stats.functions";

export type { WorldStats, WorldMetrics, WorldDay } from "./world-stats.functions";

/** Whole-world growth numbers. Aggregates only, safe for anyone to see. */
export const worldStatsQuery = () =>
  queryOptions({
    queryKey: ["world-stats"],
    queryFn: async (): Promise<WorldStats> => worldStatsFn(),
    staleTime: 30_000,
  });

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
