import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWalletFn } from "@/lib/wallet.functions";
import type { Offer, OfferStatus } from "@/lib/offers";

/**
 * Wallet view model. Everything is read from the chain (ord index) plus the
 * PSBT offer book — no wallet extension is required to inspect an address.
 */

export type WalletInscription = {
  id: string;
  bitmapHeight: number | null;
  contentType: string | null;
  /** Set when the inscription body is a `{index}.{height}.bitmap` parcel claim (validity checked separately). */
  parcel?: { index: number; height: number } | null;
};

export type WalletUtxo = {
  outpoint: string;
  valueSats: number;
  confirmations: number;
  inscriptions: WalletInscription[];
};

export type WalletSnapshot = {
  address: string;
  utxoCount: number;
  scannedOutputs: number;
  balanceSats: number;
  utxos: WalletUtxo[];
};

export type DeliveredOffer = Offer & {
  buyerAddress: string | null;
  deliveredAt: string | null;
  deliveryNote: string | null;
};

const OFFER_COLUMNS =
  "id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, created_at, buyer_address, delivered_at, delivery_note";

type Row = {
  id: string;
  bitmap_height: number | null;
  inscription_id: string | null;
  outpoint: string;
  seller_address: string | null;
  price_sats: number | string | null;
  status: string;
  created_at: string;
  buyer_address: string | null;
  delivered_at: string | null;
  delivery_note: string | null;
};

function toDelivered(row: Row): DeliveredOffer {
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
    buyerAddress: row.buyer_address,
    deliveredAt: row.delivered_at,
    deliveryNote: row.delivery_note,
  };
}

export async function fetchWalletOffers(address: string) {
  const [outgoing, incoming] = await Promise.all([
    supabase
      .from("offers")
      .select(OFFER_COLUMNS)
      .eq("seller_address", address)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("offers")
      .select(OFFER_COLUMNS)
      .eq("buyer_address", address)
      .order("delivered_at", { ascending: false })
      .limit(100),
  ]);
  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;
  return {
    outgoing: (outgoing.data ?? []).map((row) => toDelivered(row as Row)),
    incoming: (incoming.data ?? []).map((row) => toDelivered(row as Row)),
  };
}

export const walletQuery = (address: string) =>
  queryOptions({
    queryKey: ["wallet", address],
    queryFn: () => getWalletFn({ data: { address } }),
    enabled: address !== "",
    staleTime: 60_000,
    retry: false,
  });

export const walletOffersQuery = (address: string) =>
  queryOptions({
    queryKey: ["wallet-offers", address],
    queryFn: () => fetchWalletOffers(address),
    enabled: address !== "",
    staleTime: 15_000,
  });

export const WALLET_ADDRESS_STORAGE_KEY = "bitmap-wallet-address";
