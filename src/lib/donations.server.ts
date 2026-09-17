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
