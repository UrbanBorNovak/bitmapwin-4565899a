import { useMemo, useRef, useState, type PointerEvent } from "react";
import { formatSats } from "@/lib/trades";
import type { CollectionSale } from "@/lib/collection-sales";
import { lttb } from "@/components/BitmapMarketChart";

type Sale = CollectionSale & { source?: string };

/** Price per confirmed on-chain sale, in block order. */
export function CollectionSalesChart({ sales, pending, unavailable, traced, checked, total }: { sales: Sale[]; pending: boolean; unavailable: boolean; traced?: number | undefined; checked?: number | undefined; total?: number | undefined }) {
  const W = 600, H = 160, P = 8;
  const pts = useMemo(() => sales.filter((s) => s.priceSats > 0 && s.blockHeight).sort((a, b) => (a.blockHeight! - b.blockHeight!)), [sales]);
  const geo = useMemo(() => {
    let max = 1;
    for (const s of pts) if (s.priceSats > max) max = s.priceSats;
    const minB = pts[0]?.blockHeight ?? 0, maxB = pts.at(-1)?.blockHeight ?? 1;
    const coords = pts.map((s) => ({
      s,
      x: pts.length === 1 ? W / 2 : P + ((s.blockHeight! - minB) / Math.max(1, maxB - minB)) * (W - 2 * P),
      y: H - P - (s.priceSats / max) * (H - 2 * P),
    }));
    const path = lttb(coords, 400).map((c, i) => `${i ? "L" : "M"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join("");
    return { coords, path };
  }, [pts]);
  const volume = useMemo(() => pts.reduce((a, s) => a + s.priceSats, 0), [pts]);
  const [hover, setHover] = useState<number | null>(null);
  const frame = useRef<number | null>(null);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const c = geo.coords;
    if (!c.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      let lo = 0, hi = c.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (c[m]!.x < px) lo = m + 1; else hi = m; }
      const prev = Math.max(0, lo - 1);
      const best = Math.abs(c[prev]!.x - px) <= Math.abs(c[lo]!.x - px) ? prev : lo;
      setHover((cur) => (cur === best ? cur : best));
    });
  };
  const hp = hover === null ? null : geo.coords[hover] ?? null;
  return (
    <div className="mt-6 border border-border bg-card/60 p-3 backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label text-muted-foreground">PRICE HISTORY · CONFIRMED ON-CHAIN SALES</span>
        <span className="label text-foreground" data-no-translate>{pts.length} SALES{volume ? ` · ${formatSats(volume)} VOLUME` : ""}{pts.length ? ` · LAST ${formatSats(pts.at(-1)!.priceSats)}` : ""}</span>
      </div>
      {pending ? <p className="label mt-3 text-muted-foreground">VERIFYING SALES ON CHAIN…</p>
        : unavailable ? <p className="label mt-3 text-destructive">SALE VERIFICATION UNAVAILABLE — TRY AGAIN LATER</p>
        : pts.length === 0 ? <p className="label mt-3 text-muted-foreground">NO CONFIRMED SALES YET</p>
        : (
          <div className="relative mt-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full touch-none" preserveAspectRatio="none" role="img" aria-label="Sale price chart" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              <path d={geo.path} fill="none" className="pointer-events-none stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {pts.length < 60 && geo.coords.map((c) => <circle key={c.s.txid} cx={c.x} cy={c.y} r={2.5} className="pointer-events-none fill-signal" />)}
              {hp && (
                <g className="pointer-events-none">
                  <line x1={hp.x} x2={hp.x} y1={0} y2={H} className="stroke-muted-foreground" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  <circle cx={hp.x} cy={hp.y} r={4} className="fill-signal stroke-background" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </g>
              )}
            </svg>
            {hp && (
              <div className="pointer-events-none absolute top-1 border border-border bg-background/95 px-2 py-1 font-mono text-[10px]" style={{ left: `${Math.min(75, (hp.x / W) * 100)}%` }} data-no-translate>
                <div className="text-signal">{formatSats(hp.s.priceSats)}</div>
                <div className="text-muted-foreground">BLOCK {hp.s.blockHeight} · {hp.s.source ?? "BITMAPWIN"}</div>
                <div className="text-muted-foreground">TX {hp.s.txid.slice(0, 12)}…</div>
              </div>
            )}
          </div>
        )}
      {total ? (() => {
        const done = Math.min(checked ?? traced ?? 0, total);
        const pct = Math.round((done / total) * 100);
        return (
          <div className="mt-2" data-no-translate>
            <div className="h-1 w-full bg-muted"><div className="h-1 bg-signal transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="label mt-1 text-muted-foreground">BACKFILL {pct}% · {done.toLocaleString("en-US")}/{total.toLocaleString("en-US")} CHECKED · {(traced ?? 0).toLocaleString("en-US")} FULLY TRACED · ALL MARKETPLACES{done < total ? " · RUNNING IN BACKGROUND" : " · COMPLETE"}</p>
          </div>
        );
      })() : null}
      {pts.length > 0 && (
        <div className="mt-3 max-h-64 overflow-auto border-t border-border">
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left"><th className="label py-2 font-normal">PRICE</th><th className="label py-2 font-normal">SOURCE</th><th className="label py-2 font-normal">BLOCK</th><th className="label py-2 font-normal">TX</th></tr></thead>
            <tbody>
              {[...pts].reverse().map((s) => (
                <tr key={s.txid} className="border-t border-border">
                  <td className="py-1.5" data-no-translate>{formatSats(s.priceSats)}</td>
                  <td className={`label py-1.5 ${s.source === "BITMAPWIN" ? "text-primary" : "text-signal"}`}>{s.source ?? "BITMAPWIN"}</td>
                  <td className="py-1.5" data-no-translate>{s.blockHeight}</td>
                  <td className="py-1.5"><a href={`https://mempool.space/tx/${s.txid}`} target="_blank" rel="noreferrer" className="hover:text-foreground" data-no-translate>{s.txid.slice(0, 10)}… ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
