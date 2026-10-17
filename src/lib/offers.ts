import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * PSBT offer book. Sellers submit a signed partially-signed Bitcoin transaction
 * that spends their bitmap inscription UTXO and pays their asking price. The
 * offer is validated against the real UTXO set (ord `/output/<outpoint>`)
 * before it is stored — nothing is simulated.
 */

export type OfferStatus = "open" | "spent" | "invalid" | "cancelled";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  open: "OPEN",
  spent: "UTXO SPENT",
  invalid: "INVALID",
  cancelled: "UNLISTED",
};

/** Message the seller signs to prove they own the listing they are unlisting. */
export function unlistMessage(offerId: string) {
  return [
    "BITMAP MARKETPLACE — UNLIST",
    `OFFER: ${offerId}`,
    "SIGNING THIS CANCELS THE LISTING. IT MOVES NO FUNDS.",
  ].join("\n");
}


export type Offer = {
  id: string;
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
    row.status === "spent" || row.status === "invalid" || row.status === "cancelled"
      ? row.status
      : "open";

  return {
    id: row.id,
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
      "id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at",
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
      "id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at",
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

/** Every offer signed by one seller address — powers the seller console. */
export async function fetchSellerOffers(address: string) {
  if (!address) return [];
  const { data, error } = await supabase
    .from("offers")
    .select(
      "id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at",
    )
    .ilike("seller_address", address)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => toOffer(row as OfferRow));
}

export const sellerOffersQuery = (address: string) =>
  queryOptions({
    queryKey: ["offers", "seller", address.toLowerCase()],
    queryFn: () => fetchSellerOffers(address),
    staleTime: 20_000,
  });

/** Every open ask on the market (up to 1,000) — powers holder floor matching. */
export async function fetchOpenOffers() {
  const { data, error } = await supabase
    .from("offers")
    .select("id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at")
    .eq("status", "open")
    .order("price_sats", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((row) => toOffer(row as OfferRow));
}

export const openOffersQuery = () =>
  queryOptions({ queryKey: ["offers", "open-all"], queryFn: fetchOpenOffers, staleTime: 30_000 });
