/**
 * Genesis minter resolution: the original inscriber of a BITMAP is the
 * recipient of the genesis reveal transaction's first output. Read from
 * mempool.space, cached forever in genesis_minters (it can never change).
 * Vanguard era = genesis_height < 793,500.
 */
export const VANGUARD_TIP = 793_500;
const MAX_LIVE = 40;

async function minterOf(txid: string): Promise<string | null> {
  try {
    const r = await fetch(`https://mempool.space/api/tx/${txid}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const tx = await r.json();
    const addr = tx?.vout?.[0]?.scriptpubkey_address;
    return typeof addr === "string" && addr ? addr : null;
  } catch {
    return null;
  }
}

/** Backfill genesis_minters for Vanguard BITMAPs not yet resolved. */
export async function backfillGenesisMinters(): Promise<number> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: idx, error } = await db
    .from("bitmap_index")
    .select("block_height, inscription_id")
    .lt("genesis_height", VANGUARD_TIP)
    .not("inscription_id", "is", null);
  if (error || !idx?.length) return 0;
  const { data: done } = await db.from("genesis_minters").select("inscription_id");
  const have = new Set((done ?? []).map((r: any) => r.inscription_id));
  const todo = idx.filter((r: any) => !have.has(r.inscription_id)).slice(0, MAX_LIVE);
  const rows: any[] = [];
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const res = await Promise.all(batch.map((r: any) => minterOf(String(r.inscription_id).replace(/i0$/, ""))));
    batch.forEach((r: any, k) => {
      const m = res[k];
      if (m) rows.push({ inscription_id: r.inscription_id, block_height: Number(r.block_height), minter_address: m });
    });
  }
  if (rows.length) await db.from("genesis_minters").upsert(rows, { onConflict: "inscription_id" });
  return rows.length;
}

export type GenesisRank = {
  minter: string;
  minted: number;
  held: number;
  blocks: number[];
};

/** Vanguard minters ranked by minted count, with current still-held counts. */
export async function genesisRanks(): Promise<{ ranks: GenesisRank[]; resolved: number; total: number }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data: minters }, { data: idx }] = await Promise.all([
    db.from("genesis_minters").select("inscription_id, block_height, minter_address"),
    db.from("bitmap_index").select("block_height, inscription_id, owner_address").lt("genesis_height", VANGUARD_TIP),
  ]);
  const total = idx?.length ?? 0;
  const byId = new Map((idx ?? []).map((r: any) => [r.inscription_id, r]));
  const agg = new Map<string, GenesisRank>();
  for (const m of minters ?? []) {
    const cur = byId.get(m.inscription_id);
    if (!cur) continue;
    let r = agg.get(m.minter_address);
    if (!r) {
      r = { minter: m.minter_address, minted: 0, held: 0, blocks: [] };
      agg.set(m.minter_address, r);
    }
    r.minted += 1;
    r.blocks.push(Number(m.block_height));
    if (cur.owner_address === m.minter_address) r.held += 1;
  }
  const ranks = [...agg.values()].sort((a, b) => b.minted - a.minted || b.held - a.held);
  for (const r of ranks) r.blocks.sort((a, b) => a - b);
  return { ranks, resolved: minters?.length ?? 0, total };
}
