import { queryOptions } from "@tanstack/react-query";

/**
 * Live BTC spot price. Read straight from mempool.space — the same source the
 * rest of the app uses for chain data. Nothing is cached server side.
 */
export type BtcPrice = {
  usd: number;
  eur: number;
  /** Percent change against the price seen one poll ago, when available. */
  time: number;
};

export async function fetchBtcPrice(): Promise<BtcPrice> {
  const res = await fetch("https://mempool.space/api/v1/prices", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`PRICE FEED ${res.status}`);
  const json = (await res.json()) as { USD?: number; EUR?: number; time?: number };
  const usd = Number(json.USD ?? 0);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("PRICE FEED EMPTY");
  return { usd, eur: Number(json.EUR ?? 0), time: Number(json.time ?? Date.now() / 1000) };
}

export const btcPriceQuery = () =>
  queryOptions({
    queryKey: ["btc-price"],
    queryFn: fetchBtcPrice,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

export function usdFromSats(sats: number, usdPerBtc: number | undefined): string | null {
  if (!usdPerBtc || !Number.isFinite(usdPerBtc) || sats <= 0) return null;
  const usd = (sats / 100_000_000) * usdPerBtc;
  if (usd >= 1000) return `$${Math.round(usd).toLocaleString("en-US")}`;
  return `$${usd.toFixed(usd < 10 ? 2 : 0)}`;
}
