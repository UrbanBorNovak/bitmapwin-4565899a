import { useMemo, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { tradesInRangeQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import type { Club } from "@/lib/clubs";
import { inClub } from "@/lib/clubs";

type Point = { t: number; sats: number; height: number; txid: string };

function smoothPath(coords: Array<{ cx: number; cy: number }>) {
  if (coords.length === 0) return "";
  const first = coords[0];
  if (!first) return "";
  if (coords.length === 1) return `M${first.cx},${first.cy}`;
  return coords.slice(0, -1).reduce((path, point, index) => {
    const previous = coords[Math.max(0, index - 1)] ?? point;
    const next = coords[index + 1] ?? point;
    const afterNext = coords[Math.min(coords.length - 1, index + 2)] ?? next;
    const c1x = point.cx + (next.cx - previous.cx) / 6;
    const c1y = point.cy + (next.cy - previous.cy) / 6;
    const c2x = next.cx - (afterNext.cx - point.cx) / 6;
    const c2y = next.cy - (afterNext.cy - point.cy) / 6;
    return `${path} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${next.cx.toFixed(1)},${next.cy.toFixed(1)}`;
  }, `M${first.cx.toFixed(1)},${first.cy.toFixed(1)}`);
}

/**
 * Sale-price history for one club, drawn from confirmed on-chain trades only
 * (rows in `trades` where the spending transaction paid the previous holder).
 */
export function ClubPriceChart({ club }: { club: Club }) {
  const trades = useQuery(tradesInRangeQuery(club.min, club.max));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo<Point[]>(() => {
    const rows = trades.data ?? [];
    return rows
      .filter((r) => r.price_sats > 0 && inClub(r.bitmap_height, club))
      .map((r) => ({
        t: new Date(r.block_time ?? r.created_at).getTime(),
        sats: r.price_sats,
        height: r.bitmap_height,
        txid: r.txid,
      }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
  }, [trades.data, club]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.sats);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const last = points[points.length - 1]!.sats;
    const first = points[0]!.sats;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    return { low, high, avg, last, change };
  }, [points]);

  const W = 1000;
  const H = 260;
  const PAD = { l: 8, r: 8, t: 16, b: 22 };

  const geom = useMemo(() => {
    if (points.length === 0 || !stats) return null;
    const minT = points[0]!.t;
    const maxT = points[points.length - 1]!.t;
    const spanT = Math.max(1, maxT - minT);
    const minV = stats.low === stats.high ? stats.low * 0.9 : stats.low;
    const maxV = stats.low === stats.high ? stats.high * 1.1 : stats.high;
    const spanV = Math.max(1, maxV - minV);
    const x = (t: number) =>
      PAD.l + ((t - minT) / spanT) * (W - PAD.l - PAD.r) * (points.length === 1 ? 0 : 1);
    const y = (v: number) => PAD.t + (1 - (v - minV) / spanV) * (H - PAD.t - PAD.b);
    const coords = points.map((p) => ({ ...p, cx: points.length === 1 ? W / 2 : x(p.t), cy: y(p.sats) }));
    const line = smoothPath(coords);
    const area = `${line} L${coords[coords.length - 1]!.cx.toFixed(1)},${H - PAD.b} L${coords[0]!.cx.toFixed(1)},${H - PAD.b} Z`;
    return { coords, line, area, avgY: y(stats.avg), minT, maxT };
  }, [points, stats]);

  const hoverPoint = hoverIndex === null ? null : geom?.coords[hoverIndex] ?? null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!geom || geom.coords.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * W;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    geom.coords.forEach((point, index) => {
      const distance = Math.abs(point.cx - pointerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setHoverIndex(closestIndex);
  };

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="border-l-2 border-primary pl-3">
          <h2 className="font-mono text-sm font-bold uppercase text-foreground">PRICE HISTORY</h2>
          <p className="label mt-1">CONFIRMED ON-CHAIN SALES · BTC</p>
        </div>
        <span className="label">
          {trades.isPending
            ? "LOADING CONFIRMED SALES…"
            : `${points.length} CONFIRMED SALE${points.length === 1 ? "" : "S"} · ${club.short}`}
        </span>
      </header>

      {stats ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
            <Metric k="LAST" v={formatSats(stats.last)} />
            <Metric k="LOW" v={formatSats(stats.low)} />
            <Metric k="HIGH" v={formatSats(stats.high)} />
            <Metric
              k="CHANGE"
              v={`${stats.change >= 0 ? "+" : ""}${stats.change.toFixed(1)}%`}
              accent={stats.change >= 0}
            />
          </div>

          <div className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between gap-3 font-mono text-[10px] uppercase">
              <span className="text-muted-foreground">HOVER TO TRACE {club.short}</span>
              <span className={`text-right transition-opacity ${hoverPoint ? "opacity-100" : "opacity-0"}`} aria-live="polite">
                {hoverPoint ? `${hoverPoint.height}.BITMAP · ${formatSats(hoverPoint.sats)} · ${new Date(hoverPoint.t).toISOString().slice(0, 10)}` : "NO POINT SELECTED"}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="bitmap-market-line h-[260px] w-full touch-none"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Confirmed sale prices for ${club.label}`}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id={`club-line-${club.id}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.35" />
                  <stop offset="0.52" stopColor="var(--color-primary)" stopOpacity="0.78" />
                  <stop offset="1" stopColor="var(--color-primary)" />
                </linearGradient>
                <linearGradient id={`club-area-${club.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.22" />
                  <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
                <filter id={`club-glow-${club.id}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD.l}
                x2={W - PAD.r}
                y1={PAD.t + f * (H - PAD.t - PAD.b)}
                y2={PAD.t + f * (H - PAD.t - PAD.b)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
            ))}
            {geom && (
              <>
                <path d={geom.area} fill={`url(#club-area-${club.id})`} opacity={hoverPoint ? 0.9 : 0.55} className="pointer-events-none transition-opacity duration-300" />
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={geom.avgY}
                  y2={geom.avgY}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeDasharray="6 6"
                  strokeWidth={1}
                />
                <path
                  d={geom.line}
                  fill="none"
                  className="bitmap-market-line__trail pointer-events-none"
                  stroke="var(--color-primary)"
                  strokeOpacity={hoverPoint ? 0.22 : 0.12}
                  strokeWidth={9}
                  filter={`url(#club-glow-${club.id})`}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={geom.line}
                  fill="none"
                  stroke={`url(#club-line-${club.id})`}
                  className="bitmap-market-line__stroke pointer-events-none"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
                {geom.coords.map((c, index) => (
                  <circle
                    key={c.txid}
                    cx={c.cx}
                    cy={c.cy}
                    r={hoverIndex === index ? 6 : 2.5}
                    className="fill-primary transition-all duration-200"
                    opacity={hoverPoint && hoverIndex !== index ? 0.22 : 1}
                  >
                    <title>{`${c.height}.bitmap — ${formatSats(c.sats)} (${new Date(c.t).toISOString().slice(0, 10)})`}</title>
                  </circle>
                ))}
                {hoverPoint && (
                  <g className="pointer-events-none">
                    <line x1={hoverPoint.cx} x2={hoverPoint.cx} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-primary)" strokeDasharray="4 7" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
                    <circle cx={hoverPoint.cx} cy={hoverPoint.cy} r={12} fill="none" stroke="var(--color-primary)" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />
                    <circle cx={hoverPoint.cx} cy={hoverPoint.cy} r={5} fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </g>
                )}
              </>
            )}
              <rect x="0" y="0" width={W} height={H} fill="transparent" />
            </svg>

          <div className="label flex justify-between border-t border-border pt-3">
            <span>
              {geom ? new Date(geom.minT).toISOString().slice(0, 10) : ""}
            </span>
            <span>AVG {formatSats(stats.avg)}</span>
            <span>{geom ? new Date(geom.maxT).toISOString().slice(0, 10) : ""}</span>
          </div>
          </div>
        </>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <span className="label text-muted-foreground">
            {trades.isPending ? "SYNC" : "NO CONFIRMED SALES IN THIS CLUB YET"}
          </span>
        </div>
      )}
    </section>
  );
}

function Metric({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="p-3">
      <div className="label">{k}</div>
      <div className={`mt-1 font-mono text-sm ${accent ? "text-primary" : ""}`}>{v}</div>
    </div>
  );
}
