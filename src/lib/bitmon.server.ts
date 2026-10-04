import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GUARDIAN_PRICE_SATS,
  GUARDIAN_TREASURY,
  GUARDIAN_TREASURIES,
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

  const { esploraFetch } = await import("@/lib/bitmon");
  let match: MempoolTx | undefined;
  if (row.txid) {
    // A txid was already recorded: verify that exact tx, however old it is.
    try {
      const tx = (await (await esploraFetch(`/tx/${row.txid}`)).json()) as MempoolTx;
      const pays = (tx.vout ?? []).some((o) => GUARDIAN_TREASURIES.includes(o.scriptpubkey_address ?? "") && Number(o.value) === Number(row.amount_sats));
      if (pays) match = tx;
    } catch { /* fall through to address scan */ }
  }
  if (!match) {
    let res: Response;
    try {
      res = await esploraFetch(`/address/${GUARDIAN_TREASURY}/txs`);
    } catch {
      return { order: toOrder(row), awakened: false };
    }
    const txs = (await res.json()) as MempoolTx[];
    const since = new Date(row.created_at).getTime() - 10 * 60_000;
    match = txs.find(
      (tx) =>
        (!tx.status?.block_time || tx.status.block_time * 1000 >= since) &&
        (tx.vout ?? []).some((o) => GUARDIAN_TREASURIES.includes(o.scriptpubkey_address ?? "") && Number(o.value) === Number(row.amount_sats)),
    );
  }
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

export type SummonOrderStatus = {
  id: string;
  height: number;
  amountSats: number;
  status: SummonOrder["status"];
  txid: string | null;
  expiresAt: string;
  createdAt: string;
  /** Live chain data: null until a payment tx is seen. */
  confirmations: number | null;
  confirmed: boolean;
  awake: boolean;
};

/** Every summon order for this user, enriched with live confirmation counts. */
export async function listMySummonOrders(userId: string): Promise<SummonOrderStatus[]> {
  const db = await admin();
  await db.from("bitmon_summon_orders").update({ status: "expired" }).eq("status", "pending").lt("expires_at", new Date().toISOString());

  // Auto-settle: re-check every open order against the chain so a confirmed
  // payment awakens its Guardian even if the summon dialog was closed.
  const { data: open } = await db
    .from("bitmon_summon_orders")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["pending", "seen"])
    .limit(10);
  for (const o of (open ?? []) as { id: string }[]) {
    try { await checkSummonOrder(userId, o.id); } catch (e) { console.error("[summon-dashboard] settle failed for order", o.id, e); }
  }

  const { data } = await db
    .from("bitmon_summon_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as OrderRow[];

  let tip = 0;
  try {
    const { esploraFetch } = await import("@/lib/bitmon");
    tip = Number(await (await esploraFetch(`/blocks/tip/height`)).text()) || 0;
  } catch { /* tip stays 0; confirmations fall back to confirmed flag */ }

  const awake = new Set<number>();
  if (rows.length) {
    const { data: gs } = await db.from("bitmon_guardians").select("block_height").in("block_height", rows.map((r) => Number(r.block_height)));
    for (const g of gs ?? []) awake.add(Number((g as { block_height: number }).block_height));
  }

  return Promise.all(rows.map(async (r) => {
    let confirmations: number | null = null;
    let confirmed = false;
    if (r.txid) {
      try {
        const { esploraFetch } = await import("@/lib/bitmon");
        const tx = (await (await esploraFetch(`/tx/${r.txid}`)).json()) as MempoolTx;
        confirmed = Boolean(tx.status?.confirmed);
        const bh = (tx.status as { block_height?: number } | undefined)?.block_height;
        confirmations = confirmed && tip && bh ? Math.max(1, tip - bh + 1) : confirmed ? 1 : 0;
      } catch { /* leave null */ }
    }
    return {
      id: r.id,
      height: Number(r.block_height),
      amountSats: Number(r.amount_sats),
      status: r.status as SummonOrder["status"],
      txid: r.txid,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      confirmations,
      confirmed,
      awake: awake.has(Number(r.block_height)),
    };
  }));
}

/**
 * Awaken a delegate-minted Guardian from on-chain proof alone. Every check is
 * read from the chain: delegate = master generator, a parent whose content is
 * exactly `<height>.bitmap`, a confirmed reveal paying the tribute, and the
 * first Guardian for that block. Anything else is refused.
 */
export async function verifyDelegateGuardian(inscriptionId: string): Promise<{ awakened: boolean; height: number | null; denied: string | null }> {
  const { GUARDIAN_MASTER_DELEGATE_IDS, ACCEPTED_TRIBUTE_ADDRESSES, TRIBUTE_SATS } = await import("@/lib/guardian-delegate");
  const ord = (p: string) => fetch(`https://ordinals.com${p}`, { signal: AbortSignal.timeout(8000) });
  const deny = (denied: string, height: number | null = null) => ({ awakened: false, height, denied });

  const insRes = await ord(`/r/inscription/${inscriptionId}`);
  if (!insRes.ok) return deny("INSCRIPTION NOT FOUND");
  const ins = (await insRes.json()) as { delegate?: string; address?: string };
  if (!ins.delegate || !GUARDIAN_MASTER_DELEGATE_IDS.includes(ins.delegate)) return deny("NOT A GUARDIAN DELEGATE MINT");

  const parRes = await ord(`/r/parents/${inscriptionId}`);
  const ids: string[] = parRes.ok ? ((await parRes.json()) as { ids?: string[] }).ids ?? [] : [];
  let height: number | null = null;
  let parentId: string | null = null;
  for (const id of ids) {
    const r = await ord(`/content/${id}`);
    const m = r.ok ? /^\s*(\d{1,7})\.bitmap\s*$/i.exec(await r.text()) : null;
    if (m) { height = Number(m[1]); parentId = id; break; }
  }
  if (height === null || !parentId) return deny("INVALID BITMAP PARENT");

  // Canonical check: the parent must be the first-is-first BITMAP per the
  // on-chain index (OCI) module; our bitmap_index is the fallback when the
  // OCI can't resolve the block (out of range or unreachable).
  const { ociBitmapInscriptionId } = await import("@/lib/bitmap-oci.server");
  let canonId: string | null = null;
  try { canonId = await ociBitmapInscriptionId(height); } catch { canonId = null; }
  if (!canonId) {
    const idxDb = await admin();
    const canon = await idxDb.from("bitmap_index").select("inscription_id").eq("block_height", height).maybeSingle();
    canonId = canon.data?.inscription_id ?? null;
  }
  if (!canonId) return deny(`${height}.BITMAP IS NOT IN THE INDEX YET — TRY AGAIN LATER`, height);
  if (canonId !== parentId) return deny(`PARENT IS NOT THE CANONICAL ${height}.BITMAP (DUPLICATE CLAIM)`, height);

  const txid = inscriptionId.slice(0, inscriptionId.lastIndexOf("i"));
  const { esploraFetch } = await import("@/lib/bitmon");
  let tx: MempoolTx;
  try { tx = (await (await esploraFetch(`/tx/${txid}`)).json()) as MempoolTx; } catch { return deny("COULD NOT READ THE REVEAL — TRY AGAIN", height); }
  if (!tx.status?.confirmed) return deny("REVEAL NOT CONFIRMED YET", height);
  const paid = (tx.vout ?? []).some((o) => ACCEPTED_TRIBUTE_ADDRESSES.includes(String(o.scriptpubkey_address)) && Number(o.value) >= TRIBUTE_SATS);
  if (!paid) return deny(`NO ${TRIBUTE_SATS}-SAT TRIBUTE IN THE REVEAL`, height);

  const db = await admin();
  const existing = await db.from("bitmon_guardians").select("id, payment_txid, stats").eq("block_height", height).maybeSingle();
  if (existing.data) {
    if (existing.data.payment_txid === txid) return { awakened: true, height, denied: null };
    // An in-app awakening becomes the collection item once its verified
    // on-chain child is attached. First verified child for the block wins.
    const stats = (existing.data.stats ?? {}) as Record<string, unknown>;
    const current = typeof stats["inscription"] === "string" ? (stats["inscription"] as string) : null;
    if (current && current !== inscriptionId) return deny("THIS BLOCK'S GUARDIAN IS ALREADY INSCRIBED", height);
    if (!current) {
      const upd = await db.from("bitmon_guardians").update({ stats: { ...stats, inscription: inscriptionId } }).eq("id", existing.data.id).select("id").maybeSingle();
      if (!upd.data) return deny("COULD NOT RECORD THE INSCRIPTION — TRY AGAIN", height);
    }
    return { awakened: true, height, denied: null };
  }

  const dna = guardianFromBlock(await fetchBlockDnaSource(height));
  const inserted = await db.from("bitmon_guardians").insert({
    block_height: height,
    species: dna.species,
    rarity: dna.rarity,
    stats: { hp: dna.hp, bite: dna.bite, speed: dna.speed, armor: dna.armor, ability: dna.ability, epoch: dna.epoch, body: dna.body, accent: dna.accent, level: guardianLevel(dna), inscription: inscriptionId },
    dna_hash: dna.dnaHash,
    summoned_by_address: ins.address ?? "",
    summoned_by_user_id: null,
    payment_txid: txid,
  }).select("id").maybeSingle();
  if (!inserted.data) return deny("THIS BLOCK'S GUARDIAN IS ALREADY AWAKE", height);
  return { awakened: true, height, denied: null };
}
