import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import {
  buildBuyerPsbt,
  byteArrayToHex,
  extractRawTxHex,
  type FundingUtxo,
} from "@/lib/psbt-buyer";

/**
 * Buy side of the offer book. Reads the seller's stored PSBT plus the buyer's
 * real UTXO set, builds the buyer half of the transaction, and — once signed —
 * broadcasts it to the network. No simulated state: every value comes from the
 * chain or from the stored offer.
 */

const ESPLORA_HOSTS = [
  "https://mempool.space/api",
  "https://blockstream.info/api",
  "https://mempool.emzy.de/api",
];
const ORD = "https://ordinals.com";
const UA = "bitmap-marketplace/1.0";

function db() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function esplora<T>(path: string, parse: "json" | "text" = "json"): Promise<T | null> {
  for (const host of ESPLORA_HOSTS) {
    try {
      const resp = await fetch(`${host}${path}`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) continue;
      return (parse === "json" ? await resp.json() : await resp.text()) as T;
    } catch {
      // try the next mirror
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

type EsploraUtxo = {
  txid: string;
  vout: number;
  value: number;
  status?: { confirmed?: boolean; block_height?: number };
};

async function hasInscription(outpoint: string): Promise<boolean | null> {
  try {
    const resp = await fetch(`${ORD}/output/${outpoint}`, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { inscriptions?: string[] | null };
    return (json.inscriptions ?? []).length > 0;
  } catch {
    return null;
  }
}

async function feeRate(): Promise<number> {
  const fees = await esplora<{ halfHourFee?: number; fastestFee?: number }>(
    "/v1/fees/recommended",
  );
  const rate = Number(fees?.halfHourFee ?? fees?.fastestFee ?? 0);
  return rate > 0 ? rate : 8;
}

const OFFER_COLUMNS =
  "id, psbt_base64, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status";

async function loadOffer(offerId: string) {
  const { data, error } = await db().from("offers").select(OFFER_COLUMNS).eq("id", offerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Offer not found");
  return data;
}

export type PurchaseQuote = {
  offerId: string;
  bitmapHeight: number | null;
  outpoint: string;
  sellerAddress: string | null;
  psbtBase64: string;
  signIndices: number[];
  priceSats: number;
  feeSats: number;
  feeRate: number;
  changeSats: number;
  inscriptionValueSats: number;
  fundingInputs: number;
};

/** Builds the buyer half of the sale PSBT against the buyer's live UTXO set. */
export async function buildPurchase(input: {
  offerId: string;
  buyerPaymentAddress: string;
  buyerOrdinalsAddress: string;
  tapInternalKeyHex?: string | undefined;
}): Promise<PurchaseQuote> {
  const offer = await loadOffer(input.offerId);
  if (offer.status !== "open") throw new Error("This offer is no longer open");
  if (offer.seller_address && offer.seller_address === input.buyerOrdinalsAddress) {
    throw new Error("This is your own listing");
  }

  const [txidHex, voutRaw] = offer.outpoint.split(":");
  if (!txidHex || voutRaw === undefined) throw new Error("Offer has a malformed outpoint");
  const vout = Number(voutRaw);

  const spend = await esplora<{ spent?: boolean }>(`/tx/${txidHex}/outspend/${vout}`);
  if (spend?.spent === true) throw new Error("The listed inscription UTXO has already been spent");

  const tx = await esplora<{ vout: Array<{ value: number }> }>(`/tx/${txidHex}`);
  const inscriptionValueSats = Number(tx?.vout?.[vout]?.value ?? 0);
  if (!inscriptionValueSats) throw new Error("Could not read the inscription UTXO value from the chain");

  const utxos = await esplora<EsploraUtxo[]>(`/address/${input.buyerPaymentAddress}/utxo`);
  if (utxos === null) throw new Error("Could not read your wallet UTXOs — try again shortly");

  const confirmed = utxos
    .filter((u) => u.status?.confirmed !== false && Number(u.value) > 546)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 12);
  if (confirmed.length === 0) throw new Error("No confirmed funding UTXOs in your payment address");

  // never spend a UTXO that carries an inscription as plain funding
  const safe: EsploraUtxo[] = [];
  for (const utxo of confirmed) {
    const carries = await hasInscription(`${utxo.txid}:${utxo.vout}`);
    if (carries !== true) safe.push(utxo);
  }
  if (safe.length === 0) throw new Error("All your UTXOs carry inscriptions — add plain sats first");

  const paymentScriptHex = byteArrayToHex(addressToScriptPubKey(input.buyerPaymentAddress));
  const receiveScriptHex = byteArrayToHex(addressToScriptPubKey(input.buyerOrdinalsAddress));
  const funding: FundingUtxo[] = safe.map((u) => ({
    txid: u.txid,
    vout: u.vout,
    valueSats: Number(u.value),
    scriptPubKeyHex: paymentScriptHex,
  }));

  const rate = await feeRate();
  const built = buildBuyerPsbt({
    sellerPsbtBase64: offer.psbt_base64,
    inscriptionOutpoint: offer.outpoint,
    inscriptionValueSats,
    receiveScriptHex,
    changeScriptHex: paymentScriptHex,
    funding,
    feeRate: rate,
    tapInternalKeyHex: input.tapInternalKeyHex,
  });

  return {
    offerId: offer.id,
    bitmapHeight: offer.bitmap_height,
    outpoint: offer.outpoint,
    sellerAddress: offer.seller_address,
    psbtBase64: built.psbtBase64,
    signIndices: built.signIndices,
    priceSats: built.priceSats,
    feeSats: built.feeSats,
    feeRate: rate,
    changeSats: built.changeSats,
    inscriptionValueSats,
    fundingInputs: built.usedFunding.length,
  };
}

export type PurchaseSubmission = {
  offerId: string;
  broadcast: boolean;
  txid: string | null;
  message: string;
};

/**
 * Stores the buyer-signed PSBT on the offer and broadcasts it when the wallet
 * finalized every input. A PSBT that is signed but not finalized is kept so the
 * buyer can finish it in their own wallet.
 */
export async function submitPurchase(input: {
  offerId: string;
  psbtBase64: string;
  buyerAddress: string;
}): Promise<PurchaseSubmission> {
  const offer = await loadOffer(input.offerId);
  const clean = input.psbtBase64.replace(/\s+/g, "");
  const rawHex = extractRawTxHex(clean);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (rawHex === null) {
    const { error } = await supabaseAdmin
      .from("offers")
      .update({
        buyer_address: input.buyerAddress,
        buyer_psbt_base64: clean,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", offer.id);
    if (error) throw new Error(error.message);
    return {
      offerId: offer.id,
      broadcast: false,
      txid: null,
      message: "Signed PSBT stored — your wallet did not finalize every input, finish it in your wallet",
    };
  }

  const result = await postTx(rawHex);
  if ("error" in result) {
    await supabaseAdmin
      .from("offers")
      .update({
        buyer_address: input.buyerAddress,
        buyer_psbt_base64: clean,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", offer.id);
    throw new Error(`Broadcast rejected: ${result.error}`);
  }

  const { error } = await supabaseAdmin
    .from("offers")
    .update({
      buyer_address: input.buyerAddress,
      buyer_psbt_base64: clean,
      buyer_txid: result.txid,
      delivered_at: new Date().toISOString(),
      status: "spent",
    })
    .eq("id", offer.id);
  if (error) throw new Error(error.message);

  return {
    offerId: offer.id,
    broadcast: true,
    txid: result.txid,
    message: "Purchase broadcast to the network",
  };
}
