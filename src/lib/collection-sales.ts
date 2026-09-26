import { queryOptions } from "@tanstack/react-query";
import { fetchOffersForInscriptions } from "@/lib/offers";
import { getJigglypuffSalesFn } from "@/lib/collection-sales.functions";

export type CollectionSale = {
  txid: string;
  inscriptionId: string;
  sellerAddress: string | null;
  buyerAddress: string | null;
  priceSats: number;
  blockHeight: number | null;
  blockTime: string | null;
};

export const collectionSalesQuery = (collection: string) =>
  queryOptions({
    queryKey: ["collection-sales", collection],
    queryFn: (): Promise<CollectionSale[]> => getJigglypuffSalesFn(),
    staleTime: 60_000,
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
