import { DONATION_ADDRESS, donationPayout } from "@/lib/donations";

/**
 * Server side of inscription donations. The chain is the only source of truth:
 * ordinals.com tells us where the inscription lives now and how many sats ride
 * with it, and mempool.space tells us which wallet sent it there.
 */

const ORD = "https://ordinals.com";
const MEMPOOL = "https://mempool.space/api";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error(`Could not reach ${url}: ${String(lastError)}`);
}

type OrdInscription = {
  id?: string;
  address?: string | null;
  value?: number | null;
  satpoint?: string | null;
  content_type?: string | null;
};

type MempoolTx = {
  txid: string;
  vin: Array<{ prevout?: { scriptpubkey_address?: string | null } | null }>;
};

export type DonationResult = {
  inscriptionId: string;
  sats: number;
  bits: number;
  balance: number;
  txid: string | null;
  alreadyClaimed: boolean;
};

const ID_SHAPE = /^[0-9a-f]{64}i\d{1,5}$/i;

/**
 * Verifies a donated inscription and pays out BIT. Idempotent per inscription:
 * a second claim returns the original payout instead of paying twice.
 */
export async function claimInscriptionDonation(
  inscriptionId: string,
  donorAddress: string,
  donorUserId: string,
): Promise<DonationResult> {
  const id = inscriptionId.trim().toLowerCase();
  if (!ID_SHAPE.test(id)) throw new Error("That does not look like an inscription id");

  const db = await admin();

  const existing = await db
    .from("inscription_donations")
    .select("inscription_id, donor_address, sats, bits_awarded, txid")
    .eq("inscription_id", id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if ((existing.data.donor_address ?? "").toLowerCase() !== donorAddress.toLowerCase()) {
      throw new Error("This inscription was already donated by another wallet");
    }
    const balances = await db
      .from("coin_balances")
      .select("balance")
      .eq("address", donorAddress)
      .maybeSingle();
    return {
      inscriptionId: id,
      sats: Number(existing.data.sats),
      bits: Number(existing.data.bits_awarded),
      balance: Number(balances.data?.balance ?? 0),
      txid: existing.data.txid,
      alreadyClaimed: true,
    };
  }

  const info = await getJson<OrdInscription>(`${ORD}/r/inscription/${id}`);
  const holder = (info.address ?? "").trim();
  if (!holder) throw new Error("The chain has not indexed this inscription yet — try again later");
  if (holder.toLowerCase() !== DONATION_ADDRESS.toLowerCase()) {
    throw new Error("Send the inscription to the donation address first, then claim");
  }

  const satpoint = (info.satpoint ?? "").split(":");
  const txid = satpoint[0] && satpoint[0].length === 64 ? satpoint[0] : null;
  let sats = Number(info.value ?? 0);

  if (!txid) throw new Error("Could not read where this inscription sits — try again later");

  const transfer = await getJson<MempoolTx>(`${MEMPOOL}/tx/${txid}`);
  const senders = transfer.vin
    .map((input) => (input.prevout?.scriptpubkey_address ?? "").toLowerCase())
    .filter(Boolean);
  if (!senders.includes(donorAddress.toLowerCase())) {
    throw new Error("This inscription was not sent from your verified wallet");
  }

  if (!Number.isFinite(sats) || sats <= 0) sats = 546;
  const bits = donationPayout(sats);

  const insert = await db
    .from("inscription_donations")
    .insert({
      inscription_id: id,
      donor_address: donorAddress,
      donor_user_id: donorUserId,
      txid,
      sats,
      bits_awarded: bits,
      status: "credited",
      note: info.content_type ?? null,
    })
    .select("id");
  if (insert.error) throw new Error(insert.error.message);

  const paid = await db.rpc("coin_apply", {
    _address: donorAddress,
    _delta: bits,
    _reason: "inscription_donation",
    _ref: id,
  });
  if (paid.error) throw new Error(paid.error.message);

  return {
    inscriptionId: id,
    sats,
    bits,
    balance: Number(paid.data ?? 0),
    txid,
    alreadyClaimed: false,
  };
}

export type BtcClaimResult = {
  credited: Array<{ txid: string; sats: number; bits: number; confirmed: boolean }>;
  sats: number;
  bits: number;
  balance: number;
  scanned: number;
};

type MempoolAddressTx = {
  txid: string;
  status?: { confirmed?: boolean };
  vin: Array<{ txid?: string; prevout?: { scriptpubkey_address?: string | null } | null }>;
  vout: Array<{ scriptpubkey_address?: string | null; value?: number | null }>;
};

/**
 * REAL BITCOIN DONATIONS — walks the platform address's transaction history and
 * credits every payment that came from this donor's verified wallet.
 *
 * The chain is the only source of truth: we read the transactions of the
 * donation address itself, require the donor's address among the inputs, and
 * count only the sats that actually landed on the donation address. Each txid
 * is recorded once, and transactions already paid out as inscription donations
 * are skipped so nothing is credited twice.
 */
export async function claimBtcDonations(
  donorAddress: string,
  donorUserId: string,
): Promise<BtcClaimResult> {
  const db = await admin();
  const donor = donorAddress.toLowerCase();

  const [chain, pending] = await Promise.all([
    getJson<MempoolAddressTx[]>(`${MEMPOOL}/address/${DONATION_ADDRESS}/txs`),
    getJson<MempoolAddressTx[]>(`${MEMPOOL}/address/${DONATION_ADDRESS}/txs/mempool`).catch(
      () => [] as MempoolAddressTx[],
    ),
  ]);
  const all = [...pending, ...chain];

  const paidBy = (tx: MempoolAddressTx) =>
    tx.vin.some((input) => (input.prevout?.scriptpubkey_address ?? "").toLowerCase() === donor);
  const mine = all.filter(paidBy);
  // Confirmed inscription reveals that pay the optional site tribute: the reveal spends a
  // one-time commit address, so the donor is whoever funded that commit transaction.
  const reveals = chain.filter((tx) => tx.status?.confirmed && !paidBy(tx) && tx.vin[0]?.txid).slice(0, 25);
  await Promise.all(reveals.map(async (tx) => {
    const commit = await getJson<MempoolAddressTx>(`${MEMPOOL}/tx/${tx.vin[0]!.txid}`, 1).catch(() => null);
    if (commit && paidBy(commit)) mine.push(tx);
  }));
  if (mine.length === 0) {
    const balances = await db
      .from("coin_balances")
      .select("balance")
      .eq("address", donorAddress)
      .maybeSingle();
    return {
      credited: [],
      sats: 0,
      bits: 0,
      balance: Number(balances.data?.balance ?? 0),
      scanned: all.length,
    };
  }

  const ids = mine.map((tx) => tx.txid);
  const [seen, viaInscription] = await Promise.all([
    db.from("btc_donations").select("txid").in("txid", ids),
    db.from("inscription_donations").select("txid").in("txid", ids),
  ]);
  if (seen.error) throw new Error(seen.error.message);
  const already = new Set<string>([
    ...(seen.data ?? []).map((row) => row.txid),
    ...(viaInscription.data ?? []).map((row) => row.txid ?? "").filter(Boolean),
  ]);

  const credited: BtcClaimResult["credited"] = [];
  let balance = 0;

  for (const tx of mine) {
    if (already.has(tx.txid)) continue;
    const sats = tx.vout
      .filter(
        (out) =>
          (out.scriptpubkey_address ?? "").toLowerCase() === DONATION_ADDRESS.toLowerCase(),
      )
      .reduce((sum, out) => sum + Number(out.value ?? 0), 0);
    if (!Number.isFinite(sats) || sats <= 0) continue;

    const bits = donationPayout(sats);
    const confirmed = Boolean(tx.status?.confirmed);

    const insert = await db
      .from("btc_donations")
      .insert({
        txid: tx.txid,
        donor_address: donorAddress,
        donor_user_id: donorUserId,
        sats,
        bits_awarded: bits,
        status: "credited",
        confirmed,
      })
      .select("id");
    // A racing claim for the same transaction loses here — that is the point.
    if (insert.error) continue;

    const paid = await db.rpc("coin_apply", {
      _address: donorAddress,
      _delta: bits,
      _reason: "btc_donation",
      _ref: tx.txid,
    });
    if (paid.error) throw new Error(paid.error.message);
    balance = Number(paid.data ?? balance);
    credited.push({ txid: tx.txid, sats, bits, confirmed });
  }

  if (!credited.length) {
    const balances = await db
      .from("coin_balances")
      .select("balance")
      .eq("address", donorAddress)
      .maybeSingle();
    balance = Number(balances.data?.balance ?? 0);
  }

  return {
    credited,
    sats: credited.reduce((sum, row) => sum + row.sats, 0),
    bits: credited.reduce((sum, row) => sum + row.bits, 0),
    balance,
    scanned: all.length,
  };
}
