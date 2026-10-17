import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { TradeRow } from "@/lib/trade-store";
import { bollinger } from "@/lib/bollinger";
import { formatSats } from "@/lib/trades";

type Pt = { t: number; price: number; h: number; txid: string; mid?: number; upper?: number; lower?: number; band?: [number, number] };
const tick = { fontSize: 9, fontFamily: "monospace", fill: "var(--color-muted-foreground)" };
const btc = (s: number) => (s / 1e8).toFixed(s < 1e5 ? 6 : 4);

/** Every traced paid sale over time with 20-sale Bollinger Bands (±2σ). */
export function SalesBollingerChart({ rows, loading }: { rows: TradeRow[]; loading: boolean }) {
  const [range, setRange] = useState<"30D" | "90D" | "ALL">("ALL");
  const [bands, setBands] = useState(true);
  const all = useMemo<Pt[]>(() => {
    const pts = rows
      .filter((r) => r.price_sats > 0)
      .map((r) => ({ t: new Date(r.block_time ?? r.created_at).getTime(), price: r.price_sats, h: r.bitmap_height, txid: r.txid }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    const bb = bollinger(pts.map((p) => p.price));
    return pts.map((p, i) => {
      const b = bb[i];
      return b ? { ...p, mid: b.mid, upper: b.upper, lower: Math.max(1, b.lower), band: [Math.max(1, b.lower), b.upper] as [number, number] } : p;
    });
  }, [rows]);
  const data = useMemo(() => {
    if (range === "ALL" || !all.length) return all;
    const cut = (all[all.length - 1]?.t ?? 0) - (range === "30D" ? 30 : 90) * 864e5;
    return all.filter((p) => p.t >= cut);
  }, [all, range]);

  return (
    <section className="mt-8 border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="label">PRICE CHART · ALL TRACED SALES</div>
          <div className="label mt-1 text-muted-foreground" data-no-translate>{data.length} SALES · BOLLINGER 20, ±2σ · LOG SCALE</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setBands((b) => !b)} aria-pressed={bands} className={bands ? "btn-term" : "btn-term-ghost"}>BANDS</button>
          {(["30D", "90D", "ALL"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} className={range === r ? "btn-term" : "btn-term-ghost"}>{r}</button>
          ))}
        </div>
      </header>
      <div className="h-80 px-1 py-3">
        {loading ? <Empty text="TRACING SALES…" /> : data.length < 2 ? <Empty text={`NOT ENOUGH SALES IN ${range} TO CHART (HAS ${data.length}).`} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).toISOString().slice(0, 7)} tick={tick} stroke="var(--color-border)" />
              <YAxis type="number" scale="log" domain={["auto", "auto"]} allowDataOverflow width={56} tickFormatter={btc} tick={tick} stroke="var(--color-border)" />
              <Tooltip content={<Tip />} />
              {bands ? <Area dataKey="band" stroke="none" fill="var(--color-signal)" fillOpacity={0.08} isAnimationActive={false} connectNulls /> : null}
              {bands ? <Line dataKey="upper" stroke="var(--color-signal)" strokeOpacity={0.6} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls /> : null}
              {bands ? <Line dataKey="lower" stroke="var(--color-signal)" strokeOpacity={0.6} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls /> : null}
              {bands ? <Line dataKey="mid" stroke="var(--color-signal)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls /> : null}
              <Scatter dataKey="price" fill="var(--color-bitcoin)" fillOpacity={0.7} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="border border-border bg-background px-2 py-1.5 font-mono text-[10px] leading-relaxed" data-no-translate>
      <div className="text-bitcoin">{p.h}.BITMAP · {formatSats(p.price)}</div>
      <div>{new Date(p.t).toISOString().replace("T", " ").slice(0, 16)} UTC</div>
      {p.mid != null ? (
        <div className="text-signal">SMA20 {formatSats(Math.round(p.mid))} · UPPER {formatSats(Math.round(p.upper ?? 0))} · LOWER {formatSats(Math.round(p.lower ?? 0))}</div>
      ) : <div className="text-muted-foreground">BANDS START AFTER 20 SALES</div>}
      <div className="text-muted-foreground">TX {p.txid.slice(0, 16)}…</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="flex h-full items-center justify-center font-mono text-[11px] text-muted-foreground">&gt; {text}</p>;
}
