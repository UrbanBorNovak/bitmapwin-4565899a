import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

/** Public: verified Land Forge pieces from the master collection (chain-read, cached). */
export const collectionPiecesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { collectionPieces } = await import("@/lib/forge-collection.server");
  return collectionPieces().catch(() => []);
});

export type FundStats = { lifetimeSats: number; monthSats: number; monthPayments: number; pendingSats: number; monthComplete: boolean };

type Tx = { txid: string; status: { confirmed: boolean; block_time?: number }; vout: { scriptpubkey_address?: string; value: number }[] };

/** Public: live totals received by the site donation address, straight from the chain. */
export const siteFundFn = createServerFn({ method: "GET" }).handler(async (): Promise<FundStats | null> => {
  const { DONATION_ADDRESS } = await import("@/lib/donations");
  const API = "https://mempool.space/api";
  try {
    const r = await fetch(`${API}/address/${DONATION_ADDRESS}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const a = (await r.json()) as { chain_stats: { funded_txo_sum: number }; mempool_stats: { funded_txo_sum: number } };
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
    let monthSats = 0, monthPayments = 0, monthComplete = false, last = "";
    for (let page = 0; page < 8 && !monthComplete; page++) {
      const res = await fetch(`${API}/address/${DONATION_ADDRESS}/txs/chain${last ? `/${last}` : ""}`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) break;
      const txs = (await res.json()) as Tx[];
      if (!txs.length) { monthComplete = true; break; }
      for (const tx of txs) {
        if ((tx.status.block_time ?? 0) < start) { monthComplete = true; break; }
        const got = tx.vout.filter((o) => o.scriptpubkey_address === DONATION_ADDRESS).reduce((n, o) => n + o.value, 0);
        if (got > 0) { monthSats += got; monthPayments++; }
      }
      last = txs[txs.length - 1]!.txid;
      if (txs.length < 25) monthComplete = true;
    }
    return { lifetimeSats: a.chain_stats.funded_txo_sum, monthSats, monthPayments, pendingSats: a.mempool_stats.funded_txo_sum, monthComplete };
  } catch { return null; }
});

export const siteFundQuery = () => queryOptions({ queryKey: ["site-fund"], queryFn: () => siteFundFn(), staleTime: 60_000, refetchInterval: 60_000 });
export const collectionPiecesQuery = () => queryOptions({ queryKey: ["forge-collection"], queryFn: () => collectionPiecesFn(), staleTime: 30 * 60_000 });
