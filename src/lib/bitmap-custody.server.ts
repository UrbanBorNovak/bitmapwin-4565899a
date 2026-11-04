/**
 * Custody clock from the chain itself: the block in which a BITMAP's
 * inscription last moved (any transfer, atomic swap or sale). We read the
 * inscription's current satpoint from ordinals.com and the confirmation
 * height of that output's tx from mempool.space. Cached in bitmap_custody.
 * Unresolved BITMAPs return nothing — callers must not assume genesis.
 */
const STALE_MS = 6 * 60 * 60 * 1000;
const MAX_LIVE = 60;

async function json(url: string, accept = "application/json"): Promise<any> {
  const r = await fetch(url, { headers: { Accept: accept, "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function trace(inscriptionId: string): Promise<{ satpoint: string; block: number } | null> {
  try {
    const m = await json(`https://ordinals.com/r/inscription/${inscriptionId}`);
    const satpoint = String(m?.satpoint ?? "");
    const txid = satpoint.split(":")[0] ?? "";
    if (!/^[0-9a-f]{64}$/.test(txid)) return null;
    const s = await json(`https://mempool.space/api/tx/${txid}/status`);
    if (!s?.confirmed || !Number.isFinite(Number(s.block_height))) return null; // unconfirmed move: clock resets, unknown yet
    return { satpoint, block: Number(s.block_height) };
  } catch { return null; }
}

/** height -> block of the last on-chain move. */
export async function lastMoveBlocks(heights: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const unique = [...new Set(heights)].slice(0, 2000);
  if (!unique.length) return out;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [cache, idx] = await Promise.all([
    db.from("bitmap_custody").select("block_height, last_move_block, checked_at").in("block_height", unique),
    db.from("bitmap_index").select("block_height, inscription_id").in("block_height", unique),
  ]);
  const fresh = new Set<number>();
  for (const c of cache.data ?? []) {
    if (c.last_move_block != null) out.set(Number(c.block_height), Number(c.last_move_block));
    if (Date.now() - new Date(c.checked_at).getTime() < STALE_MS) fresh.add(Number(c.block_height));
  }
  const todo = (idx.data ?? []).filter((r: any) => r.inscription_id && !fresh.has(Number(r.block_height))).slice(0, MAX_LIVE);
  const rows: any[] = [];
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const res = await Promise.all(batch.map((r: any) => trace(r.inscription_id)));
    batch.forEach((r: any, k) => {
      const t = res[k]; if (!t) return;
      const h = Number(r.block_height);
      out.set(h, t.block);
      rows.push({ block_height: h, inscription_id: r.inscription_id, satpoint: t.satpoint, last_move_block: t.block, checked_at: new Date().toISOString() });
    });
  }
  if (rows.length) await db.from("bitmap_custody").upsert(rows, { onConflict: "block_height" });
  return out;
}
