import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * PSBT offer book. Sellers submit a signed partially-signed Bitcoin transaction
 * that spends their bitmap inscription UTXO and pays their asking price. The
 * offer is validated against the real UTXO set (ord `/output/<outpoint>`)
 * before it is stored — nothing is simulated.
 */

export type OfferStatus = "open" | "spent" | "invalid";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  open: "OPEN",
  spent: "UTXO SPENT",
  invalid: "INVALID",
};

export type Offer = {
  id: string;
  psbtBase64: string;
  bitmapHeight: number | null;
  inscriptionId: string | null;
  outpoint: string;
  sellerAddress: string | null;
  priceSats: number;
  status: OfferStatus;
  createdAt: string;
};

type OfferRow = {
  id: string;
  psbt_base64: string;
  bitmap_height: number | null;
  inscription_id: string | null;
  outpoint: string;
  seller_address: string | null;
  price_sats: number;
  status: string;
  created_at: string;
};

function toOffer(row: OfferRow): Offer {
  const status: OfferStatus =
    row.status === "spent" || row.status === "invalid" ? row.status : "open";
  return {
    id: row.id,
    psbtBase64: row.psbt_base64,
    bitmapHeight: row.bitmap_height,
    inscriptionId: row.inscription_id,
    outpoint: row.outpoint,
    sellerAddress: row.seller_address,
    priceSats: Number(row.price_sats ?? 0),
    status,
    createdAt: row.created_at,
  };
}

export async function fetchOffers(options: { height?: number; limit?: number } = {}) {
  let query = supabase
    .from("offers")
    .select(
      "id, psbt_base64, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at",
    );
  if (options.height !== undefined) query = query.eq("bitmap_height", options.height);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw error;
  return (data ?? []).map((row) => toOffer(row as OfferRow));
}

export const offersQuery = (height?: number) =>
  queryOptions({
    queryKey: ["offers", height ?? "all"],
    queryFn: () => fetchOffers(height === undefined ? {} : { height }),
    staleTime: 30_000,
  });

/** Open offers for a set of inscription ids — powers the BUY button in shops. */
export async function fetchOffersForInscriptions(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("offers")
    .select(
      "id, psbt_base64, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at",
    )
    .in("inscription_id", ids.slice(0, 60))
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => toOffer(row as OfferRow));
}

export const inscriptionOffersQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ["offers", "inscriptions", [...ids].sort().join(",")],
    queryFn: () => fetchOffersForInscriptions(ids),
    staleTime: 30_000,
  });
