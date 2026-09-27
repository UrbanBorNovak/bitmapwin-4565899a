import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OFFICIAL_TRAITS, type TraitId } from "@/lib/traits";

export const OFFICIAL_TRAITS_POOL = "OFFICIAL TRAITS";

export type TraitBitmap = {
  bitmapHeight: number;
  inscriptionId: string;
  ownerAddress: string | null;
  genesisHeight: number | null;
  totalCount: number;
};

export async function fetchTraitBitmaps(trait: TraitId, offset = 0, limit = 24): Promise<TraitBitmap[]> {
  const { data, error } = await supabase.rpc("official_trait_bitmaps", {
    p_trait: trait,
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    bitmapHeight: Number(row.block_height),
    inscriptionId: row.inscription_id,
    ownerAddress: row.owner_address,
    genesisHeight: row.genesis_height === null ? null : Number(row.genesis_height),
    totalCount: Number(row.total_count),
  }));
}

export const traitBitmapsQuery = (trait: TraitId, page = 0, limit = 24) => queryOptions({
  queryKey: ["official-trait-bitmaps", trait, page, limit],
  queryFn: () => fetchTraitBitmaps(trait, page * limit, limit),
  staleTime: 60_000,
});

export async function fetchTraitExtenderPool(): Promise<TraitBitmap[]> {
  const groups = await Promise.all(OFFICIAL_TRAITS.map((trait) => fetchTraitBitmaps(trait.id, 0, 24)));
  const unique = new Map<string, TraitBitmap>();
  for (const item of groups.flat()) unique.set(item.inscriptionId, item);
  return [...unique.values()].sort((a, b) => a.bitmapHeight - b.bitmapHeight);
}

export const traitExtenderPoolQuery = () => queryOptions({
  queryKey: ["official-traits", "extender-pool"],
  queryFn: fetchTraitExtenderPool,
  staleTime: 300_000,
});

export type TraitHolderBadge = {
  address: string;
  traitIds: string[];
  bitmapHeight: number;
  inscriptionId: string;
  expiresAt: string;
};

export async function fetchTraitHolderBadges(addresses: string[]): Promise<Map<string, TraitHolderBadge>> {
  const unique = [...new Set(addresses.filter(Boolean).map((address) => address.toLowerCase()))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase
    .from("trait_holder_badges")
    .select("address, trait_ids, bitmap_height, inscription_id, expires_at")
    .in("address", unique)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.address.toLowerCase(), {
    address: row.address,
    traitIds: row.trait_ids,
    bitmapHeight: Number(row.bitmap_height),
    inscriptionId: row.inscription_id,
    expiresAt: row.expires_at,
  }]));
}

export const traitHolderBadgesQuery = (addresses: string[]) => queryOptions({
  queryKey: ["trait-holder-badges", [...new Set(addresses)].sort().join(",")],
  queryFn: () => fetchTraitHolderBadges(addresses),
  enabled: addresses.some(Boolean),
  staleTime: 60_000,
});