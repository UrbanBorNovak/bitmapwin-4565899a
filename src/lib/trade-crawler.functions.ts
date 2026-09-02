import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Reads how much of the registry has been checked for on-chain sales. */
export const tradeCrawlProgressFn = createServerFn({ method: "GET" }).handler(async () => {
  const { crawlProgress } = await import("@/lib/trade-crawler.server");
  return crawlProgress();
});

/**
 * Advances the crawler by one small batch. Called opportunistically while
 * visitors browse the marketplace, and rate-limited server-side so public
 * Bitcoin APIs are never hammered.
 */
export const runTradeCrawlFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ batch: z.number().int().min(1).max(20).default(8) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { crawlTradesThrottled } = await import("@/lib/trade-crawler.server");
    return crawlTradesThrottled(data.batch);
  });
