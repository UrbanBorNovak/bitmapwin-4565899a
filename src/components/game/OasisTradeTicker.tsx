import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";

/** Rotating HUD strip of real, confirmed on-chain BITMAP sales. */
export function OasisTradeTicker() {
  const trades = useQuery({ ...recentTradesQuery(12), refetchInterval: 30_000 });
  const sales = (trades.data ?? []).filter((t) => t.price_sats > 0);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (sales.length < 2) return;
    const id = window.setInterval(() => setI((n) => n + 1), 6000);
    return () => window.clearInterval(id);
  }, [sales.length]);

  if (sales.length === 0) return null;
  const t = sales[i % sales.length]!;
  const when = t.block_time ?? t.created_at;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 max-w-[92vw] -translate-x-1/2 border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] backdrop-blur-md">
      <span className="text-signal">⚡ LIVE TRADE</span>{" "}
      <Link to="/bitmap/$block" params={{ block: String(t.bitmap_height) }} className="text-foreground hover:text-bitcoin" data-no-translate>
        {t.bitmap_height}.BITMAP
      </Link>{" "}
      <span className="text-muted-foreground">SOLD FOR</span>{" "}
      <span className="text-bitcoin" data-no-translate>{formatSats(t.price_sats)}</span>
      {when ? <span className="text-muted-foreground"> · {timeAgo(when)}</span> : null}{" "}
      <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className="text-signal hover:text-foreground">[TX]</a>
    </div>
  );
}
