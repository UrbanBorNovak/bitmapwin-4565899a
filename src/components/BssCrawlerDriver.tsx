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
  const sweep = useServerFn(runBssSweepFn);
  const running = useRef(false);
  const ticks = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (running.current || document.hidden) return;
      running.current = true;
      try {
        const range = lo !== undefined && hi !== undefined ? { lo, hi } : undefined;
        // Every third pass sweeps real Bitcoin blocks for freshly inscribed
        // scripts; the others check indexed BITMAPs for scripts already on chain.
        const sweepTurn = ticks.current++ % 3 === 2;
        const result = sweepTurn
          ? await sweep({ data: { blocks: 2 } })
          : await crawl({ data: { batch: 12, ...(range ? { range } : {}) } });
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
    const timer = window.setInterval(tick, 90_000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [crawl, sweep, queryClient, lo, hi]);

  return null;
}
