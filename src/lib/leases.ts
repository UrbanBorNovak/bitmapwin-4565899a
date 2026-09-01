import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBit } from "@/lib/coins";

/**
 * Client-side reads for bitmap leasing. Leases are settled off-chain in BIT:
 * the renter's balance pays the holder's balance, and the renter gets build and
 * shop rights on that bitmap while the term runs. Ownership never moves.
 */

export type LeaseOffer = {
  id: string;
  bitmapHeight: number;
  ownerAddress: string;
  rateCoinsPerDay: number;
  minDays: number;
  maxDays: number;
  note: string | null;
  status: string;
  createdAt: string;
};

export type Lease = {
  id: string;
  bitmapHeight: number;
  ownerAddress: string;
  lesseeAddress: string;
  rateCoinsPerDay: number;
  totalCoins: number;
  days: number;
  status: string;
  startsAt: string;
  endsAt: string;
};

export { formatBit };

export function daysLeft(endsAt: string): number {
  const ms = new Date(endsAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

type OfferRow = {
  id: string;
  bitmap_height: number;
  owner_address: string;
  rate_coins_per_day: number;
  min_days: number;
  max_days: number;
  note: string | null;
  status: string;
  created_at: string;
};

type LeaseRow = {
  id: string;
  bitmap_height: number;
  owner_address: string;
  lessee_address: string;
  rate_coins_per_day: number;
  total_coins: number;
  days: number;
  status: string;
  starts_at: string;
  ends_at: string;
};

function mapOffer(row: OfferRow): LeaseOffer {
  return {
    id: row.id,
    bitmapHeight: Number(row.bitmap_height),
    ownerAddress: row.owner_address,
    rateCoinsPerDay: Number(row.rate_coins_per_day),
    minDays: row.min_days,
    maxDays: row.max_days,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapLease(row: LeaseRow): Lease {
  return {
    id: row.id,
    bitmapHeight: Number(row.bitmap_height),
    ownerAddress: row.owner_address,
    lesseeAddress: row.lessee_address,
    rateCoinsPerDay: Number(row.rate_coins_per_day),
    totalCoins: Number(row.total_coins),
    days: row.days,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

const OFFER_COLS =
  "id, bitmap_height, owner_address, rate_coins_per_day, min_days, max_days, note, status, created_at";
const LEASE_COLS =
  "id, bitmap_height, owner_address, lessee_address, rate_coins_per_day, total_coins, days, status, starts_at, ends_at";

export async function fetchLeaseOffers(limit = 200): Promise<LeaseOffer[]> {
  const { data, error } = await supabase
    .from("lease_offers")
    .select(OFFER_COLS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as OfferRow[]).map(mapOffer);
}

export async function fetchLeases(limit = 200): Promise<Lease[]> {
  const { data, error } = await supabase
    .from("leases")
    .select(LEASE_COLS)
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LeaseRow[]).map(mapLease);
}

export const leaseOffersQuery = (limit = 200) =>
  queryOptions({
    queryKey: ["lease-offers", limit],
    queryFn: () => fetchLeaseOffers(limit),
    staleTime: 30_000,
  });

export const leasesQuery = (limit = 200) =>
  queryOptions({
    queryKey: ["leases", limit],
    queryFn: () => fetchLeases(limit),
    staleTime: 30_000,
  });

export const bitmapLeaseQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap-lease", height],
    queryFn: async () => {
      const [offers, leases] = await Promise.all([
        supabase.from("lease_offers").select(OFFER_COLS).eq("bitmap_height", height).limit(5),
        supabase
          .from("leases")
          .select(LEASE_COLS)
          .eq("bitmap_height", height)
          .order("starts_at", { ascending: false })
          .limit(10),
      ]);
      if (offers.error) throw new Error(offers.error.message);
      if (leases.error) throw new Error(leases.error.message);
      const mappedLeases = ((leases.data ?? []) as LeaseRow[]).map(mapLease);
      return {
        offer:
          ((offers.data ?? []) as OfferRow[]).map(mapOffer).find((o) => o.status === "open") ?? null,
        active: mappedLeases.find((l) => l.status === "active" && daysLeft(l.endsAt) > 0) ?? null,
        history: mappedLeases,
      };
    },
    staleTime: 20_000,
  });

export type LeaseEarnings = {
  totalCoins: number;
  activeCount: number;
  leaseCount: number;
  perDayCoins: number;
  nextExpiry: string | null;
};

/** Rent earned in BIT by an address across all of its leases. */
export function earningsFor(leases: Lease[], address: string | null): LeaseEarnings {
  const target = (address ?? "").toLowerCase();
  const mine = leases.filter((l) => l.ownerAddress.toLowerCase() === target);
  const active = mine.filter((l) => l.status === "active" && daysLeft(l.endsAt) > 0);
  const expiries = active.map((l) => l.endsAt).sort();
  return {
    totalCoins: mine.reduce((sum, l) => sum + l.totalCoins, 0),
    activeCount: active.length,
    leaseCount: mine.length,
    perDayCoins: active.reduce((sum, l) => sum + l.rateCoinsPerDay, 0),
    nextExpiry: expiries[0] ?? null,
  };
}

export async function upsertLeaseOffer(input: {
  bitmapHeight: number;
  ownerAddress: string;
  rateCoinsPerDay: number;
  minDays: number;
  maxDays: number;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("lease_offers").upsert(
    {
      bitmap_height: input.bitmapHeight,
      owner_address: input.ownerAddress,
      rate_coins_per_day: input.rateCoinsPerDay,
      min_days: input.minDays,
      max_days: input.maxDays,
      note: input.note ?? null,
      status: "open",
    },
    { onConflict: "bitmap_height,owner_address" },
  );
  if (error) throw new Error(error.message);
}

export async function closeLeaseOffer(id: string): Promise<void> {
  const { error } = await supabase.from("lease_offers").update({ status: "closed" }).eq("id", id);
  if (error) throw new Error(error.message);
}
