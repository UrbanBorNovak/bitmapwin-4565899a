/**
 * WORLD STATS — aggregate-only numbers about the whole world.
 *
 * The database readers behind this are service-role only on purpose: they scan
 * balances, the BIT ledger and trade history, so they must never be callable
 * straight from a browser. This server function is the only door, and it hands
 * back nothing but totals — no address, no individual balance.
 */

import { createServerFn } from "@tanstack/react-start";

export type WorldMetrics = {
  bitCirculating: number;
  bitEarnedTotal: number;
  bitMinted24h: number;
  holders: number;
  avgGoodsPrice: number;
  goodsTracked: number;
  goodsStock: number;
  goodsVolume24h: number;
  goodsTrades24h: number;
  openListings: number;
  mined24h: number;
  minedTotal: number;
  miners24h: number;
  rigs: number;
  builds: number;
  builds24h: number;
  donatedSats: number;
  donatedBits: number;
};

export type WorldDay = {
  day: string;
  bitMinted: number;
  mined: number;
  tradeVolume: number;
  trades: number;
};

export type WorldStats = { totals: WorldMetrics; daily: WorldDay[] };

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const worldStatsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorldStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [totals, daily] = await Promise.all([
      supabaseAdmin.rpc("world_metrics"),
      supabaseAdmin.rpc("world_metrics_daily", { _days: 14 }),
    ]);
    if (totals.error) throw new Error(totals.error.message);
    if (daily.error) throw new Error(daily.error.message);

    const raw = (totals.data ?? {}) as Record<string, unknown>;
    return {
      totals: {
        bitCirculating: num(raw['bit_circulating']),
        bitEarnedTotal: num(raw['bit_earned_total']),
        bitMinted24h: num(raw['bit_minted_24h']),
        holders: num(raw['holders']),
        avgGoodsPrice: num(raw['avg_goods_price']),
        goodsTracked: num(raw['goods_tracked']),
        goodsStock: num(raw['goods_stock']),
        goodsVolume24h: num(raw['goods_volume_24h']),
        goodsTrades24h: num(raw['goods_trades_24h']),
        openListings: num(raw['open_listings']),
        mined24h: num(raw['mined_24h']),
        minedTotal: num(raw['mined_total']),
        miners24h: num(raw['miners_24h']),
        rigs: num(raw['rigs']),
        builds: num(raw['builds']),
        builds24h: num(raw['builds_24h']),
        donatedSats: num(raw['donated_sats']),
        donatedBits: num(raw['donated_bits']),
      },
      daily: (daily.data ?? []).map((row) => ({
        day: String(row.day),
        bitMinted: num(row.bit_minted),
        mined: num(row.mined),
        tradeVolume: num(row.trade_volume),
        trades: num(row.trades),
      })),
    };
  },
);
