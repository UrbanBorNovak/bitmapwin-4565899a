import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeTrade } from "@/lib/trade-merge";
import type { TradeRow } from "@/lib/trade-store";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { fetchRecentTrades } from "@/lib/trade-store";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";
import { feedFreshness, utcStamp, type Freshness } from "@/lib/feed-freshness";

/** Live tape of traced on-chain BITMAP trades (real Bitcoin txs only). Polls every 30s. */
const WHALE_SATS = 100_000;
type Filter = "sales" | "whale" | "moves";

function short(a: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "UNKNOWN";
}

const FRESH_UI: Record<Freshness, { label: string; tone: string; note: string }> = {
  live: { label: "INDEXER LIVE", tone: "border-signal text-signal", note: "" },
  delayed: { label: "INDEXER DELAYED", tone: "border-bitcoin text-bitcoin", note: "The indexer has not synced in over 15 minutes. Very recent sales may be missing." },
  stale: { label: "FEED STALE", tone: "border-destructive text-destructive", note: "The indexer has not synced in over an hour. Check mempool.space before trading on these prices." },
  unknown: { label: "SYNC UNKNOWN", tone: "border-border text-muted-foreground", note: "No indexer run has been recorded yet." },
};

const FEED_KEY = ["live-trades-feed"] as const;

export function LiveTradesFeed({ scope }: { scope?: { label: string; match: ((h: number) => boolean) | null } } = {}) {
  const [filter, setFilter] = useState<Filter>("sales");
  const [live, setLive] = useState(false);
  const [fresh_, setFresh] = useState<Set<string>>(() => new Set());
  const qc = useQueryClient();
  const listRef = useRef<HTMLUListElement>(null);
  const anchor = useRef<{ top: number; height: number } | null>(null);
  const progressFn = useServerFn(tradeCrawlProgressFn);
  const progress = useQuery({ queryKey: ["trade-crawl", "progress"], queryFn: () => progressFn(), staleTime: 10_000, refetchInterval: 15_000 });

  // Live subscription; polling below only runs fast while this is down.
  useEffect(() => {
    const channel = supabase
      .channel("market-trades-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, (payload) => {
        const row = payload.new as TradeRow | undefined;
        if (!row?.txid) return;
        const el = listRef.current;
        anchor.current = el && el.scrollTop > 0 ? { top: el.scrollTop, height: el.scrollHeight } : null;
        qc.setQueryData<TradeRow[]>(FEED_KEY, (old) => mergeTrade(old ?? [], row));
        setFresh((s) => new Set(s).add(row.txid));
        window.setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(row.txid); return n; }), 4000);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const q = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchRecentTrades(150),
    refetchInterval: live ? 5 * 60_000 : 30_000,
    staleTime: 15_000,
  });
  const rows = useMemo(() => {
    const all = (q.data ?? []).filter((r) => !scope?.match || (r.bitmap_height != null && scope.match(r.bitmap_height)));
    if (filter === "whale") return all.filter((r) => r.price_sats >= WHALE_SATS);
    if (filter === "moves") return all.filter((r) => r.price_sats <= 0);
    return all.filter((r) => r.price_sats > 0);
  }, [q.data, filter, scope]);
  // Keep the reader's place when a new row lands above them.
  useLayoutEffect(() => {
    const el = listRef.current;
    const a = anchor.current;
    if (el && a) el.scrollTop = a.top + (el.scrollHeight - a.height);
    anchor.current = null;
  }, [q.data]);
  const sales = (q.data ?? []).filter((r) => r.price_sats > 0 && (!scope?.match || (r.bitmap_height != null && scope.match(r.bitmap_height))));
  const volume = sales.reduce((a, r) => a + r.price_sats, 0);
  const top = sales.reduce((m, r) => Math.max(m, r.price_sats), 0);
  const lastRunAt = progress.data?.lastRunAt ?? null;
  const fresh = progress.isPending ? null : progress.isError ? "unknown" : feedFreshness(lastRunAt);
  const ui = fresh ? FRESH_UI[fresh] : null;
  const latestSale = sales[0];

  return (
    <section className="border border-border bg-card/60 backdrop-blur-md" aria-labelledby="live-trades">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 id="live-trades" className="display flex items-center gap-2 text-xl">
            <span className="relative flex size-2" aria-hidden>
              {fresh === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />}
              <span className={`relative inline-flex size-2 rounded-full ${fresh === "live" ? "bg-signal" : "bg-muted-foreground"}`} />
            </span>
            LIVE ON-CHAIN TRADES
          </h2>
          <p className="label mt-1" data-no-translate>
            {sales.length} RECENT SALES · {formatSats(volume)} VOLUME · TOP {top ? formatSats(top) : "—"}
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Trade filter">
          {([["sales", "ALL SALES"], ["whale", "WHALE ≥0.001"], ["moves", "TRANSFERS"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              className={`h-8 border px-2 font-mono text-[10px] ${filter === id ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:text-signal"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 font-mono text-[10px] text-muted-foreground" role="status" aria-live="polite">
        {ui ? <span className={`border px-1.5 py-0.5 ${ui.tone}`}>{ui.label}</span> : <span>CHECKING INDEXER…</span>}
        <span data-no-translate>LAST SYNC: {lastRunAt ? `${utcStamp(lastRunAt)} (${timeAgo(lastRunAt)})` : "—"}</span>
        <span data-no-translate>NEWEST SALE CONFIRMED: {latestSale ? `${utcStamp(latestSale.block_time ?? latestSale.created_at)}${latestSale.block_height ? ` · BLK ${latestSale.block_height}` : ""}` : "—"}</span>
        <span data-no-translate className={live ? "text-signal" : "text-bitcoin"}>{live ? "● STREAMING" : "○ POLLING EVERY 30S"}</span>
        {q.dataUpdatedAt ? <span data-no-translate>FEED REFRESHED {timeAgo(new Date(q.dataUpdatedAt).toISOString())}</span> : null}
      </div>
      {ui?.note && <p className={`border-b border-border px-4 py-2 font-mono text-[11px] ${ui.tone.split(" ")[1]}`}>⚠ {ui.note}</p>}

      {q.isPending ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">&gt; READING TRADES FROM CHAIN…</p>
      ) : q.isError ? (
        <div className="p-6 font-mono text-xs text-destructive">
          &gt; COULD NOT LOAD TRADES. <button type="button" className="underline" onClick={() => q.refetch()}>RETRY</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; {filter === "whale" ? "NO SALES OF 0.001 BTC OR MORE IN THE LATEST 150 TRADES." : filter === "moves" ? "NO PLAIN TRANSFERS IN THE LATEST 150 TRADES." : "NO CONFIRMED SALES INDEXED YET. THE INDEXER KEEPS WATCHING THE CHAIN."}
        </p>
      ) : (
        <ul ref={listRef} className="max-h-[360px] [overflow-anchor:none] divide-y divide-border overflow-y-auto" data-no-translate>
          {rows.slice(0, 60).map((r) => {
            const when = r.block_time ?? r.created_at;
            return (
              <li key={r.txid} className={`${fresh_.has(r.txid) ? "bg-signal/10 " : ""}transition-colors duration-1000 grid grid-cols-2 gap-2 p-3 font-mono text-[11px] sm:grid-cols-12 sm:items-center`}>
                <Link to="/bitmap/$block" params={{ block: String(r.bitmap_height) }} className="font-bold text-foreground hover:text-bitcoin sm:col-span-2">
                  {r.bitmap_height}.BITMAP
                </Link>
                <span className={`sm:col-span-2 ${r.price_sats >= WHALE_SATS ? "font-bold text-bitcoin" : r.price_sats > 0 ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {r.price_sats > 0 ? formatSats(r.price_sats) : "TRANSFER"}
                </span>
                <span className="col-span-2 text-muted-foreground sm:col-span-3">{short(r.seller_address)} → {short(r.buyer_address)}</span>
                <span className="text-muted-foreground sm:col-span-3" title={r.block_time ? "Block time" : "Indexed time (block time unknown)"}>
                  {r.block_height ? "CONFIRMED " : "SEEN "}{utcStamp(when)} · {timeAgo(when)}
                </span>
                <a href={`https://mempool.space/tx/${r.txid}`} target="_blank" rel="noreferrer" className="text-right text-signal underline sm:col-span-2">
                  {r.block_height ? `BLK ${r.block_height}` : "UNCONFIRMED"} ↗
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
