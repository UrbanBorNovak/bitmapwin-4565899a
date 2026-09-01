import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MARKETPLACE_FEE_ADDRESS, marketplaceFeeSats } from "@/lib/marketplace-fee";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import {
  buildPaymentPsbt,
  byteArrayToHex,
  extractRawTxHex,
  parsePsbt,
  type FundingUtxo,
} from "@/lib/psbt-buyer";

/**
 * Rent side of bitmap leasing. Rent is paid with a real signed PSBT built from
 * the lessee's own confirmed UTXOs: output 0 pays the holder, output 1 pays the
 * marketplace fee. The lease only becomes active once that transaction is
 * broadcast, so every active lease is backed by an on-chain payment.
 */

const ESPLORA_HOSTS = [
  "https://mempool.space/api",
  "https://blockstream.info/api",
  "https://mempool.emzy.de/api",
];
const UA = "bitmap-marketplace/1.0";

function db() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function esplora<T>(path: string): Promise<T | null> {
  for (const host of ESPLORA_HOSTS) {
    try {
      const resp = await fetch(`${host}${path}`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) continue;
      return (await resp.json()) as T;
    } catch {
      // next mirror
    }
  }
  return null;
}

async function postTx(rawHex: string): Promise<{ txid: string } | { error: string }> {
  let lastError = "no response from any broadcast endpoint";
  for (const host of ESPLORA_HOSTS) {
    try {
      const resp = await fetch(`${host}/tx`, {
        method: "POST",
        headers: { "content-type": "text/plain", "user-agent": UA },
        body: rawHex,
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await resp.text()).trim();
      if (resp.ok && /^[0-9a-f]{64}$/i.test(body)) return { txid: body };
      lastError = body || `HTTP ${resp.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "network error";
    }
  }
  return { error: lastError };
}

async function feeRate(): Promise<number> {
  const fees = await esplora<{ halfHourFee?: number; fastestFee?: number }>(
    "/v1/fees/recommended",
  );
  const rate = Number(fees?.halfHourFee ?? fees?.fastestFee ?? 0);
  return rate > 0 ? rate : 8;
}

type EsploraUtxo = {
  txid: string;
  vout: number;
  value: number;
  status?: { confirmed?: boolean };
};

async function fundingFor(address: string): Promise<FundingUtxo[]> {
  const utxos = await esplora<EsploraUtxo[]>(`/address/${address}/utxo`);
  if (!utxos) throw new Error("Could not read the paying address UTXO set");
  const scriptHex = byteArrayToHex(addressToScriptPubKey(address));
  return utxos
    .filter((u) => u.status?.confirmed !== false && u.value > 546)
    .map((u) => ({
      txid: u.txid,
      vout: u.vout,
      valueSats: u.value,
      scriptPubKeyHex: scriptHex,
    }));
}

const OFFER_COLUMNS =
  "id, bitmap_height, owner_address, rate_sats_per_day, min_days, max_days, status";

type LeaseOfferRow = {
  id: string;
  bitmap_height: number;
  owner_address: string;
  rate_sats_per_day: number;
  min_days: number;
  max_days: number;
  status: string;
};

async function loadOffer(offerId: string): Promise<LeaseOfferRow> {
  const { data, error } = await db()
    .from("lease_offers")
    .select(OFFER_COLUMNS)
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lease offer not found");
  if (data.status !== "open") throw new Error("This bitmap is no longer offered for lease");
  return data as LeaseOfferRow;
}

async function activeLease(height: number): Promise<{ ends_at: string } | null> {
  const { data, error } = await db()
    .from("leases")
    .select("ends_at")
    .eq("bitmap_height", height)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export type LeaseQuoteInput = {
  offerId: string;
  days: number;
  /** the lessee's payment address, which funds and signs the rent transaction */
  payAddress: string;
  tapInternalKeyHex?: string | undefined;
};

export type LeaseQuote = {
  offerId: string;
  bitmapHeight: number;
  ownerAddress: string;
  days: number;
  rateSatsPerDay: number;
  rentSats: number;
  marketFeeSats: number;
  minerFeeSats: number;
  totalSats: number;
  psbtBase64: string;
  signIndices: number[];
};

export async function quoteLease(input: LeaseQuoteInput): Promise<LeaseQuote> {
  const offer = await loadOffer(input.offerId);
  const days = Math.floor(input.days);
  if (!Number.isFinite(days) || days < offer.min_days || days > offer.max_days) {
    throw new Error(`Lease length must be between ${offer.min_days} and ${offer.max_days} days`);
  }
  const existing = await activeLease(offer.bitmap_height);
  if (existing) throw new Error(`Already leased until ${existing.ends_at}`);

  const rentSats = offer.rate_sats_per_day * days;
  if (rentSats < 546) throw new Error("Rent must be at least 546 sats");
  const marketFee = marketplaceFeeSats(rentSats);

  const funding = await fundingFor(input.payAddress);
  const built = buildPaymentPsbt({
    funding,
    payerScriptHex: byteArrayToHex(addressToScriptPubKey(input.payAddress)),
    outputs: [
      {
        scriptHex: byteArrayToHex(addressToScriptPubKey(offer.owner_address)),
        valueSats: rentSats,
      },
      {
        scriptHex: byteArrayToHex(addressToScriptPubKey(MARKETPLACE_FEE_ADDRESS)),
        valueSats: marketFee,
      },
    ],
    feeRate: await feeRate(),
    tapInternalKeyHex: input.tapInternalKeyHex,
  });

  return {
    offerId: offer.id,
    bitmapHeight: offer.bitmap_height,
    ownerAddress: offer.owner_address,
    days,
    rateSatsPerDay: offer.rate_sats_per_day,
    rentSats,
    marketFeeSats: marketFee,
    minerFeeSats: built.feeSats,
    totalSats: rentSats + marketFee + built.feeSats,
    psbtBase64: built.psbtBase64,
    signIndices: built.signIndices,
  };
}

export type LeaseSubmitInput = {
  offerId: string;
  days: number;
  lesseeAddress: string;
  psbt: string;
};

export type LeaseSubmitResult = {
  txid: string;
  leaseId: string;
  endsAt: string;
  rentSats: number;
};

export async function submitLease(input: LeaseSubmitInput): Promise<LeaseSubmitResult> {
  const offer = await loadOffer(input.offerId);
  const days = Math.floor(input.days);
  if (!Number.isFinite(days) || days < offer.min_days || days > offer.max_days) {
    throw new Error(`Lease length must be between ${offer.min_days} and ${offer.max_days} days`);
  }
  const existing = await activeLease(offer.bitmap_height);
  if (existing) throw new Error(`Already leased until ${existing.ends_at}`);

  const rentSats = offer.rate_sats_per_day * days;
  const marketFee = marketplaceFeeSats(rentSats);

  // verify the signed transaction really pays the holder before broadcasting
  const parsed = parsePsbt(input.psbt.replace(/\s+/g, ""));
  const ownerScript = byteArrayToHex(addressToScriptPubKey(offer.owner_address));
  const feeScript = byteArrayToHex(addressToScriptPubKey(MARKETPLACE_FEE_ADDRESS));
  const paidOwner = parsed.tx.outputs
    .filter((o) => byteArrayToHex(o.script) === ownerScript)
    .reduce((sum, o) => sum + o.valueSats, 0);
  const paidFee = parsed.tx.outputs
    .filter((o) => byteArrayToHex(o.script) === feeScript)
    .reduce((sum, o) => sum + o.valueSats, 0);
  if (paidOwner < rentSats) {
    throw new Error(`Rent transaction pays the holder ${paidOwner} sats, expected ${rentSats}`);
  }
  if (paidFee < marketFee) throw new Error("Rent transaction is missing the marketplace fee");

  const rawHex = extractRawTxHex(input.psbt.replace(/\s+/g, ""));
  if (!rawHex) throw new Error("The rent transaction is not fully signed yet");
  const broadcast = await postTx(rawHex);
  if ("error" in broadcast) throw new Error(`Broadcast failed: ${broadcast.error}`);

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 86_400_000);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leases")
    .insert({
      bitmap_height: offer.bitmap_height,
      owner_address: offer.owner_address,
      lessee_address: input.lesseeAddress,
      rate_sats_per_day: offer.rate_sats_per_day,
      days,
      total_sats: rentSats,
      fee_sats: marketFee,
      txid: broadcast.txid,
      psbt_base64: input.psbt.replace(/\s+/g, ""),
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("activity").insert({
    type: "lease",
    wallet_address: input.lesseeAddress,
    metadata: {
      bitmap_height: offer.bitmap_height,
      owner_address: offer.owner_address,
      days,
      rent_sats: rentSats,
      txid: broadcast.txid,
    },
  });

  return {
    txid: broadcast.txid,
    leaseId: data.id,
    endsAt: endsAt.toISOString(),
    rentSats,
  };
}

/** Marks leases whose term has passed as expired. */
export async function expireLeases(): Promise<{ expired: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leases")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(error.message);
  return { expired: data?.length ?? 0 };
}
