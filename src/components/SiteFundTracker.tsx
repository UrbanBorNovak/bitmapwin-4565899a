import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { siteFundQuery } from "@/lib/forge-collection.functions";

/** Monthly running-cost goal in sats (servers, indexer, data feeds). */
export const SITE_FUND_GOAL_SATS = 1_000_000;

export function SiteFundTracker() {
  const { data } = useQuery(siteFundQuery());
  const got = data?.receivedSats ?? 0;
  const pct = Math.min(100, (got / SITE_FUND_GOAL_SATS) * 100);
  return (
    <div className="mt-5 border border-border p-3">
      <div className="label flex items-center justify-between text-accent">
        <span>SITE FUND // LIVE</span>
        <span className="font-mono text-[10px] text-muted-foreground">{data ? `${data.payments} PAYMENTS` : "…"}</span>
      </div>
      <p className="mt-2 font-mono text-lg text-foreground">{data ? `${got.toLocaleString("en-US")} sats` : "—"}</p>
      <div className="mt-2 h-1.5 w-full bg-muted"><div className="h-full bg-bitcoin" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {pct.toFixed(1)}% OF {SITE_FUND_GOAL_SATS.toLocaleString("en-US")} SATS HOSTING GOAL{data?.pendingSats ? ` · +${data.pendingSats.toLocaleString("en-US")} IN MEMPOOL` : ""}
      </p>
      <Link to="/donate" className="mt-2 inline-flex font-mono text-xs font-bold text-bitcoin hover:text-foreground">SUPPORT THE SITE →</Link>
    </div>
  );
}
