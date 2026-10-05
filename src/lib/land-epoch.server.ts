import { landBoost, type LandBoost } from "@/lib/holder-epoch";

/**
 * Per-BITMAP holding boost from public chain facts: inscription block
 * (bitmap_index) and the latest traced sale (trades). A sale resets the clock.
 */
export async function bitcoinTip(): Promise<number> {
  try {
    const r = await fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(6000) });
    const n = Number(await r.text());
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

export async function readLandBoosts(heights: number[]): Promise<Map<number, LandBoost>> {
  const out = new Map<number, LandBoost>();
  const unique = [...new Set(heights)].slice(0, 2000);
  if (!unique.length) return out;
  const tip = await bitcoinTip();
  if (!tip) return out;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [idx, sales] = await Promise.all([
    db.from("bitmap_index").select("block_height, genesis_height").in("block_height", unique),
    db.from("trades").select("bitmap_height, block_height").in("bitmap_height", unique).not("block_height", "is", null),
  ]);
  if (idx.error) throw new Error(idx.error.message);
  if (sales.error) throw new Error(sales.error.message);
  const last = new Map<number, number>();
  for (const s of sales.data ?? []) {
    const h = Number(s.bitmap_height); const b = Number(s.block_height);
    if ((last.get(h) ?? 0) < b) last.set(h, b);
  }
  // Every UTXO hop (transfer, atomic swap, sale) resets the clock — not just traced sales.
  const { lastMoveBlocks } = await import("@/lib/bitmap-custody.server");
  const moves = await lastMoveBlocks(unique).catch(() => new Map<number, number>());
  for (const r of idx.data ?? []) {
    if (r.genesis_height == null) continue;
    const h = Number(r.block_height);
    const mv = Math.max(moves.get(h) ?? 0, last.get(h) ?? 0);
    out.set(h, landBoost(h, tip, Number(r.genesis_height), mv || null));
  }
  return out;
}
