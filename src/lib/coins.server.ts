import { EMISSION, FIEF_SPLIT, HOST_SPLIT } from "@/lib/coins";
import { REFERRAL } from "@/lib/referrals";

/**
 * BIT economy engine. Everything here is off-chain platform state: the daily
 * reward payout (attention-first), paid event entries and raffle draws.
 */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Awards = Map<string, Map<string, number>>;

function add(awards: Awards, address: string | null | undefined, reason: string, amount: number) {
  if (!address || amount <= 0) return;
  const forAddress = awards.get(address) ?? new Map<string, number>();
  forAddress.set(reason, (forAddress.get(reason) ?? 0) + Math.round(amount));
  awards.set(address, forAddress);
}

export type RewardRunResult = {
  runDate: string;
  awarded: number;
  recipients: number;
  skipped: boolean;
};

/**
 * Pays one day of BIT. Attention on builds pays the most, then trading,
 * building and leasing. Idempotent: one payout per UTC day.
 */
export async function runDailyRewards(): Promise<RewardRunResult> {
  const db = await admin();
  const runDate = today();

  const claim = await db
    .from("coin_reward_runs")
    .insert({ run_date: runDate, awarded: 0, recipients: 0 })
    .select("run_date");
  if (claim.error) {
    const existing = await db
      .from("coin_reward_runs")
      .select("run_date, awarded, recipients")
      .eq("run_date", runDate)
      .maybeSingle();
    if (existing.data) {
      return {
        runDate,
        awarded: Number(existing.data.awarded),
        recipients: Number(existing.data.recipients),
        skipped: true,
      };
    }
    throw new Error(claim.error.message);
  }

  const awards: Awards = new Map();
  const since = new Date(Date.now() - 86_400_000).toISOString();

  // 1. Attention on builds — the biggest share of the emission.
  const pages = await db
    .from("parcel_pages")
    .select("bitmap_height, owner_address")
    .limit(2000);
  if (pages.error) throw new Error(pages.error.message);
  const ownerByHeight = new Map(
    (pages.data ?? []).map((p) => [Number(p.bitmap_height), p.owner_address] as const),
  );

  // Host & Earn: holder-hosted community experiences earn visitor BIT too,
  // split between the land holder and the experience's creator.
  const hosted = await db
    .from("extender_deployments")
    .select("bitmap_height, deployed_by_address, config, extenders(creator_address)")
    .eq("status", "active")
    .limit(2000);
  const creatorByHeight = new Map<number, string>();
  for (const d of (hosted.data ?? []) as { bitmap_height: number; deployed_by_address: string; config: unknown; extenders: { creator_address: string | null } | null }[]) {
    if (!(d.config && typeof d.config === "object" && (d.config as Record<string, unknown>)["hostAndEarn"] === true)) continue;
    const h = Number(d.bitmap_height);
    if (!ownerByHeight.has(h)) ownerByHeight.set(h, d.deployed_by_address);
    const creator = d.extenders?.creator_address;
    if (creator && creator !== ownerByHeight.get(h)) creatorByHeight.set(h, creator);
  }
  const heights = [...ownerByHeight.keys()];

  const snapshots = new Map<number, { views: number; uniques: number }>();
  const stats = new Map<number, { views: number; uniques: number }>();

  if (heights.length > 0) {
    const [snapRes, statRes] = await Promise.all([
      db.from("coin_view_snapshots").select("bitmap_height, total_views, unique_visitors").in("bitmap_height", heights),
      db.from("bitmap_view_stats").select("bitmap_height, total_views, unique_visitors").in("bitmap_height", heights),
    ]);
    if (snapRes.error) throw new Error(snapRes.error.message);
    if (statRes.error) throw new Error(statRes.error.message);
    for (const row of snapRes.data ?? []) {
      snapshots.set(Number(row.bitmap_height), {
        views: Number(row.total_views),
        uniques: Number(row.unique_visitors),
      });
    }
    for (const row of statRes.data ?? []) {
      stats.set(Number(row.bitmap_height), {
        views: Number(row.total_views),
        uniques: Number(row.unique_visitors),
      });
    }
  }

  const snapshotUpserts: {
    bitmap_height: number;
    total_views: number;
    unique_visitors: number;
    updated_at: string;
  }[] = [];

  // Holder Epoch: lands kept longer in one wallet earn a larger visitor dividend.
  const { readLandBoosts } = await import("@/lib/land-epoch.server");
  const boosts = await readLandBoosts(heights).catch(() => new Map());

  // District Fiefdom: valid parcel holders of a visited BITMAP share part of its visitor BIT.
  const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
  for (const height of heights) {
    const owner = ownerByHeight.get(height) ?? null;
    add(awards, owner, "build_maintained", EMISSION.perBuildMaintained);
    const now = stats.get(height);
    if (!now) continue;
    const before = snapshots.get(height) ?? { views: 0, uniques: 0 };
    const newViews = Math.max(0, now.views - before.views);
    const newUniques = Math.max(0, now.uniques - before.uniques);
    const dividend = boosts.get(height)?.dividend ?? 1;
    let attention = (newViews * EMISSION.perView + newUniques * EMISSION.perUniqueVisitor) * dividend;
    if (attention > 0) {
      const holders = await parcelHoldersFor(height).catch(() => null);
      if (holders && holders.total > 0) {
        const pool = (attention * FIEF_SPLIT.parcelPercent) / 100;
        for (const [address, count] of holders.byAddress) add(awards, address, "fief_dividend", (pool * count) / holders.total);
        attention -= pool;
      }
    }
    const creator = creatorByHeight.get(height);
    if (creator) {
      add(awards, owner, "host_earn_holder", (attention * HOST_SPLIT.holderPercent) / 100);
      add(awards, creator, "host_earn_creator", (attention * HOST_SPLIT.creatorPercent) / 100);
    } else {
      add(awards, owner, "build_attention", attention);
    }
    snapshotUpserts.push({
      bitmap_height: height,
      total_views: now.views,
      unique_visitors: now.uniques,
      updated_at: new Date().toISOString(),
    });
  }

  // 2. Trading in the last day.
  const trades = await db
    .from("trades")
    .select("txid, seller_address, buyer_address")
    .gte("created_at", since)
    .limit(1000);
  if (trades.error) throw new Error(trades.error.message);
  for (const trade of trades.data ?? []) {
    add(awards, trade.seller_address, "trade_reward", EMISSION.perTrade);
    add(awards, trade.buyer_address, "trade_reward", EMISSION.perTrade);
  }

  // 3. Leasing owned bitmaps out.
  const leases = await db
    .from("leases")
    .select("owner_address, lessee_address, days")
    .gte("created_at", since)
    .limit(1000);
  if (leases.error) throw new Error(leases.error.message);
  for (const lease of leases.data ?? []) {
    const days = Math.max(1, Number(lease.days));
    add(awards, lease.owner_address, "lease_reward_owner", days * EMISSION.perLeaseDayEarned);
    add(awards, lease.lessee_address, "lease_reward_lessee", days * EMISSION.perLeaseDayRented);
  }

  // 4. Credit everyone, then pay each inviter their share of the friend's day.
  const { payOverride } = await import("@/lib/referrals.server");
  let awarded = 0;
  let recipients = 0;
  for (const [address, reasons] of awards) {
    let paidAddress = false;
    let earnedToday = 0;
    for (const [reason, amount] of reasons) {
      if (amount <= 0) continue;
      const { error } = await db.rpc("coin_apply", {
        _address: address,
        _delta: amount,
        _reason: reason,
        _ref: runDate,
      });
      if (error) continue;
      awarded += amount;
      earnedToday += amount;
      paidAddress = true;
    }
    if (paidAddress) recipients += 1;
    const share = Math.floor((earnedToday * REFERRAL.sharePercent) / 100);
    if (share > 0) awarded += await payOverride(address, share, runDate);
  }


  if (snapshotUpserts.length > 0) {
    await db.from("coin_view_snapshots").upsert(snapshotUpserts, { onConflict: "bitmap_height" });
  }

  await db
    .from("coin_reward_runs")
    .update({ awarded, recipients })
    .eq("run_date", runDate);

  return { runDate, awarded, recipients, skipped: false };
}

/** Pays for raffle/event tickets from the entrant's BIT balance. */
export async function enterEvent(input: {
  eventId: string;
  address: string;
  tickets: number;
}): Promise<{ entryId: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("coin_enter_event", {
    _event_id: input.eventId,
    _address: input.address,
    _tickets: input.tickets,
  });
  if (error) throw new Error(error.message);
  return { entryId: String(data) };
}

/** Draws a winner, weighted by tickets held. Host only (checked by caller). */
export async function drawEvent(eventId: string): Promise<{ winnerAddress: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("coin_draw_event", { _event_id: eventId });
  if (error) throw new Error(error.message);
  return { winnerAddress: String(data) };
}

/**
 * Confirms the signed-in account controls the address it is acting as. The
 * lookup runs through the caller's own RLS-scoped client, so only wallet links
 * that belong to this account are visible.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type WalletLinkReader = { from: (table: "wallet_links") => any };

export async function assertControls(
  supabase: WalletLinkReader,
  userId: string,
  address: string,
): Promise<void> {
  const result = (await supabase.from("wallet_links").select("address").eq("user_id", userId)) as {
    data: { address: string | null }[] | null;
    error: { message: string } | null;
  };
  if (result.error) throw new Error(result.error.message);
  const wanted = address.trim().toLowerCase();
  const owns = (result.data ?? []).some((row) => (row.address ?? "").toLowerCase() === wanted);
  if (!owns) throw new Error("Verify this wallet address on your wallet page first");
}
/* eslint-enable @typescript-eslint/no-explicit-any */



/** Reads the host address of an event. */
export async function eventHost(eventId: string): Promise<string> {
  const db = await admin();
  const { data, error } = await db
    .from("coin_events")
    .select("host_address")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Event not found");
  return data.host_address;
}

/** Creates a raffle/giveaway/event and locks any BIT prize from the host. */
export async function createEvent(input: {
  kind: string;
  hostAddress: string;
  title: string;
  bitmapHeight: number | null;
  description: string | null;
  prize: string | null;
  prizeCoins: number;
  entryCost: number;
  maxEntries: number | null;
  endsAt: string | null;
}): Promise<{ eventId: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("coin_create_event", {
    _kind: input.kind,
    _host_address: input.hostAddress,
    _title: input.title,
    _prize_coins: input.prizeCoins,
    _entry_cost: input.entryCost,
    ...(input.bitmapHeight === null ? {} : { _bitmap_height: input.bitmapHeight }),
    ...(input.description === null ? {} : { _description: input.description }),
    ...(input.prize === null ? {} : { _prize: input.prize }),
    ...(input.maxEntries === null ? {} : { _max_entries: input.maxEntries }),
    ...(input.endsAt === null ? {} : { _ends_at: input.endsAt }),
  });
  if (error) throw new Error(error.message);
  return { eventId: String(data) };
}

/** Closes an event without a draw and refunds any locked BIT prize. */
export async function closeEvent(eventId: string): Promise<void> {
  const db = await admin();
  const { error } = await db.rpc("coin_close_event", { _event_id: eventId });
  if (error) throw new Error(error.message);
}

/** Reads the spendable BIT balance of one address. */
export async function bitBalance(address: string): Promise<number> {
  const db = await admin();
  const { data, error } = await db
    .from("coin_balances")
    .select("balance")
    .eq("address", address)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.balance ?? 0);
}

/**
 * Charges BIT from an address. Atomic in the database: the debit and the ledger
 * entry land together, and the call fails when the balance is too low.
 */
export async function spendBit(input: {
  address: string;
  amount: number;
  reason: string;
  ref?: string | null;
}): Promise<{ balance: number }> {
  const db = await admin();
  const { data, error } = await db.rpc("coin_spend", {
    _address: input.address,
    _amount: input.amount,
    _reason: input.reason,
    ...(input.ref ? { _ref: input.ref } : {}),
  });
  if (error) throw new Error(error.message);
  return { balance: Number(data ?? 0) };
}
