import { createServerFn } from "@tanstack/react-start";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

/** Only confirmed BITMAPWIN purchases with matching chain payouts count. */
export const getJigglypuffSalesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
  return verifiedSalesFor(JIGGLYPUFF_IDS);
});
