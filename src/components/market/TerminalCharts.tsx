import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { paidSalesQuery } from "@/lib/trade-store";
import { depthCurve } from "@/lib/market-depth";

const btc = (s: number) => (s / 1e8).toFixed(s < 1e5 ? 6 : 4);
const tick = { fontSize: 9, fontFamily: "monospace", fill: "var(--color-muted-foreground)" };
const tip = { background: "var(--color-background)", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: 10 };

/** Depth + historical sales charts for the Pro Terminal. Real book levels and traced sales only. */
export function TerminalCharts({ askPrices, bidPrices, loading }: { askPrices: number[]; bidPrices: number[]; loading: boolean }) {
  const sales = useQuery(paidSalesQuery());
  const depth = useMemo(() => depthCurve(askPrices, bidPrices), [askPrices, bidPrices]);
  const points = useMemo(
    () => (sales.data ?? []).map((t) => ({ t: new Date(t.block_time ?? t.created_at).getTime(), price: t.price_sats, h: t.bitmap_height })).filter((p) => Number.isFinite(p.t)),
    [sales.data],
  );

  return (
    <div className="grid gap-px border-t border-border bg-border md:grid-cols-2">
      <Panel title="DEPTH" note={`${bidPrices.length} BIDS · ${askPrices.length} ASKS`}>
        {loading ? <Empty text="READING BOOK…" /> : depth.length < 2 ? (
          <Empty text="NOT ENOUGH ORDERS FOR A DEPTH CURVE YET — NEEDS AT LEAST 2 LEVELS." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={depth} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="price" type="number" scale="log" domain={["dataMin", "dataMax"]} tickFormatter={btc} tick={tick} stroke="var(--color-border)" />
              <YAxis width={28} allowDecimals={false} tick={tick} stroke="var(--color-border)" />
              <Tooltip contentStyle={tip} labelFormatter={(v) => `${btc(Number(v))} BTC`} formatter={(v: number, k: string) => [`${v} LEVELS`, k === "ask" ? "ASKS ≤" : "BIDS ≥"]} />
              <Area type="stepAfter" dataKey="bid" stroke="var(--color-signal)" fill="var(--color-signal)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
              <Area type="stepBefore" dataKey="ask" stroke="var(--color-bitcoin)" fill="var(--color-bitcoin)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel title="SALES HISTORY" note={`${points.length} TRACED SALES`}>
        {sales.isPending ? <Empty text="READING SALES…" /> : sales.isError ? <Empty text="SALES UNAVAILABLE — TRY AGAIN SHORTLY." /> : points.length < 2 ? (
          <Empty text="NOT ENOUGH TRACED SALES TO CHART YET." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).toISOString().slice(0, 7)} tick={tick} stroke="var(--color-border)" />
              <YAxis dataKey="price" type="number" scale="log" domain={["auto", "auto"]} width={52} tickFormatter={btc} tick={tick} stroke="var(--color-border)" />
              <Tooltip contentStyle={tip} formatter={(v: number, k: string) => (k === "price" ? [`${btc(v)} BTC`, "PRICE"] : [new Date(v).toISOString().slice(0, 10), "DATE"])} />
              <Scatter data={points} fill="var(--color-bitcoin)" fillOpacity={0.6} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2"><span className="label">{title}</span><span className="label text-muted-foreground" data-no-translate>{note}</span></div>
      <div className="h-48 px-1 py-2">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] text-muted-foreground">&gt; {text}</p>;
}
