import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runBlockFactsCrawlFn } from "@/lib/block-facts.functions";

/** Headless driver: advances the block facts indexer while visitors browse. */
export function BlockFactsDriver() {
  const run = useServerFn(runBlockFactsCrawlFn);
  const busy = useRef(false);
  useEffect(() => {
    const tick = async () => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try {
        await run();
      } catch {
        // Public explorers throttle; the next tick retries.
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const timer = window.setInterval(tick, 90_000);
    return () => window.clearInterval(timer);
  }, [run]);
  return null;
}
