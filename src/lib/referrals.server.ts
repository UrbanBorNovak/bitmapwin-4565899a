import type { ReferralSummary } from "@/lib/referrals";

/**
 * Referral engine. Codes, claims and the inviter's share of a friend's BIT
 * earnings all live in the database; this module only orchestrates the
 * security-definer routines with the service role.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Issues (or returns) the invite code for a verified address. */
export async function ensureCode(userId: string, address: string): Promise<string> {
  const db = await admin();
  const { data, error } = await db.rpc("referral_ensure_code", {
    _user_id: userId,
    _address: address,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Reads the invite code, referred friends and earnings for one address. */
export async function referralSummary(userId: string, address: string): Promise<ReferralSummary> {
  const db = await admin();
  const code = await ensureCode(userId, address);

  const [mine, joined] = await Promise.all([
    db
      .from("referrals")
      .select("referee_address, override_earned, bonus_paid, created_at")
      .eq("referrer_address", address)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("referrals")
      .select("referrer_address")
      .eq("referee_address", address)
      .maybeSingle(),
  ]);
  if (mine.error) throw new Error(mine.error.message);

  const rows = mine.data ?? [];
  return {
    code,
    address,
    referrals: rows.map((row) => ({
      refereeAddress: row.referee_address,
      overrideEarned: Number(row.override_earned),
      createdAt: row.created_at,
    })),
    referredCount: rows.length,
    overrideTotal: rows.reduce((sum, row) => sum + Number(row.override_earned), 0),
    bonusTotal: rows.reduce((sum, row) => sum + Number(row.bonus_paid), 0),
    invitedBy: joined.data?.referrer_address ?? null,
  };
}

/** Claims an invite code for a verified address and pays both bonuses. */
export async function claimCode(
  userId: string,
  address: string,
  code: string,
): Promise<{ referralId: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("referral_claim", {
    _code: code,
    _user_id: userId,
    _address: address,
  });
  if (error) throw new Error(error.message);
  return { referralId: String(data) };
}

/**
 * Pays an inviter their share of the BIT just credited to a referred friend.
 * Returns the amount paid (0 when the address was not referred).
 */
export async function payOverride(
  refereeAddress: string,
  amount: number,
  ref: string,
): Promise<number> {
  if (amount <= 0) return 0;
  const db = await admin();
  const { data, error } = await db.rpc("referral_pay_override", {
    _referee_address: refereeAddress,
    _amount: Math.round(amount),
    _ref: ref,
  });
  if (error) return 0;
  return Number(data ?? 0);
}
