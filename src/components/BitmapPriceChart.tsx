import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { recentTradesQuery, tradesForHeightQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

/**
 * Per-bitmap sale-price history. Every point is a real traced on-chain transfer
 * that paid the previous holder — nothing synthetic.
 */

type Point = { t: number; sats: number; txid: string; block: number | null; hop: number };

const W = 1000;
const H = 220;
const PAD = { l: 8, r: 8, t: 16, b: 20 };

function path(coords: Array<{ cx: number; cy: number }>) {
  if (coords.length === 0) return "";
  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(" ");
}

function short(address: string | null) {
  if (!address) return "UNKNOWN";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function BitmapPriceChart({ initialHeight }: { initialHeight?: number }) {
  const recent = useQuery(recentTradesQuery(500));
  const [height, setHeight] = useState<number | null>(initialHeight ?? null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  /** Bitmaps that actually have paid sales, most recent first. */
  const heights = useMemo(() => {
    const seen: number[] = [];
    for (const row of recent.data ?? []) {
      if (row.price_sats > 0 && !seen.includes(row.bitmap_height)) seen.push(row.bitmap_height);
    }
    return seen.slice(0, 60);
  }, [recent.data]);

  useEffect(() => {
    if (height === null && heights.length > 0) setHeight(heights[0]!);
  }, [height, heights]);

  const history = useQuery({
    ...tradesForHeightQuery(height ?? 0),
    enabled: height !== null,
  });

  const points = useMemo<Point[]>(() => {
    return (history.data ?? [])
      .filter((r) => r.price_sats > 0)
      .map((r) => ({
        t: new Date(r.block_time ?? r.created_at).getTime(),
        sats: r.price_sats,
        txid: r.txid,
        block: r.block_height,
        hop: r.hop,
      }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
  }, [history.data]);

  const latest = useMemo(() => {
    const rows = (history.data ?? []).filter((r) => r.price_sats > 0);
    return rows.reduce<(typeof rows)[number] | null>(
      (best, row) => (!best || row.hop > best.hop ? row : best),
      null,
    );
  }, [history.data]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.sats);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const first = points[0]!.sats;
    const last = points[points.length - 1]!.sats;
    return {
      low,
      high,
      last,
      change: first > 0 ? ((last - first) / first) * 100 : 0,
    };
  }, [points]);

  const geom = useMemo(() => {
    if (!stats || points.length === 0) return null;
    const minT = points[0]!.t;
    const maxT = points[points.length - 1]!.t;
    const spanT = Math.max(1, maxT - minT);
    const minV = stats.low === stats.high ? stats.low * 0.9 : stats.low;
    const maxV = stats.low === stats.high ? stats.high * 1.1 : stats.high;
    const spanV = Math.max(1, maxV - minV);
    const coords = points.map((p) => ({
      ...p,
      cx: points.length === 1 ? W / 2 : PAD.l + ((p.t - minT) / spanT) * (W - PAD.l - PAD.r),
      cy: PAD.t + (1 - (p.sats - minV) / spanV) * (H - PAD.t - PAD.b),
    }));
    const line = path(coords);
    const area = `${line} L${coords[coords.length - 1]!.cx.toFixed(1)},${H - PAD.b} L${coords[0]!.cx.toFixed(1)},${H - PAD.b} Z`;
    return { coords, line, area, minT, maxT };
  }, [points, stats]);

  const hoverPoint = hoverIndex === null ? null : geom?.coords[hoverIndex] ?? null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!geom || geom.coords.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * W;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    geom.coords.forEach((c, i) => {
      const d = Math.abs(c.cx - pointerX);
      if (d < distance) {
        distance = d;
        closest = i;
      }
    });
    setHoverIndex(closest);
  };

  return (
    <section className="border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="border-l-2 border-primary pl-3">
          <h2 className="font-mono text-sm font-bold uppercase text-foreground">BITMAP PRICE CHART</h2>
          <p className="label mt-1">SALE HISTORY PER BITMAP · REAL ON-CHAIN TRADES</p>
        </div>
        <label className="flex items-center gap-2">
          <span className="label">BITMAP</span>
          <select
            value={height ?? ""}
            onChange={(event) => {
              setHoverIndex(null);
              setHeight(Number(event.target.value));
            }}
            className="border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase text-foreground"
            aria-label="Select bitmap for price history"
          >
            {heights.length === 0 && <option value="">—</option>}
            {heights.map((h) => (
              <option key={h} value={h}>
                {h}.BITMAP
              </option>
            ))}
          </select>
        </label>
      </header>

      {recent.isPending || history.isPending ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; READING SALE HISTORY<span className="blink">_</span>
        </p>
      ) : !stats || !geom ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; NO PAID SALES RECORDED FOR THIS BITMAP YET
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
            <Metric k="LAST SALE" v={formatSats(stats.last)} />
            <Metric k="LOW" v={formatSats(stats.low)} />
            <Metric k="HIGH" v={formatSats(stats.high)} />
            <Metric
              k="CHANGE"
              v={`${stats.change >= 0 ? "+" : ""}${stats.change.toFixed(1)}%`}
              accent={stats.change >= 0}
            />
          </div>

          <div className="p-4">
            <div className="mb-2 flex min-h-6 items-center justify-between gap-3 font-mono text-[10px] uppercase">
              <span className="text-muted-foreground">HOVER TO TRACE SALES</span>
              <span className={hoverPoint ? "text-foreground" : "opacity-0"} aria-live="polite">
                {hoverPoint
                  ? `${formatSats(hoverPoint.sats)} · ${new Date(hoverPoint.t).toISOString().slice(0, 10)}${hoverPoint.block ? ` · BLK ${hoverPoint.block}` : " · MEMPOOL"}`
                  : "—"}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-[220px] w-full touch-none"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Sale price history for ${height}.bitmap`}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
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
              <path d={geom.area} className="fill-primary/10" />
              <path
                d={geom.line}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              {geom.coords.map((c, index) => (
                <circle
                  key={c.txid}
                  cx={c.cx}
                  cy={c.cy}
                  r={hoverIndex === index ? 5 : 2.5}
                  className="fill-primary"
                >
                  <title>{`${formatSats(c.sats)} — ${new Date(c.t).toISOString().slice(0, 10)}`}</title>
                </circle>
              ))}
              {hoverPoint && (
                <line
                  x1={hoverPoint.cx}
                  x2={hoverPoint.cx}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="var(--color-primary)"
                  strokeDasharray="4 7"
                  strokeOpacity={0.45}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            <div className="label flex justify-between border-t border-border pt-3">
              <span>{new Date(geom.minT).toISOString().slice(0, 10)}</span>
              <span>
                {points.length} SALE{points.length === 1 ? "" : "S"}
              </span>
              <span>{new Date(geom.maxT).toISOString().slice(0, 10)}</span>
            </div>

            {latest && (
              <div className="mt-3 border border-border p-3 font-mono text-[11px]">
                <div className="label">LATEST SETTLED SALE</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(latest.bitmap_height) }}
                    className="font-bold uppercase text-foreground hover:text-primary"
                  >
                    {latest.bitmap_height}.BITMAP
                  </Link>
                  <span className="text-primary">{formatSats(latest.price_sats)}</span>
                  <span className="text-muted-foreground">
                    {short(latest.seller_address)} → {short(latest.buyer_address)}
                  </span>
                  <a
                    href={`https://mempool.space/tx/${latest.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline hover:text-primary"
                  >
                    {latest.block_height ? `BLK ${latest.block_height}` : "IN MEMPOOL"}
                  </a>
                </div>
              </div>
            )}
          </div>
        </>
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
