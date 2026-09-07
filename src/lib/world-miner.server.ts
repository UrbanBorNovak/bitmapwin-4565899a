/**
 * MINER SETTLEMENT — works out and pays what a player's BTC MINER rigs earned.
 *
 * Server-authoritative on purpose: the rig count comes from the shared world
 * structures table, the elapsed time comes from the last settlement recorded in
 * the BIT ledger, and both the credit and its ledger row land through the same
 * database function every other BIT payout uses.
 */

import { BIT_PER_RIG_HOUR, MAX_UNCLAIMED_HOURS, type MinerYield } from "./world-miner";

const REASON = "miner_yield";
/** Rigs only start earning once they have been standing for a moment. */
const MINER_KIND = "btc-miner";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** How many rigs this address has standing in the shared world. */
async function rigCount(address: string) {
  const db = await admin();
  const { count, error } = await db
    .from("world_structures")
    .select("id", { count: "exact", head: true })
    .eq("kind", MINER_KIND)
    .eq("builder_address", address);
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

/** The last time mining was settled for this address, and the total paid out. */
async function history(address: string) {
  const db = await admin();
  const { data, error } = await db
    .from("coin_ledger")
    .select("delta, created_at")
    .eq("address", address)
    .eq("reason", REASON)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const paid = rows.reduce((sum, row) => sum + Number(row.delta ?? 0), 0);
  return { paid, lastClaim: rows[0]?.created_at ?? null };
}

function pendingFor(rigs: number, lastClaim: string | null, firstSeen: string | null) {
  if (!rigs) return 0;
  const since = lastClaim ?? firstSeen;
  if (!since) return 0;
  const hours = (Date.now() - new Date(since).getTime()) / 3_600_000;
  const capped = Math.max(0, Math.min(MAX_UNCLAIMED_HOURS, hours));
  return Math.floor(capped * rigs * BIT_PER_RIG_HOUR);
}

/** When the address first raised a rig — the clock starts there. */
async function firstRigAt(address: string) {
  const db = await admin();
  const { data, error } = await db
    .from("world_structures")
    .select("created_at")
    .eq("kind", MINER_KIND)
    .eq("builder_address", address)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.created_at ?? null;
}

export async function minerYield(address: string): Promise<MinerYield> {
  const [rigs, past, firstSeen] = await Promise.all([
    rigCount(address),
    history(address),
    firstRigAt(address),
  ]);
  return {
    rigs,
    pending: pendingFor(rigs, past.lastClaim, firstSeen),
    paid: past.paid,
    lastClaim: past.lastClaim,
  };
}

/** Credits everything the rigs have mined since the last settlement. */
export async function claimMinerYield(address: string): Promise<MinerYield & { credited: number }> {
  const current = await minerYield(address);
  if (current.pending <= 0) return { ...current, credited: 0 };
  const db = await admin();
  const { error } = await db.rpc("coin_apply", {
    _address: address,
    _delta: current.pending,
    _reason: REASON,
    _ref: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  const settled = await minerYield(address);
  return { ...settled, credited: current.pending };
}
