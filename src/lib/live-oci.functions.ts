import { createServerFn } from "@tanstack/react-start";

/**
 * LiveOCI frontier for the marketplace: real counts past the 942k OCI, plus a
 * small, throttled sweep that resolves the newest unindexed blocks on chain.
 */
const OCI_LIMIT = 970_000;
const SWEEP = 2;
let lastSweep = 0;

export const liveOciStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let tip: number | null = null;
  try {
    const r = await fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(6000) });
    const n = Number((await r.text()).trim());
    if (Number.isInteger(n) && n > 0) tip = n;
  } catch { /* tip stays null */ }

  // Sweep: newest mined blocks ≥942k not yet in the index, at most once a minute.
  if (tip && Date.now() - lastSweep > 60_000) {
    lastSweep = Date.now();
    const { data } = await supabaseAdmin
      .from("bitmap_index")
      .select("block_height")
      .gte("block_height", Math.max(OCI_LIMIT, tip - 200))
      .lte("block_height", tip);
    const known = new Set((data ?? []).map((r) => Number(r.block_height)));
    const todo: number[] = [];
    for (let h = tip - 6; h >= OCI_LIMIT && todo.length < SWEEP && h > tip - 200; h--) if (!known.has(h)) todo.push(h);
    if (todo.length) {
      const { resolveBitmapFromChain } = await import("@/lib/bitmap-live-resolver.server");
      await Promise.allSettled(todo.map((h) => resolveBitmapFromChain(h)));
    }
  }

  const { count } = await supabaseAdmin
    .from("bitmap_index")
    .select("block_height", { count: "exact", head: true })
    .eq("is_valid", true)
    .gte("block_height", OCI_LIMIT);
  const live = count ?? 0;
  return { tip, ociCount: OCI_LIMIT, liveCount: live, total: OCI_LIMIT + live };
});
