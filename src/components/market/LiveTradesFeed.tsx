import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function LiveTradesFeed() {
  const [filter, setFilter] = useState<Filter>("sales");
  const progressFn = useServerFn(tradeCrawlProgressFn);
  const progress = useQuery({ queryKey: ["trade-crawl", "progress"], queryFn: () => progressFn(), staleTime: 10_000, refetchInterval: 15_000 });
  const q = useQuery({
    queryKey: ["live-trades-feed"],
    queryFn: () => fetchRecentTrades(150),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const rows = useMemo(() => {
    const all = q.data ?? [];
    if (filter === "whale") return all.filter((r) => r.price_sats >= WHALE_SATS);
    if (filter === "moves") return all.filter((r) => r.price_sats <= 0);
    return all.filter((r) => r.price_sats > 0);
  }, [q.data, filter]);
  const sales = (q.data ?? []).filter((r) => r.price_sats > 0);
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
        <ul className="max-h-[360px] divide-y divide-border overflow-y-auto" data-no-translate>
          {rows.slice(0, 60).map((r) => {
            const when = r.block_time ?? r.created_at;
            return (
              <li key={r.txid} className="grid grid-cols-2 gap-2 p-3 font-mono text-[11px] sm:grid-cols-12 sm:items-center">
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
