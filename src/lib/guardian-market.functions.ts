import { createServerFn } from "@tanstack/react-start";
import { GUARDIAN_MASTER_DELEGATE_ID, GUARDIAN_MASTER_DELEGATE_IDS, GUARDIAN_V6_MASTER_ID } from "@/lib/guardian-delegate";

const ORD = "https://ordinals.com";
const MAX_PAGES = 20;

/** Every inscription ordinals.com lists as a child of a Guardian master (V6 first). */
async function guardianIds(): Promise<{ ids: string[]; unavailable: boolean }> {
  const masters = [GUARDIAN_MASTER_DELEGATE_ID, ...GUARDIAN_MASTER_DELEGATE_IDS.filter((m) => m !== GUARDIAN_MASTER_DELEGATE_ID)];
  const seen = new Set<string>();
  let unavailable = false;
  for (const master of masters) {
    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const res = await fetch(`${ORD}/r/children/${master}/${page}`, {
          headers: { Accept: "application/json", "User-Agent": "curl/8.5.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) { unavailable = true; break; }
        const body = (await res.json()) as { ids?: string[]; more?: boolean };
        for (const id of body.ids ?? []) if (/^[0-9a-f]{64}i\d+$/.test(id)) seen.add(id);
        if (!body.more) break;
      } catch { unavailable = true; break; }
    }
  }
  return { ids: [...seen], unavailable };
}

/** Public: the collection and its sales come from the chain only. */
export const getGuardianMarketFn = createServerFn({ method: "GET" }).handler(async () => {
  const { ids, unavailable } = await guardianIds();
  const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
  const sales = await verifiedSalesFor(ids);
  return {
    ids,
    parent: GUARDIAN_V6_MASTER_ID,
    indexUnavailable: unavailable,
    sales: sales.sales,
    salesUnavailable: sales.unavailable,
  };
});
