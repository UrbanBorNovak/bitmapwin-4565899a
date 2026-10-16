import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { siteFundQuery } from "@/lib/forge-collection.functions";

/**
 * Monthly site fund as an hourglass. The sand is the month's time: the top
 * chamber drains as the UTC month passes. The number shown is only what the
 * donation address received this month — no goal, no lifetime total.
 */
export function SiteFundTracker() {
  const { data } = useQuery(siteFundQuery());
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const p = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  const month = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();
  const daysLeft = Math.ceil((end - now.getTime()) / 86_400_000);
  // Chamber geometry (viewBox 60x100): top chamber y 8..48, bottom 52..92.
  const topY = 8 + 40 * p; // sand surface in top chamber drops
  const botY = 92 - 40 * p; // sand pile rises
  const halfAt = (y: number, top: boolean) => (top ? 22 * (1 - (y - 8) / 40) : 22 * ((y - 52) / 40));
  const tw = halfAt(topY, true);
  const bw = halfAt(botY, false);

  return (
    <div className="mt-5 flex items-center gap-4 border border-border p-3">
      <svg viewBox="0 0 60 100" className="h-28 w-16 shrink-0 text-bitcoin" aria-hidden="true">
        <line x1="4" y1="5" x2="56" y2="5" className="stroke-signal" strokeWidth="2" />
        <line x1="4" y1="95" x2="56" y2="95" className="stroke-signal" strokeWidth="2" />
        <path d="M8 8 L52 8 L32 50 L52 92 L8 92 L28 50 Z" fill="none" className="stroke-border" strokeWidth="1.5" />
        {p < 1 ? <path d={`M${30 - tw} ${topY} L${30 + tw} ${topY} L30 49 Z`} fill="currentColor" opacity="0.85" /> : null}
        <path d={`M8 92 L52 92 L${30 + bw} ${botY} L${30 - bw} ${botY} Z`} fill="currentColor" />
        {p < 1 ? (
          <line x1="30" y1="49" x2="30" y2={botY} stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" className="hourglass-trickle" />
        ) : null}
      </svg>
      <div className="min-w-0 font-mono">
        <div className="label text-accent">SITE FUND // {month}</div>
        <div className="mt-1 text-lg text-bitcoin">
          {data ? `${data.monthComplete ? "" : "≥ "}${data.monthSats.toLocaleString("en-US")}` : "—"} <span className="text-[10px] text-muted-foreground">SATS</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {data ? `${data.monthPayments} SHARES THIS MONTH` : "READING THE CHAIN…"}
        </div>
        {data?.pendingSats ? <div className="text-[10px] text-signal">+{data.pendingSats.toLocaleString("en-US")} SATS CONFIRMING</div> : null}
        <div className="text-[10px] text-muted-foreground">{daysLeft} DAYS UNTIL THE GLASS TURNS</div>
        <Link to="/donate" className="mt-1 inline-flex text-xs font-bold text-bitcoin hover:text-foreground">SHARE & FUEL →</Link>
      </div>
    </div>
  );
}
