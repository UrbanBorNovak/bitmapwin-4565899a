import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOffersForInscriptions } from "@/lib/offers";

export type CollectionSale = {
  txid: string;
  inscriptionId: string;
  sellerAddress: string | null;
  buyerAddress: string | null;
  priceSats: number;
  blockHeight: number | null;
  blockTime: string | null;
};

export async function fetchCollectionSales(collection: string): Promise<CollectionSale[]> {
  const { data, error } = await supabase
    .from("collection_sales")
    .select("txid, inscription_id, seller_address, buyer_address, price_sats, block_height, block_time")
    .eq("collection", collection)
    .order("block_height", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    txid: r.txid,
    inscriptionId: r.inscription_id,
    sellerAddress: r.seller_address,
    buyerAddress: r.buyer_address,
    priceSats: Number(r.price_sats),
    blockHeight: r.block_height,
    blockTime: r.block_time,
  }));
}

export async function fetchCollectionProgress(collection: string) {
  const { count } = await supabase
    .from("collection_crawl_state")
    .select("inscription_id", { count: "exact", head: true })
    .eq("collection", collection);
  return count ?? 0;
}

export const collectionSalesQuery = (collection: string) =>
  queryOptions({
    queryKey: ["collection-sales", collection],
    queryFn: () => fetchCollectionSales(collection),
    staleTime: 30_000,
  });

export const collectionProgressQuery = (collection: string) =>
  queryOptions({
    queryKey: ["collection-progress", collection],
    queryFn: () => fetchCollectionProgress(collection),
    staleTime: 20_000,
  });

/** All open listings across the pool (offers are read 60 ids at a time). */
export async function fetchCollectionListings(ids: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
  const all = await Promise.all(chunks.map((c) => fetchOffersForInscriptions(c)));
  return all.flat();
}

export const collectionListingsQuery = (collection: string, ids: string[]) =>
  queryOptions({
    queryKey: ["offers", "collection", collection],
    queryFn: () => fetchCollectionListings(ids),
    staleTime: 30_000,
  });
