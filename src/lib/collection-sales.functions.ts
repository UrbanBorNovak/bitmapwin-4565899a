import { createServerFn } from "@tanstack/react-start";

/** Nudges the JIGGLYPUFF sales crawler along; throttled server-side. */
export const crawlJigglypuffSalesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { crawlCollectionSales } = await import("@/lib/collection-sales.server");
  const { JIGGLYPUFF_IDS, JIGGLYPUFF_POOL } = await import("@/lib/game/jigglypuff");
  return crawlCollectionSales(JIGGLYPUFF_POOL, JIGGLYPUFF_IDS, 10);
});
