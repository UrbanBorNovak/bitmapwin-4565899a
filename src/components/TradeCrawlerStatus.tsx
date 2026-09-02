import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";

function ago(iso: string | null) {
  if (!iso) return "—";
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs}S AGO`;
  if (secs < 3600) return `${Math.round(secs / 60)}M AGO`;
  return `${Math.round(secs / 3600)}H AGO`;
}

/**
 * Live progress of the continuous on-chain sale crawler: how much of the
 * registry has been checked and how many confirmed sales it has found.
 */
export function TradeCrawlerStatus() {
  const progressFn = useServerFn(tradeCrawlProgressFn);

  const progress = useQuery({
    queryKey: ["trade-crawl", "progress"],
    queryFn: () => progressFn(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const data = progress.data;
  // New sales discovered since this page was opened.
  const baseline = useRef<number | null>(null);
  const [found, setFound] = useState(0);
  useEffect(() => {
    if (data?.sales === undefined) return;
    if (baseline.current === null) baseline.current = data.sales;
    setFound(Math.max(0, data.sales - baseline.current));
  }, [data?.sales]);

  const pct =
    data && data.totalBitmaps > 0
      ? Math.min(100, (data.crawledBitmaps / data.totalBitmaps) * 100)
      : 0;

  return (
    <div className="border border-border bg-card p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground">CHAIN CRAWLER</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse bg-primary" aria-hidden />
          {progress.isFetching ? "SCANNING" : "LIVE"}
        </span>
      </div>
      <p className="mt-2 leading-relaxed">
        CONTINUOUSLY TRACING BITMAP INSCRIPTIONS FOR CONFIRMED BITCOIN TRANSFERS AND SALES.
      </p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span>REGISTRY CHECKED</span>
          <span className="text-foreground">
            {(data?.crawledBitmaps ?? 0).toLocaleString("en-US")} /{" "}
            {(data?.totalBitmaps ?? 0).toLocaleString("en-US")} · {pct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full bg-muted" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${Math.max(pct, 0.5)}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <dt>TRANSFERS FOUND</dt>
          <dd className="text-foreground">{(data?.transfers ?? 0).toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>PAID SALES FOUND</dt>
          <dd className="text-foreground">{(data?.sales ?? 0).toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>BITMAPS WITH MOVES</dt>
          <dd className="text-foreground">{(data?.tradedBitmaps ?? 0).toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>SALES · LAST 24H</dt>
          <dd className="text-foreground">{(data?.salesLast24h ?? 0).toLocaleString("en-US")}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <span>LAST RUN {ago(data?.lastRunAt ?? null)}</span>
        <span className="text-primary">+{found} NEW THIS SESSION</span>
      </div>
    </div>
  );
}
