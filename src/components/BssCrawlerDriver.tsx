import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runBssCrawlFn, runBssSweepFn } from "@/lib/bss-crawl.functions";

/**
 * Headless driver that keeps on-chain scene discovery advancing while people
 * browse. The server throttles runs and remembers every BITMAP it has checked,
 * so ticking often is safe. When a range is given, discovery concentrates on
 * that stretch of the atlas.
 */
export function BssCrawlerDriver({ lo, hi }: { lo?: number; hi?: number }) {
  const queryClient = useQueryClient();
  const crawl = useServerFn(runBssCrawlFn);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (running.current || document.hidden) return;
      running.current = true;
      try {
        const range = lo !== undefined && hi !== undefined ? { lo, hi } : undefined;
        const result = await crawl({ data: { batch: 12, ...(range ? { range } : {}) } });
        if (cancelled || result.skipped) return;
        await queryClient.invalidateQueries({ queryKey: ["bss-crawl"] });
        if (result.scenesFound > 0) {
          await queryClient.invalidateQueries({ queryKey: ["bss-scenes"] });
        }
      } catch {
        // Public chain endpoints throttle sometimes; the next tick retries.
      } finally {
        running.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 20_000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [crawl, queryClient, lo, hi]);

  return null;
}
