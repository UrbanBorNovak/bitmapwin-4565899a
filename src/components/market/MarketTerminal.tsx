import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { offersQuery } from "@/lib/offers";
import { openBidsQuery } from "@/lib/bids";
import { fetchRecentTrades, type TradeRow } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";
import { btcPriceQuery, usdFromSats } from "@/lib/btc-price";
import { BuyButton } from "@/components/BuyButton";
import { bucketize, diffIds, feeTier, signalsRbf, spreadOf, TICK_SIZES, withDepth, type FeeTier } from "@/lib/market-depth";
import { TerminalCharts, type ChartScope } from "@/components/market/TerminalCharts";

const LEVELS = 10;
const DAY = 86_400_000;

/**
 * Pro trading terminal: L2 book of real open PSBT asks + signed bid intents,
 * with a live tape of traced on-chain sales. Shares the live-trades cache so
 * realtime fills from LiveTradesFeed flash here too.
 */
export function MarketTerminal({ scope = { label: "ALL BITMAPS", match: null } }: { scope?: ChartScope }) {
  const offers = useQuery(offersQuery());
  const bids = useQuery(openBidsQuery(500));
  const tape = useQuery({ queryKey: ["live-trades-feed"], queryFn: () => fetchRecentTrades(150), staleTime: 15_000, refetchInterval: 60_000 });
  const { data: price } = useQuery(btcPriceQuery());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const asks = useMemo(
    () => (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0 && o.bitmapHeight !== null).sort((a, b) => a.priceSats - b.priceSats),
    [offers.data],
  );
  const bidOrders = useMemo(() => [...(bids.data ?? [])].filter((b) => b.priceSats > 0).sort((a, b) => b.priceSats - a.priceSats), [bids.data]);
  const [tick, setTick] = useState<number>(0);
  const [open, setOpen] = useState<string | null>(null);
  const askBuckets = useMemo(() => bucketize(asks, tick, "ask").slice(0, LEVELS), [asks, tick]);
  const bidBuckets = useMemo(() => bucketize(bidOrders, tick, "bid").slice(0, LEVELS), [bidOrders, tick]);
  const flash = useBookFlash([...asks.map((a) => a.id), ...bidOrders.map((b) => b.id)], !offers.isPending && !bids.isPending);
  const bidRows = bidOrders;
  const allAsks = useMemo(() => (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0).map((o) => ({ priceSats: o.priceSats, height: o.bitmapHeight })), [offers.data]);
  const allBids = useMemo(() => (bids.data ?? []).filter((b) => b.priceSats > 0).map((b) => ({ priceSats: b.priceSats, height: b.bitmapHeight })), [bids.data]);
  const askTotal = askBuckets.reduce((s, a) => s + a.totalSats, 0);
  const bidTotal = bidBuckets.reduce((s, b) => s + b.totalSats, 0);
  const sideMax = Math.max(askTotal, bidTotal);
  const askDepth = withDepth(askBuckets.map((b) => ({ ...b, priceSats: b.totalSats, level: b.priceSats, key: `a${b.priceSats}` })), sideMax);
  const bidDepth = withDepth(bidBuckets.map((b) => ({ ...b, priceSats: b.totalSats, level: b.priceSats, key: `b${b.priceSats}` })), sideMax);
  const bidders = useMemo(() => new Set((bids.data ?? []).map((b) => `${b.bitmapHeight}:${b.bidderAddress}`)), [bids.data]);
  const spread = spreadOf(asks[0]?.priceSats ?? null, bidRows[0]?.priceSats ?? null);

  const sales = useMemo(() => (tape.data ?? []).filter((t) => t.price_sats > 0), [tape.data]);
  const pendingIds = useMemo(() => sales.filter((t) => !t.block_height).slice(0, 20).map((t) => t.txid), [sales]);
  const mem = useMempoolInfo(pendingIds, hydrated);
  const now = hydrated ? Date.now() : 0;
  const day = sales.filter((t) => now - new Date(t.block_time ?? t.created_at).getTime() < DAY);
  const vol24 = day.reduce((s, t) => s + t.price_sats, 0);
  const last = sales[0];
  const prev = sales[1];
  const dir = last && prev ? Math.sign(last.price_sats - prev.price_sats) : 0;
  const usd = (s: number) => (price?.usd ? usdFromSats(s, price.usd) : null);

  if (!hydrated) return <section className="border border-border bg-card/60 px-4 py-6 font-mono text-[11px] text-muted-foreground backdrop-blur-md">&gt; LOADING PRO TERMINAL…</section>;

  return (
    <section className="border border-border bg-card/60 backdrop-blur-md" aria-labelledby="terminal-h">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-3 font-mono text-[11px]" data-no-translate>
        <h2 id="terminal-h" className="display flex items-center gap-2 text-lg">
          <span className="size-2 animate-pulse rounded-full bg-signal" aria-hidden /> PRO TERMINAL
        </h2>
        <Kv k="LAST" v={last ? formatSats(last.price_sats) : "—"} tone={dir > 0 ? "text-signal" : dir < 0 ? "text-destructive" : "text-foreground"} suffix={dir > 0 ? "▲" : dir < 0 ? "▼" : ""} />
        <Kv k="BEST ASK" v={asks[0] ? formatSats(asks[0].priceSats) : "—"} tone="text-bitcoin" />
        <Kv k="BEST BID" v={bidRows[0] ? formatSats(bidRows[0].priceSats) : "—"} tone="text-signal" />
        <Kv k="SPREAD" v={spread ? `${formatSats(spread.sats)} · ${spread.pct.toFixed(1)}%` : "—"} />
        <Kv k="24H VOL" v={hydrated ? (vol24 ? formatSats(vol24) : "0") : "…"} suffix={hydrated ? `${day.length} FILLS` : ""} />
        {hydrated && price?.usd ? <Kv k="BTC" v={`$${Math.round(price.usd).toLocaleString("en-US")}`} /> : null}
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* L2 book */}
        <div className="bg-card">
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2 font-mono text-[10px]" data-no-translate role="group" aria-label="Tick size">
            <span className="label mr-1">TICK</span>
            {TICK_SIZES.map((t) => (
              <button key={t} type="button" onClick={() => { setTick(t); setOpen(null); }} aria-pressed={tick === t} className={`border px-1.5 py-0.5 ${tick === t ? "border-signal text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t === 0 ? "EXACT" : t === 100_000 ? "0.001 BTC" : `${t / 1000}K`}
              </button>
            ))}
          </div>
          <BookHead tick={tick} />
          <ol className="flex flex-col-reverse" aria-label="Asks">
            {askDepth.length === 0 ? <Empty text={offers.isPending ? "READING ASKS…" : "NO OPEN ASKS"} /> : askDepth.map((a) => (
              <Fragment key={a.key}>
                <LevelRow side="ask" level={a.level} count={a.count} cum={a.cumSats} pct={a.depthPct} tick={tick} open={open === a.key} onToggle={() => setOpen(open === a.key ? null : a.key)} fresh={a.orders.some((o) => flash.added.has(o.id))}
                  single={tick === 0 && a.count === 1 ? a.orders[0]! : null} />
                {open === a.key && a.orders.map((o) => <OrderRow key={o.id} height={o.bitmapHeight!} price={o.priceSats} tone="text-bitcoin" fresh={flash.added.has(o.id)}
                  action={o.inscriptionId ? <BuyButton offerId={o.id} priceSats={o.priceSats} inscriptionId={o.inscriptionId} height={o.bitmapHeight!} className="btn-term w-full whitespace-nowrap !px-1 !py-0.5 text-[10px]" /> : null} />)}
              </Fragment>
            ))}
          </ol>
          {flash.gone.length > 0 && (
            <ul aria-label="Recently removed orders" className="border-t border-border/50">
              {flash.gone.map((g) => <li key={g.id} className="book-flash-gone px-3 py-0.5 font-mono text-[10px] text-bitcoin" data-no-translate>{g.label} · FILLED OR CANCELLED</li>)}
            </ul>
          )}
          <div className="flex items-center justify-between border-y border-border bg-muted/30 px-3 py-2 font-mono text-[11px]" data-no-translate>
            <span className="label">MID</span>
            <span className="font-bold">{spread ? formatSats(Math.round(spread.mid)) : "—"}</span>
            <span className="text-muted-foreground">{spread && usd(spread.mid) !== null ? `≈ ${usd(spread.mid)}` : `ASK ${formatSats(askTotal)} · BID ${formatSats(bidTotal)}`}</span>
          </div>
          <ol aria-label="Bids">
            {bidDepth.length === 0 ? <Empty text={bids.isPending ? "READING BIDS…" : "NO OPEN BIDS"} /> : bidDepth.map((b) => (
              <Fragment key={b.key}>
                <LevelRow side="bid" level={b.level} count={b.count} cum={b.cumSats} pct={b.depthPct} tick={tick} open={open === b.key} onToggle={() => setOpen(open === b.key ? null : b.key)} fresh={b.orders.some((o) => flash.added.has(o.id))}
                  single={tick === 0 && b.count === 1 ? { bitmapHeight: b.orders[0]!.bitmapHeight } : null} />
                {open === b.key && b.orders.map((o) => <OrderRow key={o.id} height={o.bitmapHeight} price={o.priceSats} tone="text-signal" fresh={flash.added.has(o.id)}
                  action={<Link to="/bitmap/$block" params={{ block: String(o.bitmapHeight) }} className="btn-term-ghost block w-full !px-1 !py-0.5 text-center text-[10px]">FILL</Link>} />)}
              </Fragment>
            ))}
          </ol>
        </div>

        {/* Tape */}
        <div className="bg-card">
          <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-border px-3 py-2 font-mono"><span className="label">TIME</span><span className="label">BITMAP · SIDE · FEE</span><span className="label text-right">PRICE</span></div>
          <ol className="max-h-[30rem] overflow-y-auto" aria-label="Live sales tape" aria-live="polite">
            {sales.length === 0 ? <Empty text={tape.isPending ? "READING TAPE…" : "NO SALES YET"} /> : sales.slice(0, 60).map((t, i) => <TapeRow key={t.txid} t={t} side={t.buyer_address && bidders.has(`${t.bitmap_height}:${t.buyer_address}`) ? "bid" : "ask"} mem={mem.tx[t.txid]} rec={mem.rec} up={sales[i + 1] ? t.price_sats >= sales[i + 1]!.price_sats : true} hydrated={hydrated} />)}
          </ol>
        </div>
      </div>
      <TerminalCharts
        asks={allAsks}
        bids={allBids}
        scope={scope}
        loading={offers.isPending || bids.isPending}
      />
      <p className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">ASKS ARE SIGNED SALE PSBTS · BIDS ARE SIGNED INTENTS · TAPE IS TRACED BITCOIN TXS · EVERY BUY IS SIGNED IN YOUR OWN WALLET</p>
    </section>
  );
}

type MemTx = { rate: number; rbf: boolean; replacedBy: string | null; missing: boolean };
type Rec = { fastestFee: number; halfHourFee: number; hourFee: number };
const TIER: Record<FeeTier, { label: string; cls: string }> = {
  next: { label: "NEXT BLOCK <10M", cls: "border-signal/60 text-signal" },
  soon: { label: "~30M", cls: "border-border text-foreground" },
  lagging: { label: "LAGGING ~1H+", cls: "border-bitcoin/60 text-bitcoin" },
};

function TapeRow({ t, up, hydrated, side, mem, rec }: { t: TradeRow; up: boolean; hydrated: boolean; side: "ask" | "bid"; mem?: MemTx; rec: Rec | null }) {
  const tier = mem && rec && !mem.missing ? feeTier(mem.rate, rec) : null;
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 border-b border-border/50 px-3 py-1 font-mono text-[11px] animate-in fade-in" data-no-translate>
      <span className="text-muted-foreground">{hydrated ? timeAgo(t.block_time ?? t.created_at) : "…"}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        <Link to="/bitmap/$block" params={{ block: String(t.bitmap_height) }} className="truncate hover:text-signal">{t.bitmap_height}.BITMAP</Link>
        <span title={side === "ask" ? "Buyer lifted a listed ask" : "Seller filled an open bid"} className={`border px-1 text-[9px] ${side === "ask" ? "border-signal/60 bg-signal/10 text-signal" : "border-bitcoin/60 bg-bitcoin/10 text-bitcoin"}`}>{side === "ask" ? "▲ TAKER BUY" : "▼ BID FILL"}</span>
        {!t.block_height && (mem?.missing
          ? <span title="No longer in the mempool — replaced or dropped" className="border border-destructive/60 px-1 text-[9px] text-destructive">DROPPED / REPLACED</span>
          : <>
              <span className="border border-border px-1 text-[9px] text-muted-foreground">MEMPOOL</span>
              {mem && <span title="Fee rate vs mempool.space recommended fees" className={`border px-1 text-[9px] ${tier ? TIER[tier].cls : "border-border text-muted-foreground"}`}>{mem.rate.toFixed(1)} SAT/VB{tier ? ` · ${TIER[tier].label}` : ""}</span>}
              {mem?.replacedBy ? <a href={`https://mempool.space/tx/${mem.replacedBy}`} target="_blank" rel="noreferrer" className="border border-bitcoin bg-bitcoin/15 px-1 text-[9px] text-bitcoin">RBF REPLACED ↗</a>
                : mem?.rbf ? <span title="Signals BIP-125 replace-by-fee: the fee can still be bumped" className="border border-bitcoin/50 px-1 text-[9px] text-bitcoin">RBF</span> : null}
            </>)}
      </span>
      <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className={`text-right hover:underline ${up ? "text-signal" : "text-destructive"}`}>{formatSats(t.price_sats)} {up ? "▲" : "▼"}</a>
    </li>
  );
}

function LevelRow({ side, level, count, cum, pct, tick, open, onToggle, fresh, single }: { side: "ask" | "bid"; level: number; count: number; cum: number; pct: number; tick: number; open: boolean; onToggle: () => void; fresh: boolean; single: { bitmapHeight: number | null; id?: string; inscriptionId?: string | null; priceSats?: number } | null }) {
  const tone = side === "ask" ? "text-bitcoin" : "text-signal";
  return (
    <li className={`relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-1 font-mono text-[11px] ${fresh ? "book-flash-new" : ""}`} data-no-translate>
      <span className={`absolute inset-y-0 right-0 ${side === "ask" ? "bg-bitcoin/10" : "bg-signal/10"}`} style={{ width: `${pct}%` }} aria-hidden />
      {single?.bitmapHeight != null
        ? <Link to="/bitmap/$block" params={{ block: String(single.bitmapHeight) }} className="relative hover:text-signal">{single.bitmapHeight}.BITMAP</Link>
        : <span className="relative text-muted-foreground">{count} ORDER{count === 1 ? "" : "S"}</span>}
      <span className={`relative text-right ${tone}`}>{tick && side === "ask" ? "≤ " : tick ? "≥ " : ""}{formatSats(level)}</span>
      <span className="relative w-20 text-right text-muted-foreground">{formatSats(cum)}</span>
      <span className="relative w-14">
        {single && side === "ask" && single.id && single.inscriptionId
          ? <BuyButton offerId={single.id} priceSats={single.priceSats!} inscriptionId={single.inscriptionId} height={single.bitmapHeight!} className="btn-term w-full whitespace-nowrap !px-1 !py-0.5 text-[10px]" />
          : single && side === "bid"
            ? <Link to="/bitmap/$block" params={{ block: String(single.bitmapHeight) }} className="btn-term-ghost block w-full !px-1 !py-0.5 text-center text-[10px]">FILL</Link>
            : <button type="button" onClick={onToggle} aria-expanded={open} className="btn-term-ghost w-full !px-1 !py-0.5 text-[10px]">{open ? "HIDE" : `${count} ▾`}</button>}
      </span>
    </li>
  );
}

function OrderRow({ height, price, tone, fresh, action }: { height: number; price: number; tone: string; fresh: boolean; action: React.ReactNode }) {
  return (
    <li className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 bg-muted/20 py-0.5 pl-6 pr-3 font-mono text-[10px] ${fresh ? "book-flash-new" : ""}`} data-no-translate>
      <Link to="/bitmap/$block" params={{ block: String(height) }} className="hover:text-signal">↳ {height}.BITMAP</Link>
      <span className={`text-right ${tone}`}>{formatSats(price)}</span>
      <span className="w-20" />
      <span className="w-14">{action}</span>
    </li>
  );
}

function BookHead({ tick }: { tick: number }) {
  return <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border px-3 py-2"><span className="label">{tick ? "LEVEL" : "BITMAP"}</span><span className="label text-right">PRICE</span><span className="label w-20 text-right">TOTAL</span><span className="w-14" /></div>;
}

/** Flash newly posted orders cyan; keep removed ones briefly as amber ghosts. */
function useBookFlash(ids: string[], ready: boolean) {
  const prev = useRef<string[] | null>(null);
  const labels = useRef(new Map<string, string>());
  const [state, setState] = useState<{ added: Set<string>; gone: { id: string; label: string }[] }>({ added: new Set(), gone: [] });
  const key = ids.join(",");
  useEffect(() => {
    if (!ready) return;
    if (prev.current === null) { prev.current = ids; return; }
    const d = diffIds(prev.current, ids);
    prev.current = ids;
    if (!d.added.length && !d.removed.length) return;
    setState({ added: new Set(d.added), gone: d.removed.slice(0, 5).map((id) => ({ id, label: labels.current.get(id) ?? "ORDER" })) });
    const t = setTimeout(() => setState({ added: new Set(), gone: [] }), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  return { ...state, labels: labels.current };
}

/** Fee rate, RBF signal and replacement status for unconfirmed tape txs, read from mempool.space. */
function useMempoolInfo(txids: string[], enabled: boolean) {
  const rec = useQuery({
    queryKey: ["mempool-fees-rec"],
    queryFn: async () => (await (await fetch("https://mempool.space/api/v1/fees/recommended")).json()) as Rec,
    enabled, staleTime: 30_000, refetchInterval: 60_000,
  });
  const tx = useQuery({
    queryKey: ["mempool-tape-tx", txids.join(",")],
    enabled: enabled && txids.length > 0, staleTime: 20_000, refetchInterval: 30_000,
    queryFn: async () => {
      const out: Record<string, MemTx> = {};
      await Promise.all(txids.map(async (id) => {
        try {
          const r = await fetch(`https://mempool.space/api/tx/${id}`);
          if (r.status === 404) { out[id] = { rate: 0, rbf: false, replacedBy: null, missing: true }; return; }
          if (!r.ok) return;
          const j = await r.json() as { fee: number; weight: number; vin: { sequence: number }[]; status: { confirmed: boolean } };
          let replacedBy: string | null = null;
          const rr = await fetch(`https://mempool.space/api/v1/tx/${id}/rbf`).catch(() => null);
          if (rr?.ok) { const k = await rr.json().catch(() => null) as { replacements?: { tx?: { txid?: string } } } | null; const nt = k?.replacements?.tx?.txid; if (nt && nt !== id) replacedBy = nt; }
          out[id] = { rate: j.fee / (j.weight / 4), rbf: signalsRbf(j.vin.map((v) => v.sequence)), replacedBy, missing: false };
        } catch { /* leave untagged */ }
      }));
      return out;
    },
  });
  return { rec: rec.data ?? null, tx: tx.data ?? {} };
}

function Empty({ text }: { text: string }) {
  return <li className="px-3 py-4 font-mono text-[11px] text-muted-foreground">&gt; {text}</li>;
}
function Kv({ k, v, tone = "text-foreground", suffix = "" }: { k: string; v: string; tone?: string; suffix?: string }) {
  return <span className="flex items-baseline gap-1.5"><span className="label">{k}</span><span className={`font-bold ${tone}`}>{v}</span>{suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}</span>;
}
