import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { siteFundQuery } from "@/lib/forge-collection.functions";

export function SiteFundTracker() {
  const { data } = useQuery(siteFundQuery());
  const fmt = (n: number) => `${n.toLocaleString("en-US")} sats`;
  return (
    <div className="mt-5 border border-border p-3">
      <div className="label text-accent">SITE FUND // LIVE</div>
      <dl className="mt-2 grid grid-cols-2 gap-2 font-mono">
        <div>
          <dt className="text-[10px] text-muted-foreground">THIS MONTH</dt>
          <dd className="text-sm text-foreground">{data ? `${data.monthComplete ? "" : "≥ "}${fmt(data.monthSats)}` : "—"}</dd>
          <dd className="text-[10px] text-muted-foreground">{data ? `${data.monthPayments} PAYMENTS` : ""}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">LIFETIME</dt>
          <dd className="text-sm text-foreground">{data ? fmt(data.lifetimeSats) : "—"}</dd>
          {data?.pendingSats ? <dd className="text-[10px] text-muted-foreground">+{fmt(data.pendingSats)} PENDING</dd> : null}
        </div>
      </dl>
      <Link to="/donate" className="mt-2 inline-flex font-mono text-xs font-bold text-bitcoin hover:text-foreground">SUPPORT THE SITE →</Link>
    </div>
  );
}
