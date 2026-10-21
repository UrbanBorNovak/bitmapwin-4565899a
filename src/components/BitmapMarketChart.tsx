import { useMemo, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { paidSalesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

type Range = "30D" | "90D" | "ALL";
type SalePoint = { t: number; sats: number; height: number; txid: string };

const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "30D": 30, "90D": 90 };

function smoothPath(coords: Array<{ x: number; y: number }>) {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M${coords[0]?.x ?? 0},${coords[0]?.y ?? 0}`;

  return coords.slice(0, -1).reduce((path, point, index) => {
    const previous = coords[Math.max(0, index - 1)] ?? point;
    const next = coords[index + 1] ?? point;
    const afterNext = coords[Math.min(coords.length - 1, index + 2)] ?? next;
    const controlOneX = point.x + (next.x - previous.x) / 6;
    const controlOneY = point.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (afterNext.x - point.x) / 6;
    const controlTwoY = next.y - (afterNext.y - point.y) / 6;
    return `${path} C${controlOneX.toFixed(1)},${controlOneY.toFixed(1)} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }, `M${coords[0]?.x.toFixed(1)},${coords[0]?.y.toFixed(1)}`);
}

/** Aggregate price history across every confirmed, paid Bitmap transfer in the trade index. */
export function BitmapMarketChart() {
  const trades = useQuery(paidSalesQuery());
  const [range, setRange] = useState<Range>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
      line: smoothPath(coords),
      minTime,
      maxTime,
    };
  }, [points]);

  const hoverPoint = hoverIndex === null ? null : geometry?.coords[hoverIndex] ?? null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!geometry || geometry.coords.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    geometry.coords.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setHoverIndex(closestIndex);
  };

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
            <div className="mb-2 flex min-h-8 items-center justify-between gap-3 font-mono text-[10px] uppercase">
              <span className="text-muted-foreground">HOVER TO TRACE THE MARKET</span>
              <span className={`text-right transition-opacity ${hoverPoint ? "opacity-100" : "opacity-0"}`} aria-live="polite">
                {hoverPoint
                  ? `${hoverPoint.height}.BITMAP · ${formatSats(hoverPoint.sats)} · ${new Date(hoverPoint.t).toISOString().slice(0, 10)}`
                  : "NO POINT SELECTED"}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="bitmap-market-line h-[260px] w-full touch-none"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Total Bitmap sale-price history with ${points.length} confirmed sales`}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="bitmap-line-gradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.35" />
                  <stop offset="0.52" stopColor="var(--color-primary)" stopOpacity="0.78" />
                  <stop offset="1" stopColor="var(--color-primary)" />
                </linearGradient>
                <linearGradient id="bitmap-area-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.22" />
                  <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
                <filter id="bitmap-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
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
                d={`${geometry.line} L${geometry.coords[geometry.coords.length - 1]?.x ?? width - pad.right},${height - pad.bottom} L${geometry.coords[0]?.x ?? pad.left},${height - pad.bottom} Z`}
                fill="url(#bitmap-area-gradient)"
                className="pointer-events-none transition-opacity duration-300"
                opacity={hoverPoint ? 0.9 : 0.55}
              />
              <path
                d={geometry.line}
                fill="none"
                className="bitmap-market-line__trail pointer-events-none"
                stroke="var(--color-primary)"
                strokeOpacity={hoverPoint ? 0.22 : 0.12}
                strokeWidth={9}
                filter="url(#bitmap-line-glow)"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={geometry.line}
                fill="none"
                className="bitmap-market-line__stroke pointer-events-none"
                stroke="url(#bitmap-line-gradient)"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
              {geometry.coords.map((point) => (
                <circle
                  key={point.key}
                  cx={point.x}
                  cy={point.y}
                  r={hoverPoint?.key === point.key ? 6 : 2.5}
                  className="fill-primary transition-all duration-200"
                  opacity={hoverPoint && hoverPoint.key !== point.key ? 0.22 : 1}
                >
                  <title>{`${point.height}.BITMAP · ${formatSats(point.sats)} · ${new Date(point.t).toISOString().slice(0, 10)}`}</title>
                </circle>
              ))}
              {hoverPoint && (
                <g className="pointer-events-none">
                  <line
                    x1={hoverPoint.x}
                    x2={hoverPoint.x}
                    y1={pad.top}
                    y2={height - pad.bottom}
                    stroke="var(--color-primary)"
                    strokeDasharray="4 7"
                    strokeOpacity="0.45"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={hoverPoint.x} cy={hoverPoint.y} r={12} fill="none" stroke="var(--color-primary)" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />
                  <circle cx={hoverPoint.x} cy={hoverPoint.y} r={5} fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              )}
              <rect x="0" y="0" width={width} height={height} fill="transparent" />
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