import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

type Range = "30D" | "90D" | "ALL";
type SalePoint = { t: number; sats: number; height: number; txid: string };

const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "30D": 30, "90D": 90 };

/** Aggregate price history across every confirmed, paid Bitmap transfer in the trade index. */
export function BitmapMarketChart() {
  const trades = useQuery(recentTradesQuery(1000));
  const [range, setRange] = useState<Range>("ALL");

  const allPoints = useMemo<SalePoint[]>(
    () =>
      (trades.data ?? [])
        .filter((row) => row.price_sats > 0)
        .map((row) => ({
          t: new Date(row.block_time ?? row.created_at).getTime(),
          sats: row.price_sats,
          height: row.bitmap_height,
          txid: row.txid,
        }))
        .filter((point) => Number.isFinite(point.t))
        .sort((a, b) => a.t - b.t),
    [trades.data],
  );

  const points = useMemo(() => {
    if (range === "ALL" || allPoints.length === 0) return allPoints;
    const newest = allPoints[allPoints.length - 1]?.t ?? Date.now();
    const cutoff = newest - RANGE_DAYS[range] * 86_400_000;
    return allPoints.filter((point) => point.t >= cutoff);
  }, [allPoints, range]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const prices = points.map((point) => point.sats).sort((a, b) => a - b);
    const total = prices.reduce((sum, price) => sum + price, 0);
    const middle = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? Math.round(((prices[middle - 1] ?? 0) + (prices[middle] ?? 0)) / 2)
        : (prices[middle] ?? 0);
    return {
      last: points[points.length - 1]?.sats ?? 0,
      floor: prices[0] ?? 0,
      median,
      volume: total,
    };
  }, [points]);

  const width = 1000;
  const height = 280;
  const pad = { left: 16, right: 16, top: 18, bottom: 28 };
  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const minTime = points[0]?.t ?? 0;
    const maxTime = points[points.length - 1]?.t ?? minTime;
    const values = points.map((point) => point.sats);
    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    const timeSpan = Math.max(1, maxTime - minTime);
    const priceSpan = Math.max(1, maxPrice - minPrice);
    const coords = points.map((point, index) => ({
      ...point,
      x:
        points.length === 1
          ? width / 2
          : pad.left + ((point.t - minTime) / timeSpan) * (width - pad.left - pad.right),
      y: pad.top + (1 - (point.sats - minPrice) / priceSpan) * (height - pad.top - pad.bottom),
      key: `${point.txid}-${index}`,
    }));
    return {
      coords,
      line: coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
      minTime,
      maxTime,
    };
  }, [points]);

  return (
    <section className="h-full border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div className="border-l-2 border-primary pl-3">
          <h2 className="font-mono text-sm font-bold uppercase text-foreground">TOTAL BITMAP PRICE</h2>
          <p className="label mt-1">CONFIRMED ON-CHAIN SALES · BTC</p>
        </div>
        <div className="flex border border-border" aria-label="Chart range">
          {(["30D", "90D", "ALL"] as const).map((value) => (
            <button
              key={value}
              className={`px-3 py-2 font-mono text-[10px] transition-colors ${
                range === value ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setRange(value)}
              aria-pressed={range === value}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {stats && geometry ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
            <Metric label="LAST" value={formatSats(stats.last)} />
            <Metric label="FLOOR" value={formatSats(stats.floor)} />
            <Metric label="MEDIAN" value={formatSats(stats.median)} />
            <Metric label="TOTAL VOLUME" value={formatSats(stats.volume)} accent />
          </div>
          <div className="p-4">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[260px] w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Total Bitmap sale-price history with ${points.length} confirmed sales`}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <line
                  key={fraction}
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={pad.top + fraction * (height - pad.top - pad.bottom)}
                  y2={pad.top + fraction * (height - pad.top - pad.bottom)}
                  className="text-border"
                  stroke="currentColor"
                  strokeWidth={1}
                />
              ))}
              <path
                d={geometry.line}
                fill="none"
                className="text-primary"
                stroke="currentColor"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
              {geometry.coords.map((point) => (
                <circle key={point.key} cx={point.x} cy={point.y} r={3.5} className="fill-primary">
                  <title>{`${point.height}.BITMAP · ${formatSats(point.sats)} · ${new Date(point.t).toISOString().slice(0, 10)}`}</title>
                </circle>
              ))}
            </svg>
            <div className="label flex justify-between border-t border-border pt-3">
              <span>{new Date(geometry.minTime).toISOString().slice(0, 10)}</span>
              <span>{points.length} SALE{points.length === 1 ? "" : "S"}</span>
              <span>{new Date(geometry.maxTime).toISOString().slice(0, 10)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-[330px] items-center justify-center p-6">
          <span className="label">
            {trades.isPending ? "READING CONFIRMED SALES…" : `NO CONFIRMED SALES IN ${range}`}
          </span>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3">
      <div className="label">{label}</div>
      <div className={`mt-1 font-mono text-xs font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}