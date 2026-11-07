import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPortfolioActivity } from "@/lib/portfolio-activity";
import { myWatchesQuery } from "@/lib/watches";
import { formatSats } from "@/lib/trades";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

/**
 * Property-manager view of the holder's bitmaps: one aggregated pulse per
 * bitmap plus the shortlist of things that actually need attention. All rows
 * come from real recorded activity (views, bids, trades, builds, leases, BIT).
 */
export function BitmapManager({
  name,
  addresses,
  heldHeights,
  enabled,
}: {
  name: string;
  addresses: string[];
  heldHeights: number[];
  enabled: boolean;
}) {
  const watches = useQuery(myWatchesQuery(enabled));
  const watchedHeights = useMemo(
    () => (watches.data ?? []).map((w) => w.height),
    [watches.data],
  );

  const key = useMemo(
    () => [[...heldHeights].sort((a, b) => a - b), [...watchedHeights].sort((a, b) => a - b)],
    [heldHeights, watchedHeights],
  );

  const activity = useQuery({
    queryKey: ["portfolio-activity", key],
    queryFn: () =>
      fetchPortfolioActivity(supabase, {
        addresses,
        heldHeights,
        watchedHeights,
        windowHours: 24,
        limit: 12,
      }),
    enabled: enabled && (heldHeights.length > 0 || watchedHeights.length > 0),
    staleTime: 30_000,
  });

  const data = activity.data;
  const pulses = data?.pulses ?? [];

  return (
    <section className="border border-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="label">BITMAP MANAGER</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {greeting()}, {name.toUpperCase()} — LAST 24 HOURS
          </p>
        </div>
        <Link to="/marketplace" className="label hover:text-foreground">
          MANAGE MY BITMAPS →
        </Link>
      </header>

      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="label">VISITS</p>
          <p className="display mt-1 text-2xl">{(data?.totals.visits ?? 0).toLocaleString("en-US")}</p>
        </div>
        <div>
          <p className="label">NEW BIDS</p>
          <p className="display mt-1 text-2xl">
            {data?.totals.newBids ?? 0}
            {data?.totals.topBidSats ? (
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                TOP {formatSats(data.totals.topBidSats)}
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="label">BUILD UPDATES</p>
          <p className="display mt-1 text-2xl">{data?.totals.buildUpdates ?? 0}</p>
        </div>
        <div>
          <p className="label">LEASES ENDING</p>
          <p className="display mt-1 text-2xl">{data?.totals.leasesExpiringSoon ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <p className="label">PORTFOLIO ACTIVITY</p>
          {activity.isLoading ? (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">&gt; READING ACTIVITY_</p>
          ) : pulses.length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              &gt; NOTHING MOVED ON YOUR BITMAPS IN THE LAST 24 HOURS_
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {pulses.map((p) => (
                <li key={p.height} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(p.height) }}
                    className="font-mono text-xs hover:text-primary"
                  >
                    #{p.height.toLocaleString("en-US")}
                    {p.watched && !p.held ? (
                      <span className="ml-2 label text-primary">WATCHING</span>
                    ) : null}
                  </Link>
                  <span className="text-right font-mono text-[11px] text-muted-foreground">
                    {p.highlights.slice(0, 3).join(" · ").toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4">
          <p className="label">WHAT NEEDS YOUR ATTENTION</p>
          {(data?.attention ?? []).length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">&gt; ALL CLEAR_</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {(data?.attention ?? []).map((a, i) => (
                <li key={a.height} className="font-mono text-[11px]">
                  <span className="text-muted-foreground">{i + 1}.</span>{" "}
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(a.height) }}
                    className="hover:text-primary"
                  >
                    #{a.height.toLocaleString("en-US")}
                  </Link>{" "}
                  <span className="text-muted-foreground">— {a.reason.toUpperCase()}</span>
                </li>
              ))}
            </ol>
          )}
          {watchedHeights.length > 0 ? (
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">
              WATCHING {watchedHeights.length} BITMAP(S)
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
