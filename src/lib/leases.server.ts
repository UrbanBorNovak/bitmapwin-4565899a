/**
 * Rent side of bitmap leasing. Leases are off-chain: BIT moves from the
 * renter's balance to the holder's balance inside a single database
 * transaction, and the lease turns active immediately with build + shop rights.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type LeaseRentInput = {
  offerId: string;
  lesseeAddress: string;
  days: number;
};

export type LeaseRentResult = {
  leaseId: string;
  bitmapHeight: number;
  days: number;
  rentCoins: number;
  endsAt: string;
};

export async function rentLease(input: LeaseRentInput): Promise<LeaseRentResult> {
  const db = await admin();
  const days = Math.floor(input.days);
  const { data: leaseId, error } = await db.rpc("coin_start_lease", {
    _offer_id: input.offerId,
    _lessee_address: input.lesseeAddress,
    _days: days,
  });
  if (error) throw new Error(error.message);

  const { data, error: readError } = await db
    .from("leases")
    .select("bitmap_height, days, total_coins, ends_at")
    .eq("id", String(leaseId))
    .single();
  if (readError) throw new Error(readError.message);

  return {
    leaseId: String(leaseId),
    bitmapHeight: Number(data.bitmap_height),
    days: Number(data.days),
    rentCoins: Number(data.total_coins),
    endsAt: data.ends_at,
  };
}

/** Marks leases whose term has passed as expired. */
export async function expireLeases(): Promise<{ expired: number }> {
  const db = await admin();
  const { data, error } = await db
    .from("leases")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(error.message);
  return { expired: data?.length ?? 0 };
}
