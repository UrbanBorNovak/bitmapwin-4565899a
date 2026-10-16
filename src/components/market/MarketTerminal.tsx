import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { offersQuery } from "@/lib/offers";
import { openBidsQuery } from "@/lib/bids";
import { fetchRecentTrades, type TradeRow } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";
import { btcPriceQuery, usdFromSats } from "@/lib/btc-price";
import { BuyButton } from "@/components/BuyButton";
import { spreadOf, withDepth } from "@/lib/market-depth";

const LEVELS = 10;
const DAY = 86_400_000;

/**
 * Pro trading terminal: L2 book of real open PSBT asks + signed bid intents,
 * with a live tape of traced on-chain sales. Shares the live-trades cache so
 * realtime fills from LiveTradesFeed flash here too.
 */
export function MarketTerminal() {
  const offers = useQuery(offersQuery());
  const bids = useQuery(openBidsQuery(500));
  const tape = useQuery({ queryKey: ["live-trades-feed"], queryFn: () => fetchRecentTrades(150), staleTime: 15_000, refetchInterval: 60_000 });
  const { data: price } = useQuery(btcPriceQuery());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const asks = useMemo(
    () => (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0 && o.bitmapHeight !== null).sort((a, b) => a.priceSats - b.priceSats).slice(0, LEVELS),
    [offers.data],
  );
  const bidRows = useMemo(() => [...(bids.data ?? [])].sort((a, b) => b.priceSats - a.priceSats).slice(0, LEVELS), [bids.data]);
  const askTotal = asks.reduce((s, a) => s + a.priceSats, 0);
  const bidTotal = bidRows.reduce((s, b) => s + b.priceSats, 0);
  const sideMax = Math.max(askTotal, bidTotal);
  const askDepth = withDepth(asks, sideMax);
  const bidDepth = withDepth(bidRows, sideMax);
  const spread = spreadOf(asks[0]?.priceSats ?? null, bidRows[0]?.priceSats ?? null);

  const sales = useMemo(() => (tape.data ?? []).filter((t) => t.price_sats > 0), [tape.data]);
  const now = hydrated ? Date.now() : 0;
  const day = sales.filter((t) => now - new Date(t.block_time ?? t.created_at).getTime() < DAY);
  const vol24 = day.reduce((s, t) => s + t.price_sats, 0);
  const last = sales[0];
  const prev = sales[1];
  const dir = last && prev ? Math.sign(last.price_sats - prev.price_sats) : 0;
  const usd = (s: number) => (price?.usd ? usdFromSats(s, price.usd) : null);

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
        {price?.usd ? <Kv k="BTC" v={`$${Math.round(price.usd).toLocaleString("en-US")}`} /> : null}
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* L2 book */}
        <div className="bg-card">
          <BookHead />
          <ol className="flex flex-col-reverse" aria-label="Asks">
            {askDepth.length === 0 ? <Empty text={offers.isPending ? "READING ASKS…" : "NO OPEN ASKS"} /> : askDepth.map((a) => (
              <li key={a.id} className="group relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-1 font-mono text-[11px]" data-no-translate>
                <span className="absolute inset-y-0 right-0 bg-bitcoin/10" style={{ width: `${a.depthPct}%` }} aria-hidden />
                <Link to="/bitmap/$block" params={{ block: String(a.bitmapHeight) }} className="relative hover:text-signal">{a.bitmapHeight}.BITMAP</Link>
                <span className="relative text-right text-bitcoin">{formatSats(a.priceSats)}</span>
                <span className="relative w-20 text-right text-muted-foreground">{formatSats(a.cumSats)}</span>
                <span className="relative w-14">
                  {a.inscriptionId ? <BuyButton offerId={a.id} priceSats={a.priceSats} inscriptionId={a.inscriptionId} height={a.bitmapHeight!} className="btn-term w-full whitespace-nowrap !px-1 !py-0.5 text-[10px]" /> : null}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between border-y border-border bg-muted/30 px-3 py-2 font-mono text-[11px]" data-no-translate>
            <span className="label">MID</span>
            <span className="font-bold">{spread ? formatSats(Math.round(spread.mid)) : "—"}</span>
            <span className="text-muted-foreground">{spread && usd(spread.mid) !== null ? `≈ ${usd(spread.mid)}` : `ASK ${formatSats(askTotal)} · BID ${formatSats(bidTotal)}`}</span>
          </div>
          <ol aria-label="Bids">
            {bidDepth.length === 0 ? <Empty text={bids.isPending ? "READING BIDS…" : "NO OPEN BIDS"} /> : bidDepth.map((b) => (
              <li key={b.id} className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-1 font-mono text-[11px]" data-no-translate>
                <span className="absolute inset-y-0 right-0 bg-signal/10" style={{ width: `${b.depthPct}%` }} aria-hidden />
                <Link to="/bitmap/$block" params={{ block: String(b.bitmapHeight) }} className="relative hover:text-signal">{b.bitmapHeight}.BITMAP</Link>
                <span className="relative text-right text-signal">{formatSats(b.priceSats)}</span>
                <span className="relative w-20 text-right text-muted-foreground">{formatSats(b.cumSats)}</span>
                <Link to="/bitmap/$block" params={{ block: String(b.bitmapHeight) }} className="btn-term-ghost relative w-14 !px-1 !py-0.5 text-center text-[10px]">FILL</Link>
              </li>
            ))}
          </ol>
        </div>

        {/* Tape */}
        <div className="bg-card">
          <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-border px-3 py-2"><span className="label">TIME</span><span className="label">BITMAP</span><span className="label text-right">PRICE</span></div>
          <ol className="max-h-[30rem] overflow-y-auto" aria-label="Live sales tape" aria-live="polite">
            {sales.length === 0 ? <Empty text={tape.isPending ? "READING TAPE…" : "NO SALES YET"} /> : sales.slice(0, 60).map((t, i) => <TapeRow key={t.txid} t={t} up={sales[i + 1] ? t.price_sats >= sales[i + 1]!.price_sats : true} hydrated={hydrated} />)}
          </ol>
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">ASKS ARE SIGNED SALE PSBTS · BIDS ARE SIGNED INTENTS · TAPE IS TRACED BITCOIN TXS · EVERY BUY IS SIGNED IN YOUR OWN WALLET</p>
    </section>
  );
}

function TapeRow({ t, up, hydrated }: { t: TradeRow; up: boolean; hydrated: boolean }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 border-b border-border/50 px-3 py-1 font-mono text-[11px] animate-in fade-in" data-no-translate>
      <span className="text-muted-foreground">{hydrated ? timeAgo(t.block_time ?? t.created_at) : "…"}</span>
      <Link to="/bitmap/$block" params={{ block: String(t.bitmap_height) }} className="truncate hover:text-signal">{t.bitmap_height}.BITMAP{t.block_height ? "" : " · MEMPOOL"}</Link>
      <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className={`text-right hover:underline ${up ? "text-signal" : "text-destructive"}`}>{formatSats(t.price_sats)} {up ? "▲" : "▼"}</a>
    </li>
  );
}

function BookHead() {
  return <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border px-3 py-2"><span className="label">BITMAP</span><span className="label text-right">PRICE</span><span className="label w-20 text-right">TOTAL</span><span className="w-14" /></div>;
}
function Empty({ text }: { text: string }) {
  return <li className="px-3 py-4 font-mono text-[11px] text-muted-foreground">&gt; {text}</li>;
}
function Kv({ k, v, tone = "text-foreground", suffix = "" }: { k: string; v: string; tone?: string; suffix?: string }) {
  return <span className="flex items-baseline gap-1.5"><span className="label">{k}</span><span className={`font-bold ${tone}`}>{v}</span>{suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}</span>;
}
