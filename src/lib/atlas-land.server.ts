/**
 * ATLAS LAND — real BITMAP claims behind the map.
 *
 * Reads come straight out of the inscription registry (`bitmap_index`), which
 * holds the resolved inscription and holder for every indexed block. Nothing
 * here is synthesised: a block with no indexed inscription simply stays absent.
 *
 * The frontier pass fills the gap between the last indexed block and the chain
 * tip by resolving those heights from the ordinals index, so the atlas is not
 * blank for freshly mined land while waiting for the next block.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWithConcurrency, resolveOne } from "@/lib/oci.server";
import { MAX_BITMAP } from "@/lib/oci";

export type AtlasClaim = {
  height: number;
  inscriptionId: string;
  ownerAddress: string | null;
  isValid: boolean;
};

const CONCURRENCY = 6;
/** One frontier pass per window, app-wide, so ordinals.com is never hammered. */
const FRONTIER_THROTTLE_MS = 20_000;
let lastFrontierRun = 0;

const db = () => supabaseAdmin;

/** Indexed claims for the given block heights. Public, read-only. */
export async function claimsForHeights(heights: number[]): Promise<AtlasClaim[]> {
  if (heights.length === 0) return [];
  const { data, error } = await db()
    .from("bitmap_index")
    .select("block_height, inscription_id, owner_address, is_valid")
    .in("block_height", heights)
    .not("inscription_id", "is", null);
  if (error) return [];
  return (data ?? []).map((row) => ({
    height: Number(row.block_height),
    inscriptionId: row.inscription_id!,
    ownerAddress: row.owner_address,
    isValid: Boolean(row.is_valid),
  }));
}

/** Highest block that already carries a resolved inscription. */
export async function indexedTip(): Promise<number> {
  const { data } = await db()
    .from("bitmap_index")
    .select("block_height")
    .not("inscription_id", "is", null)
    .order("block_height", { ascending: false })
    .limit(1);
  return data?.[0] ? Number(data[0].block_height) : 0;
}

export type FrontierResult = {
  indexedTip: number;
  attempted: number;
  indexed: number;
  skipped: boolean;
};

/**
 * Resolve real inscriptions for the blocks between the indexed tip and the
 * chain tip, newest first, and write them back to the registry.
 */
export async function indexFrontier(chainTip: number, batch = 12): Promise<FrontierResult> {
  const tip = await indexedTip();
  const target = Math.min(Math.floor(chainTip), MAX_BITMAP);
  if (target <= tip) return { indexedTip: tip, attempted: 0, indexed: 0, skipped: false };
  if (Date.now() - lastFrontierRun < FRONTIER_THROTTLE_MS) {
    return { indexedTip: tip, attempted: 0, indexed: 0, skipped: true };
  }
  lastFrontierRun = Date.now();

  const size = Math.max(1, Math.min(batch, 24));
  const heights: number[] = [];
  for (let height = target; height > tip && heights.length < size; height -= 1) heights.push(height);

  const entries = await mapWithConcurrency(heights, CONCURRENCY, resolveOne);
  const rows = entries.map((entry) => ({
    block_height: entry.blockHeight,
    sat: entry.sat,
    sat_index: entry.satIndex,
    inscription_id: entry.inscriptionId,
    content: entry.content,
    is_valid: entry.isValid,
    genesis_height: entry.genesisHeight,
    owner_address: entry.ownerAddress,
    resolved_at: entry.resolvedAt ?? new Date().toISOString(),
  }));
  if (rows.length) await db().from("bitmap_index").upsert(rows, { onConflict: "block_height" });

  return {
    indexedTip: await indexedTip(),
    attempted: heights.length,
    indexed: entries.filter((entry) => entry.inscriptionId).length,
    skipped: false,
  };
}
