import { Link } from "@tanstack/react-router";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";
import type { TradeRow } from "@/lib/trade-store";

const short = (a: string | null) => (a ? a.slice(-3) : "—");

/** Right-hand live activity rail: confirmed on-chain sales only. */
export function ActivityRail({ trades, loading }: { trades: TradeRow[]; loading: boolean }) {
  const rows = trades.filter((t) => t.price_sats > 0).slice(0, 30);
  return (
    <div className="border border-border bg-card/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label text-foreground">ACTIVITY</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-signal">
          <span className="size-1.5 animate-pulse rounded-full bg-signal" aria-hidden /> CONFIRMED SALES
        </span>
      </div>
      {loading ? (
        <p className="p-4 font-mono text-[11px] text-muted-foreground">READING SALES FROM CHAIN…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 font-mono text-[11px] text-muted-foreground">NO CONFIRMED SALES YET.</p>
      ) : (
        <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto" data-no-translate>
          {rows.map((t) => (
            <li key={t.txid + t.hop} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 font-mono text-[11px]">
              <span className="text-muted-foreground">{timeAgo(t.block_time ?? t.created_at).replace(" ago", "")}</span>
              <span className="min-w-0">
                <Link to="/bitmap/$block" params={{ block: String(t.bitmap_height) }} className="block truncate text-foreground hover:text-bitcoin">
                  {t.bitmap_height.toLocaleString("en-US")}.BITMAP
                </Link>
                <span className="text-[10px] text-muted-foreground">{short(t.seller_address)} → {short(t.buyer_address)}</span>
              </span>
              <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className="font-bold text-bitcoin hover:underline">
                ₿ {formatSats(t.price_sats)}
              </a>
            </li>
          ))}
        </ul>
      )}
      <Link to="/history" className="block border-t border-border px-3 py-2 text-right font-mono text-[10px] text-muted-foreground hover:text-bitcoin">
        ALL SALES →
      </Link>
    </div>
  );
}
