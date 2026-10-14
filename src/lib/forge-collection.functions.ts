import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

/** Public: verified Land Forge pieces from the master collection (chain-read, cached). */
export const collectionPiecesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { collectionPieces } = await import("@/lib/forge-collection.server");
  return collectionPieces().catch(() => []);
});

export type FundStats = { receivedSats: number; payments: number; pendingSats: number };

/** Public: live totals received by the site donation address, straight from the chain. */
export const siteFundFn = createServerFn({ method: "GET" }).handler(async (): Promise<FundStats | null> => {
  const { DONATION_ADDRESS } = await import("@/lib/donations");
  try {
    const r = await fetch(`https://mempool.space/api/address/${DONATION_ADDRESS}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const a = (await r.json()) as { chain_stats: { funded_txo_sum: number; funded_txo_count: number }; mempool_stats: { funded_txo_sum: number } };
    return { receivedSats: a.chain_stats.funded_txo_sum, payments: a.chain_stats.funded_txo_count, pendingSats: a.mempool_stats.funded_txo_sum };
  } catch { return null; }
});

export const siteFundQuery = () => queryOptions({ queryKey: ["site-fund"], queryFn: () => siteFundFn(), staleTime: 60_000, refetchInterval: 60_000 });
export const collectionPiecesQuery = () => queryOptions({ queryKey: ["forge-collection"], queryFn: () => collectionPiecesFn(), staleTime: 30 * 60_000 });
