import { createServerFn } from "@tanstack/react-start";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

const ID_RE = /^[0-9a-f]{64}i\d+$/;

/** Only confirmed BITMAPWIN purchases with matching chain payouts count. */
export const getJigglypuffSalesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
  return verifiedSalesFor(JIGGLYPUFF_IDS);
});

/** Confirmed on-chain BITMAPWIN sales for any collection's inscription ids (public facts only). */
export const getCollectionSalesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[] }) => {
    const ids = Array.isArray(d?.ids) ? d.ids.filter((i) => typeof i === "string" && ID_RE.test(i)).slice(0, 6000) : [];
    return { ids };
  })
  .handler(async ({ data }) => {
    const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
    return verifiedSalesFor(data.ids);
  });
