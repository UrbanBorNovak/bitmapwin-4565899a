import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Database-backed fallback for "which bitmaps does this wallet hold?".
 *
 * The chain scan on /wallet is authoritative but slow and rate limited, so the
 * bid inbox also reads ownership already indexed in the registry: the on-chain
 * index owner, parcels the wallet customised, and parcels it bought in a
 * traced trade. Union of both sources decides which bids are "mine".
 */
export async function fetchHeldHeights(addresses: string[]): Promise<number[]> {
  const addr = [...new Set(addresses.filter(Boolean))];
  if (addr.length === 0) return [];

  const [idx, pages, bought] = await Promise.all([
    supabase.from("bitmap_index").select("block_height").in("owner_address", addr).limit(5000),
    supabase.from("parcel_pages").select("bitmap_height").in("owner_address", addr).limit(5000),
    supabase.from("trades").select("bitmap_height").in("buyer_address", addr).limit(5000),
  ]);
  if (idx.error) throw idx.error;
  if (pages.error) throw pages.error;
  if (bought.error) throw bought.error;

  const set = new Set<number>();
  for (const row of idx.data ?? []) set.add(Number(row.block_height));
  for (const row of pages.data ?? []) set.add(Number(row.bitmap_height));
  for (const row of bought.data ?? []) set.add(Number(row.bitmap_height));
  return [...set].filter((h) => Number.isFinite(h));
}

export const heldHeightsQuery = (addresses: string[]) => {
  const key = [...new Set(addresses.filter(Boolean))].sort();
  return queryOptions({
    queryKey: ["held-heights", key],
    queryFn: () => fetchHeldHeights(key),
    enabled: key.length > 0,
    staleTime: 30_000,
  });
};
