import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedInscription } from "@/lib/ordinal-extractor";

/**
 * Persistent index of decoded inscriptions, keyed by inscription id and
 * indexed by block height so pages can read stored rows instead of
 * re-parsing raw transaction hex on every visit.
 */

export type StoredInscription = {
  id: string;
  txid: string;
  input_index: number;
  block_height: number | null;
  content_type: string | null;
  body_text: string | null;
  body_bytes: number;
  is_bitmap_claim: boolean;
  bitmap_height: number | null;
  fields: unknown;
  created_at: string;
};

export function bitmapHeightFromText(text: string | null): number | null {
  if (!text) return null;
  const m = text.trim().match(/^(\d+)\.bitmap$/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function toStoredRow(
  txid: string,
  inscription: ExtractedInscription,
  blockHeight: number | null,
) {
  const contentType = (inscription.fields["content_type"] as string | undefined) ?? null;
  const bitmapHeight = bitmapHeightFromText(inscription.bodyText);
  return {
    id: inscription.id,
    txid,
    input_index: inscription.input,
    block_height: blockHeight ?? bitmapHeight,
    content_type: contentType,
    body_text: inscription.bodyText,
    body_bytes: inscription.body ? inscription.body.length : 0,
    is_bitmap_claim: bitmapHeight !== null,
    bitmap_height: bitmapHeight,
    fields: JSON.parse(JSON.stringify(inscription.fields)) as Record<string, unknown>,
  };
}

/** Upsert every extracted inscription of a transaction into the index. */
export async function saveInscriptions(
  txid: string,
  inscriptions: ExtractedInscription[],
  blockHeight: number | null,
): Promise<number> {
  if (inscriptions.length === 0) return 0;
  const rows = inscriptions.map((i) => toStoredRow(txid, i, blockHeight));
  const { error } = await supabase.from("inscriptions").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
}

export async function fetchStoredInscriptions(limit = 500): Promise<StoredInscription[]> {
  const { data, error } = await supabase
    .from("inscriptions")
    .select("*")
    .order("block_height", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StoredInscription[];
}

export async function fetchInscriptionsByBlock(block: number): Promise<StoredInscription[]> {
  const { data, error } = await supabase
    .from("inscriptions")
    .select("*")
    .eq("block_height", block)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoredInscription[];
}

export const storedInscriptionsQuery = (limit = 500) =>
  queryOptions({
    queryKey: ["inscriptions", "all", limit],
    queryFn: () => fetchStoredInscriptions(limit),
  });

export const inscriptionsByBlockQuery = (block: number) =>
  queryOptions({
    queryKey: ["inscriptions", "block", block],
    queryFn: () => fetchInscriptionsByBlock(block),
  });

export type BlockGroup = {
  blockHeight: number | null;
  inscriptions: StoredInscription[];
  bitmapClaims: StoredInscription[];
};

export function groupByBlock(rows: StoredInscription[]): BlockGroup[] {
  const map = new Map<string, StoredInscription[]>();
  for (const row of rows) {
    const key = row.block_height === null ? "unknown" : String(row.block_height);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .map(([key, inscriptions]) => ({
      blockHeight: key === "unknown" ? null : Number(key),
      inscriptions,
      bitmapClaims: inscriptions.filter((i) => i.is_bitmap_claim),
    }))
    .sort((a, b) => (b.blockHeight ?? -1) - (a.blockHeight ?? -1));
}
