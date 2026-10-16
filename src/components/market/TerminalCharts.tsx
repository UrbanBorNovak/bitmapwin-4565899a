import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { paidSalesQuery } from "@/lib/trade-store";
import { depthCurve, type BookLevel, type DepthPoint } from "@/lib/market-depth";

/** Which BITMAPs the charts cover. match = null means the whole market. */
export type ChartScope = { label: string; match: ((height: number) => boolean) | null; caveat?: string };

const btc = (s: number) => (s / 1e8).toFixed(s < 1e5 ? 6 : 4);
const sats = (s: number) => `${s.toLocaleString("en-US")} sats`;
const utc = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const tick = { fontSize: 9, fontFamily: "monospace", fill: "var(--color-muted-foreground)" };

type SalePoint = { t: number; price: number; h: number; txid: string; confirmed: boolean };

/** Depth + historical sales charts for the Pro Terminal. Real book levels and traced sales only. */
export function TerminalCharts({ asks, bids, loading, scope }: { asks: BookLevel[]; bids: BookLevel[]; loading: boolean; scope: ChartScope }) {
  const sales = useQuery(paidSalesQuery());
  const inScope = (h: number | null) => !scope.match || (h !== null && scope.match(h));
  const scopedAsks = useMemo(() => asks.filter((a) => inScope(a.height)), [asks, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopedBids = useMemo(() => bids.filter((b) => inScope(b.height)), [bids, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const depth = useMemo(() => depthCurve(scopedAsks, scopedBids), [scopedAsks, scopedBids]);
  const points = useMemo<SalePoint[]>(
    () =>
      (sales.data ?? [])
        .filter((t) => inScope(t.bitmap_height))
        .map((t) => ({ t: new Date(t.block_time ?? t.created_at).getTime(), price: t.price_sats, h: t.bitmap_height, txid: t.txid, confirmed: t.block_height !== null }))
        .filter((p) => Number.isFinite(p.t)),
    [sales.data, scope], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [pinned, setPinned] = useState<SalePoint | null>(null);
  const shownPin = pinned && points.some((p) => p.txid === pinned.txid) ? pinned : null;

  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5 font-mono text-[10px]">
        <span className="label">CHART SCOPE</span>
        <span className={scope.match ? "font-bold text-signal" : "text-foreground"}>{scope.label}</span>
        {scope.caveat ? <span className="text-muted-foreground">· {scope.caveat}</span> : null}
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        <Panel title="DEPTH" note={`${scopedBids.length} BIDS · ${scopedAsks.length} ASKS`}>
          {loading ? <Empty text="READING BOOK…" /> : depth.length < 2 ? (
            <Empty text={`NOT ENOUGH ORDERS IN ${scope.label} FOR A DEPTH CURVE — NEEDS AT LEAST 2 LEVELS (HAS ${depth.length}).`} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={depth} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
                <XAxis dataKey="price" type="number" scale="log" domain={["dataMin", "dataMax"]} tickFormatter={btc} tick={tick} stroke="var(--color-border)" />
                <YAxis width={28} allowDecimals={false} tick={tick} stroke="var(--color-border)" />
                <Tooltip content={<DepthTip />} />
                <Area type="stepAfter" dataKey="bid" stroke="var(--color-signal)" fill="var(--color-signal)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
                <Area type="stepBefore" dataKey="ask" stroke="var(--color-bitcoin)" fill="var(--color-bitcoin)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="SALES HISTORY" note={`${points.length} TRACED SALES · CLICK A DOT TO PIN`}>
          {sales.isPending ? <Empty text="READING SALES…" /> : sales.isError ? <Empty text="SALES UNAVAILABLE — TRY AGAIN SHORTLY." /> : points.length < 2 ? (
            <Empty text={`NOT ENOUGH TRACED SALES IN ${scope.label} TO CHART (HAS ${points.length}).`} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).toISOString().slice(0, 7)} tick={tick} stroke="var(--color-border)" />
                <YAxis dataKey="price" type="number" scale="log" domain={["auto", "auto"]} width={52} tickFormatter={btc} tick={tick} stroke="var(--color-border)" />
                <Tooltip content={<SaleTip />} cursor={{ strokeDasharray: "2 2" }} />
                <Scatter
                  data={points}
                  fill="var(--color-bitcoin)"
                  fillOpacity={0.6}
                  isAnimationActive={false}
                  className="cursor-pointer"
                  onClick={(d: { payload?: SalePoint }) => d?.payload && setPinned(d.payload)}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
      {shownPin ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 font-mono text-[11px]" data-no-translate>
          <span className="label">PINNED SALE</span>
          <span>{shownPin.h}.BITMAP</span>
          <span className="text-bitcoin">{sats(shownPin.price)}</span>
          <span className="text-muted-foreground">{utc(shownPin.t)}{shownPin.confirmed ? "" : " · MEMPOOL"}</span>
          <a href={`https://mempool.space/tx/${shownPin.txid}`} target="_blank" rel="noreferrer" className="text-signal hover:underline">TX {shownPin.txid.slice(0, 12)}… ↗</a>
          <button type="button" onClick={() => setPinned(null)} className="btn-term-ghost !px-1.5 !py-0 text-[10px]">CLEAR</button>
        </div>
      ) : null}
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-border bg-background px-2 py-1.5 font-mono text-[10px] leading-relaxed" data-no-translate>{children}</div>;
}

function DepthTip({ active, payload }: { active?: boolean; payload?: { payload: DepthPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const isAsk = p.ask !== null;
  return (
    <TipBox>
      <div className={isAsk ? "text-bitcoin" : "text-signal"}>{isAsk ? "ASK LEVEL" : "BID LEVEL"}{p.height !== null ? ` · ${p.height}.BITMAP` : ""}</div>
      <div>PRICE {sats(p.price)}</div>
      <div>{isAsk ? `${p.ask} ASKS AT OR BELOW` : `${p.bid} BIDS AT OR ABOVE`}</div>
      <div className="text-muted-foreground">CUMULATIVE {sats(p.cumSats)}</div>
    </TipBox>
  );
}

function SaleTip({ active, payload }: { active?: boolean; payload?: { payload: SalePoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <TipBox>
      <div className="text-bitcoin">{p.h}.BITMAP · {sats(p.price)}</div>
      <div>{utc(p.t)}{p.confirmed ? "" : " · MEMPOOL"}</div>
      <div className="text-muted-foreground">TX {p.txid.slice(0, 16)}… · CLICK TO PIN LINK</div>
    </TipBox>
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
