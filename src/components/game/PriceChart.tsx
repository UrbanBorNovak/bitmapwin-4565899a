/**
 * PRICE MOVEMENT — the little chart on the trading post counter. It reads the
 * shared trade log, buckets it by the hour and draws where an item's price has
 * been going. No trades yet means no line, just a quiet note.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { goodsTradesQuery } from "@/lib/goods-market";
import { ITEM_LABELS, type ItemId } from "@/lib/world-skills";

type Point = { t: number; label: string; price: number };

function bucketize(
  trades: { itemId: ItemId; unitPrice: number; createdAt: string }[],
  itemId: ItemId,
  hours: number,
): Point[] {
  const cutoff = Date.now() - hours * 3_600_000;
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const trade of trades) {
    if (trade.itemId !== itemId) continue;
    const at = new Date(trade.createdAt).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;
    const key = Math.floor(at / 3_600_000);
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += trade.unitPrice;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, bucket]) => {
      const t = key * 3_600_000;
      return {
        t,
        label: new Date(t).toUTCString().slice(17, 22),
        price: Math.round(bucket.sum / bucket.count),
      };
    });
}

export function PriceChart({
  itemId,
  livePrice,
  hours = 48,
}: {
  itemId: ItemId;
  livePrice: number;
  hours?: number;
}) {
  const trades = useQuery(goodsTradesQuery(400));

  const points = useMemo(() => {
    const series = bucketize(trades.data ?? [], itemId, hours);
    const now = { t: Date.now(), label: "NOW", price: livePrice };
    if (series.length === 0) return [{ ...now, label: "OPEN" }, now];
    return [...series, now];
  }, [trades.data, itemId, hours, livePrice]);

  const first = points[0]?.price ?? livePrice;
  const move = first > 0 ? livePrice / first - 1 : 0;
  const rising = move >= 0;

  return (
    <div className="border border-border">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label">{ITEM_LABELS[itemId] ?? itemId} — PRICE MOVEMENT</span>
        <span className={`label ${rising ? "text-bitcoin" : "text-muted-foreground"}`}>
          {rising ? "▲" : "▼"} {Math.abs(move * 100).toFixed(1)}% / {hours}H
        </span>
      </header>
      <div className="h-28 w-full px-1 py-2">
        {trades.isLoading ? (
          <p className="p-2 font-mono text-[10px] text-muted-foreground">LOADING TRADE LOG…</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-bitcoin)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-bitcoin)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fontFamily: "monospace" }}
                stroke="var(--color-border)"
                interval="preserveStartEnd"
              />
              <YAxis
                width={34}
                tick={{ fontSize: 9, fontFamily: "monospace" }}
                stroke="var(--color-border)"
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "monospace",
                  fontSize: 10,
                }}
                formatter={(value: number) => [`${value} BIT`, "PRICE"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--color-bitcoin)"
                strokeWidth={1.5}
                fill="url(#priceFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
