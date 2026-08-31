import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import type { Club } from "@/lib/clubs";
import { inClub } from "@/lib/clubs";

type Point = { t: number; sats: number; height: number; txid: string };

/**
 * Sale-price history for one club, drawn from confirmed on-chain trades only
 * (rows in `trades` where the spending transaction paid the previous holder).
 */
export function ClubPriceChart({ club }: { club: Club }) {
  const trades = useQuery(recentTradesQuery(500));

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
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(" ");
    const area = `${line} L${coords[coords.length - 1]!.cx.toFixed(1)},${H - PAD.b} L${coords[0]!.cx.toFixed(1)},${H - PAD.b} Z`;
    return { coords, line, area, avgY: y(stats.avg), minT, maxT };
  }, [points, stats]);

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-lg">PRICE HISTORY</h2>
        <span className="label">
          {trades.isPending
            ? "LOADING CONFIRMED SALES…"
            : `${points.length} CONFIRMED SALE${points.length === 1 ? "" : "S"} · ${club.short}`}
        </span>
      </div>

      {stats ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric k="LAST" v={formatSats(stats.last)} />
            <Metric k="LOW" v={formatSats(stats.low)} />
            <Metric k="HIGH" v={formatSats(stats.high)} />
            <Metric
              k="CHANGE"
              v={`${stats.change >= 0 ? "+" : ""}${stats.change.toFixed(1)}%`}
              accent={stats.change >= 0}
            />
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-4 h-[260px] w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Confirmed sale prices for ${club.label}`}
          >
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
                <path d={geom.area} className="fill-primary/10" />
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
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                {geom.coords.map((c) => (
                  <circle
                    key={c.txid}
                    cx={c.cx}
                    cy={c.cy}
                    r={3}
                    className="fill-primary"
                  >
                    <title>{`${c.height}.bitmap — ${formatSats(c.sats)} (${new Date(c.t).toISOString().slice(0, 10)})`}</title>
                  </circle>
                ))}
              </>
            )}
          </svg>

          <div className="label flex justify-between">
            <span>
              {geom ? new Date(geom.minT).toISOString().slice(0, 10) : ""}
            </span>
            <span>AVG {formatSats(stats.avg)}</span>
            <span>{geom ? new Date(geom.maxT).toISOString().slice(0, 10) : ""}</span>
          </div>
        </>
      ) : (
        <div className="mt-4 flex h-[180px] items-center justify-center border border-dashed border-border">
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
    <div className="border border-border p-3">
      <div className="label">{k}</div>
      <div className={`mt-1 font-mono text-sm ${accent ? "text-primary" : ""}`}>{v}</div>
    </div>
  );
}
