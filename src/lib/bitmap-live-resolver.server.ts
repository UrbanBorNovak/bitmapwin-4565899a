/**
 * Live BITMAP index for blocks past the On-Chain Index (942,000+).
 *
 * No public indexer searches inscriptions by text, so new blocks are learned
 * from verified finds (wallet scans, pasted ids). Each find is re-checked
 * against ordinals.com — exact `<height>.bitmap` content — and stored in
 * `bitmap_index`. If two claims compete, the lower inscription number wins
 * (first-is-first). Later lookups for that block then need no wallet scan.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isBitmapInscription } from "@/lib/bitmap-parent-scan.server";

const ORD = "https://ordinals.com";
const ID_RE = /^[0-9a-f]{64}i\d+$/;

type InscriptionMeta = { number: number; height: number; sat: number | null; address: string | null };

async function meta(id: string): Promise<InscriptionMeta | null> {
  try {
    const r = await fetch(`${ORD}/r/inscription/${id}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { number?: number; height?: number; sat?: number | null; address?: string | null };
    if (typeof j.number !== "number" || typeof j.height !== "number") return null;
    return { number: j.number, height: j.height, sat: j.sat ?? null, address: j.address ?? null };
  } catch {
    return null;
  }
}

/** Verifies and stores a BITMAP claim; returns the canonical id for the block. */
export async function learnBitmap(id: string, height: number): Promise<string | null> {
  const clean = id.trim().toLowerCase();
  if (!ID_RE.test(clean) || !(await isBitmapInscription(clean, height))) return null;
  const m = await meta(clean);
  if (!m || m.height < height) return null;

  const { data: row } = await supabaseAdmin
    .from("bitmap_index")
    .select("inscription_id")
    .eq("block_height", height)
    .maybeSingle();
  const existing = row?.inscription_id?.toLowerCase() ?? null;
  if (existing === clean) return clean;
  if (existing) {
    const other = await meta(existing);
    // Keep the earlier claim unless we can prove ours came first.
    if (!other || other.number <= m.number) return existing;
  }

  await supabaseAdmin.from("bitmap_index").upsert(
    {
      block_height: height,
      sat: m.sat ?? 0,
      sat_index: 0,
      inscription_id: clean,
      content: `${height}.bitmap`,
      is_valid: true,
      genesis_height: m.height,
      owner_address: m.address,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "block_height" },
  );
  return clean;
}

const BLOCKS_AHEAD = 6;

/**
 * LiveOCI rule (0c18b83c…i0): the BITMAP for block N is the first valid
 * `N.bitmap` inscription found reading blocks N, N+1, … in transaction order.
 * Valid = exact raw bytes, complete, no content-encoding, no delegate.
 * Reads up to BLOCKS_AHEAD blocks; a hit is verified and stored via learnBitmap.
 */
export async function resolveBitmapFromChain(height: number): Promise<string | null> {
  if (!Number.isInteger(height) || height < 970_000) return null;
  const { fetchBlock, listInscriptions, toHex } = await import("@/lib/vendor/ord-block-parser.js");
  const target = toHex(new TextEncoder().encode(`${height}.bitmap`));
  for (let h = height; h < height + BLOCKS_AHEAD; h++) {
    let block;
    try {
      block = await fetchBlock(h, { classify: false, locate: false });
    } catch {
      return null; // not mined yet or ordinals.com unavailable
    }
    for (const ins of listInscriptions(block) as Array<{ id?: string; bodyHex?: string; complete?: boolean; contentEncoding?: unknown; delegate?: unknown }>) {
      if (ins.bodyHex !== target || ins.complete !== true || ins.contentEncoding || ins.delegate) continue;
      const id = String(ins.id ?? "");
      return (await learnBitmap(id, height)) ?? null;
    }
  }
  return null;
}
