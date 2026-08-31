import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bid book. Any wallet can bid on any bitmap parcel — claimed or not — by
 * signing a message with the bidding address. The bid is an off-chain, signed
 * intent to pay; settlement still happens through the on-chain sale PSBT flow
 * once the holder accepts.
 */

export type BidStatus = "open" | "accepted" | "settled" | "cancelled" | "expired";

export const BID_STATUS_LABEL: Record<BidStatus, string> = {
  open: "OPEN",
  accepted: "ACCEPTED — AWAITING BROADCAST",
  settled: "SETTLED ON CHAIN",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
};

export type Bid = {
  id: string;
  bitmapHeight: number;
  bidderAddress: string;
  priceSats: number;
  expiresAt: string | null;
  note: string | null;
  status: BidStatus;
  createdAt: string;
};

type BidRow = {
  id: string;
  bitmap_height: number;
  bidder_address: string;
  price_sats: number;
  expires_at: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

const COLUMNS =
  "id, bitmap_height, bidder_address, price_sats, expires_at, note, status, created_at";

function toBid(row: BidRow): Bid {
  const status: BidStatus =
    row.status === "accepted" || row.status === "cancelled" || row.status === "expired"
      ? row.status
      : "open";
  return {
    id: row.id,
    bitmapHeight: Number(row.bitmap_height),
    bidderAddress: row.bidder_address,
    priceSats: Number(row.price_sats ?? 0),
    expiresAt: row.expires_at,
    note: row.note,
    status,
    createdAt: row.created_at,
  };
}

export function isLiveBid(bid: Bid): boolean {
  if (bid.status !== "open") return false;
  if (!bid.expiresAt) return true;
  return new Date(bid.expiresAt).getTime() > Date.now();
}

export async function fetchBidsForHeight(height: number): Promise<Bid[]> {
  const { data, error } = await supabase
    .from("bids")
    .select(COLUMNS)
    .eq("bitmap_height", height)
    .order("price_sats", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => toBid(row as BidRow));
}

export async function fetchOpenBids(limit = 500): Promise<Bid[]> {
  const { data, error } = await supabase
    .from("bids")
    .select(COLUMNS)
    .eq("status", "open")
    .order("price_sats", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toBid(row as BidRow)).filter(isLiveBid);
}

export async function fetchBidsByAddresses(addresses: string[]): Promise<Bid[]> {
  if (addresses.length === 0) return [];
  const { data, error } = await supabase
    .from("bids")
    .select(COLUMNS)
    .in("bidder_address", addresses)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => toBid(row as BidRow));
}

export const bidsForHeightQuery = (height: number) =>
  queryOptions({
    queryKey: ["bids", "height", height],
    queryFn: () => fetchBidsForHeight(height),
    staleTime: 20_000,
  });

export const openBidsQuery = (limit = 500) =>
  queryOptions({
    queryKey: ["bids", "open", limit],
    queryFn: () => fetchOpenBids(limit),
    staleTime: 20_000,
  });

export const myBidsQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["bids", "mine", [...addresses].sort().join(",")],
    queryFn: () => fetchBidsByAddresses(addresses),
    enabled: addresses.length > 0,
    staleTime: 20_000,
  });

/** Highest live bid per bitmap height. */
export function topBidByHeight(bids: Bid[]): Map<number, Bid> {
  const map = new Map<number, Bid>();
  for (const bid of bids) {
    if (!isLiveBid(bid)) continue;
    const current = map.get(bid.bitmapHeight);
    if (!current || bid.priceSats > current.priceSats) map.set(bid.bitmapHeight, bid);
  }
  return map;
}

/** Canonical message a bidder signs; server stores it alongside the bid. */
export function bidMessage(height: number, priceSats: number, address: string): string {
  return `BITMAP MARKETPLACE BID\nparcel: ${height}.bitmap\namount: ${priceSats} sats\nbidder: ${address}`;
}

export function bidActionMessage(action: "cancel" | "accept", bidId: string, address: string) {
  return `BITMAP MARKETPLACE ${action.toUpperCase()} BID\nbid: ${bidId}\naddress: ${address}`;
}
