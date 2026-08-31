import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { trendingQuery } from "@/lib/profiles";
import { timeAgo } from "@/lib/bitmap";

/** Most-visited parcels, ranked by tracked page views. */
export function TrendingParcels({ limit = 8 }: { limit?: number }) {
  const trending = useQuery(trendingQuery(limit));
  const rows = trending.data ?? [];

  if (!trending.isLoading && rows.length === 0) return null;

  return (
    <section className="mt-8 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="display text-lg">TRENDING — MOST VISITED</h2>
        <span className="label">TRACKED PARCEL VIEWS</span>
      </header>
      {trending.isLoading ? (
        <p className="px-5 py-5 font-mono text-xs text-muted-foreground">
          &gt; READING VISIT COUNTERS<span className="blink">_</span>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.bitmapHeight} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3">
              <Link
                to="/bitmap/$block"
                params={{ block: String(r.bitmapHeight) }}
                className="display text-sm underline decoration-border underline-offset-4 hover:text-foreground"
              >
                #{String(i + 1).padStart(2, "0")} · {r.bitmapHeight}.BITMAP
              </Link>
              <span className="label">
                {r.totalViews.toLocaleString("en-US")} VIEWS ·{" "}
                {r.uniqueVisitors.toLocaleString("en-US")} VISITORS
                {r.lastViewedAt ? ` · ${timeAgo(r.lastViewedAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
