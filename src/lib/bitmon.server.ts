import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GUARDIAN_PRICE_SATS,
  GUARDIAN_TREASURY,
  fetchBlockDnaSource,
  guardianFromBlock,
  guardianLevel,
} from "@/lib/bitmon";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type SummonOrder = {
  id: string;
  height: number;
  payTo: string;
  amountSats: number;
  status: "pending" | "seen" | "settled" | "expired" | "taken";
  txid: string | null;
  expiresAt: string;
};

type OrderRow = {
  id: string;
  block_height: number;
  amount_sats: number;
  status: string;
  txid: string | null;
  expires_at: string;
  created_at: string;
  payer_address: string;
  user_id: string;
};

const toOrder = (r: OrderRow): SummonOrder => ({
  id: r.id,
  height: Number(r.block_height),
  payTo: GUARDIAN_TREASURY,
  amountSats: Number(r.amount_sats),
  status: r.status as SummonOrder["status"],
  txid: r.txid,
  expiresAt: r.expires_at,
});

export type SummonResult = { order: SummonOrder | null; denied: string | null };

/** Only the verified holder of the BITMAP can open an invoice for its Guardian. */
export async function createSummonOrder(userDb: SupabaseClient, userId: string, height: number): Promise<SummonResult> {
  const db = await admin();
  const existing = await db.from("bitmon_guardians").select("id").eq("block_height", height).maybeSingle();
  if (existing.data) return { order: null, denied: "THIS BLOCK'S GUARDIAN IS ALREADY AWAKE" };

  const { data: links } = await userDb.from("wallet_links").select("address").eq("user_id", userId);
  const mine = new Set((links ?? []).map((l: { address: string }) => l.address));
  if (!mine.size) return { order: null, denied: "VERIFY A WALLET FIRST ON THE WALLET PAGE" };

  const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
  let holder: string | null = null;
  try {
    holder = (await locateBitmapHolder(height)).ownerAddress;
  } catch {
    return { order: null, denied: "COULD NOT CONFIRM WHO HOLDS THIS BITMAP — TRY AGAIN" };
  }
  if (!holder || !mine.has(holder)) return { order: null, denied: "ONLY THE HOLDER OF THIS BITMAP CAN SUMMON ITS GUARDIAN" };

  await db.from("bitmon_summon_orders").update({ status: "expired" }).eq("status", "pending").lt("expires_at", new Date().toISOString());

  const open = await db
    .from("bitmon_summon_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("block_height", height)
    .in("status", ["pending", "seen"])
    .maybeSingle();
  if (open.data) return { order: toOrder(open.data as OrderRow), denied: null };

  for (let i = 0; i < 12; i++) {
    const amount = GUARDIAN_PRICE_SATS + 1 + Math.floor(Math.random() * 999);
    const created = await db
      .from("bitmon_summon_orders")
      .insert({ user_id: userId, block_height: height, payer_address: holder, amount_sats: amount })
      .select("*")
      .maybeSingle();
    if (created.data) return { order: toOrder(created.data as OrderRow), denied: null };
  }
  throw new Error("Could not issue a summon amount — try again");
}

/** Resume an existing open summon order without creating a new invoice. */
export async function resumeSummonOrder(userId: string, height: number): Promise<SummonOrder | null> {
  const db = await admin();
  const { data } = await db
    .from("bitmon_summon_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("block_height", height)
    .in("status", ["pending", "seen"])
    .maybeSingle();
  return data ? toOrder(data as OrderRow) : null;
}

type MempoolTx = {
  txid: string;
  status?: { confirmed?: boolean; block_time?: number };
  vout?: { scriptpubkey_address?: string; value?: number }[];
};

export async function checkSummonOrder(userId: string, orderId: string) {
  const db = await admin();
  const { data } = await db.from("bitmon_summon_orders").select("*").eq("id", orderId).eq("user_id", userId).maybeSingle();
  if (!data) return { order: null, awakened: false };
  const row = data as OrderRow;
  if (row.status === "settled" || row.status === "taken") return { order: toOrder(row), awakened: row.status === "settled" };

  let res: Response;
  try {
    const { esploraFetch } = await import("@/lib/bitmon");
    res = await esploraFetch(`/address/${GUARDIAN_TREASURY}/txs`);
  } catch {
    return { order: toOrder(row), awakened: false };
  }
  const txs = (await res.json()) as MempoolTx[];
  const since = new Date(row.created_at).getTime() - 10 * 60_000;
  const match = txs.find(
    (tx) =>
      (!tx.status?.block_time || tx.status.block_time * 1000 >= since) &&
      (tx.vout ?? []).some((o) => o.scriptpubkey_address === GUARDIAN_TREASURY && Number(o.value) === Number(row.amount_sats)),
  );
  if (!match) {
    if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
      await db.from("bitmon_summon_orders").update({ status: "expired" }).eq("id", row.id);
      return { order: { ...toOrder(row), status: "expired" as const }, awakened: false };
    }
    return { order: toOrder(row), awakened: false };
  }
  if (!match.status?.confirmed) {
    // Seen in mempool: keep the invoice alive until it confirms.
    await db.from("bitmon_summon_orders").update({ status: "seen", txid: match.txid, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).eq("id", row.id);
    return { order: { ...toOrder(row), status: "seen" as const, txid: match.txid }, awakened: false };
  }

  const dna = guardianFromBlock(await fetchBlockDnaSource(Number(row.block_height)));
  const inserted = await db
    .from("bitmon_guardians")
    .insert({
      block_height: row.block_height,
      species: dna.species,
      rarity: dna.rarity,
      stats: { hp: dna.hp, bite: dna.bite, speed: dna.speed, armor: dna.armor, ability: dna.ability, epoch: dna.epoch, body: dna.body, accent: dna.accent, level: guardianLevel(dna) },
      dna_hash: dna.dnaHash,
      summoned_by_address: row.payer_address,
      summoned_by_user_id: userId,
      payment_txid: match.txid,
    })
    .select("id")
    .maybeSingle();
  const status = inserted.data ? "settled" : "taken";
  await db.from("bitmon_summon_orders").update({ status, txid: match.txid }).eq("id", row.id);

  if (inserted.data) {
    const { appendProvenance } = await import("@/lib/passport.server");
    await appendProvenance({
      sourceKey: `guardian:${row.block_height}`,
      eventType: "guardian_summoned",
      userId,
      wallet: row.payer_address,
      bitmapHeight: Number(row.block_height),
      sourceType: "bitcoin_tx",
      sourceId: match.txid,
      proofLevel: "CHAIN",
      title: "GUARDIAN AWAKENED",
      summary: `${dna.rarity} ${dna.species} awakened on ${row.block_height}.BITMAP · ${dna.hp} HP`,
      metadata: { species: dna.species, rarity: dna.rarity, hp: dna.hp },
    }).catch(() => undefined);
  }
  return { order: { ...toOrder(row), status: status as SummonOrder["status"], txid: match.txid }, awakened: Boolean(inserted.data) };
}
