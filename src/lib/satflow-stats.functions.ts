import { createServerFn } from "@tanstack/react-start";

export type SatflowStats = {
  floorSats: number | null;
  topBidSats: number | null;
  floor7dPct: number | null;
  volume7dSats: number | null;
  sales7d: number | null;
  supply: number | null;
  listed: number | null;
  marketCapBtc: number | null;
  updatedAt: number | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Public Bitmap collection stats as reported by Satflow (a third-party venue, not L1 proof). */
export const satflowStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<SatflowStats | null> => {
  try {
    const input = encodeURIComponent(JSON.stringify({ json: { type: "ordinals", slug: "bitmap" } }));
    const res = await fetch(`https://backend.satflow.com/trpc/collectionStats.collectionMemflow?input=${input}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json())?.result?.data?.json;
    if (!j) return null;
    return {
      floorSats: num(j.floorPrice),
      topBidSats: num(j.topBid),
      floor7dPct: num(j.floor7dChangePercent),
      volume7dSats: num(j.volume7d),
      sales7d: num(j.sales7d),
      supply: num(j.metadata?.total_items),
      listed: num(j.totalListed),
      marketCapBtc: num(j.marketCap),
      updatedAt: num(j.statisticsUpdatedAt),
    };
  } catch {
    return null;
  }
});
