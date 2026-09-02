import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runTradeCrawlFn, tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";

/**
 * Keeps the on-chain sale crawler moving while people browse the marketplace,
 * and shows how much of the bitmap registry has been checked so far.
 */
export function TradeCrawlerStatus() {
  const queryClient = useQueryClient();
  const progressFn = useServerFn(tradeCrawlProgressFn);
  const crawlFn = useServerFn(runTradeCrawlFn);
  const running = useRef(false);

  const progress = useQuery({
    queryKey: ["trade-crawl", "progress"],
    queryFn: () => progressFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (running.current || document.hidden) return;
      running.current = true;
      try {
        const result = await crawlFn({ data: { batch: 8 } });
        if (cancelled) return;
        if (!result.skipped && result.transfersFound > 0) {
          await queryClient.invalidateQueries({ queryKey: ["trades"] });
        }
        if (!result.skipped) {
          await queryClient.invalidateQueries({ queryKey: ["trade-crawl"] });
        }
      } catch {
        // Public Bitcoin APIs throttle sometimes; the next tick retries.
      } finally {
        running.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [crawlFn, queryClient]);

  const data = progress.data;

  return (
    <div className="border border-border bg-card p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground">CHAIN CRAWLER</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse bg-primary" aria-hidden />
          LIVE
        </span>
      </div>
      <p className="mt-2 leading-relaxed">
        SCANNING BITMAP INSCRIPTIONS FOR CONFIRMED BITCOIN TRANSFERS AND SALES.
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <dt>BITMAPS CHECKED</dt>
          <dd className="text-foreground">{(data?.crawledBitmaps ?? 0).toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>WITH ON-CHAIN MOVES</dt>
          <dd className="text-foreground">{(data?.tradedBitmaps ?? 0).toLocaleString("en-US")}</dd>
        </div>
      </dl>
    </div>
  );
}
