import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runTradeCrawlFn } from "@/lib/trade-crawler.functions";

/**
 * Headless driver that keeps the on-chain sale crawler advancing on every page,
 * not just the marketplace. The server throttles runs, so ticking often is safe.
 */
export function TradeCrawlerDriver() {
  const queryClient = useQueryClient();
  const crawlFn = useServerFn(runTradeCrawlFn);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (running.current || document.hidden) return;
      running.current = true;
      try {
        const result = await crawlFn({ data: { batch: 12 } });
        if (cancelled || result.skipped) return;
        await queryClient.invalidateQueries({ queryKey: ["trade-crawl"] });
        if (result.transfersFound > 0) {
          await queryClient.invalidateQueries({ queryKey: ["trades"] });
        }
      } catch {
        // Public Bitcoin APIs throttle sometimes; the next tick retries.
      } finally {
        running.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [crawlFn, queryClient]);

  return null;
}
