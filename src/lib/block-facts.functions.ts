import { createServerFn } from "@tanstack/react-start";

/** Advances the block facts indexer by one small, server-locked window. */
export const runBlockFactsCrawlFn = createServerFn({ method: "POST" }).handler(async () => {
  const { crawlBlockFacts } = await import("@/lib/block-facts.server");
  return crawlBlockFacts();
});
