import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import {
  buildBuyerPsbt,
  SELLER_INDEX,
  satDestination,
  byteArrayToHex,
  extractRawTxHex,
  finalizeSignedPsbt,
  inputSignatureReport,
  psbtOutputs,
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

export async function broadcastRawTransaction(
  rawHex: string,
): Promise<{ txid: string } | { error: string }> {
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
  "id, psbt_base64, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status, reserved_by, reserved_until";

async function loadOffer(offerId: string) {
  // The seller's signed PSBT is not readable with the publishable key — the
  // buyer half is assembled server-side with privileged access instead.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("offers").select(OFFER_COLUMNS).eq("id", offerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Offer not found");
  return data;
}

/**
 * Storefront sales pay 1% (min 546 sats) to the address holding the BITMAP the
 * storefront belongs to, read live from the chain. Skipped when the holder is
 * the seller or cannot be resolved.
 */
async function storefrontTribute(offerId: string, seller: string | null, priceSats: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bitmap_storefront_listings")
    .select("storefront_height")
    .eq("offer_id", offerId)
    .maybeSingle();
  if (!data) return undefined;
  try {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    const holder = await locateBitmapHolder(data.storefront_height);
    if (!holder.ownerAddress || holder.ownerAddress === seller) return undefined;
    return {
      scriptHex: byteArrayToHex(addressToScriptPubKey(holder.ownerAddress)),
      sats: Math.max(546, Math.ceil(priceSats / 100)),
    };
  } catch {
    return undefined;
  }
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
  /** marketplace commission paid to the platform address */
  marketFeeSats: number;
  /** 1% tribute paid to the BITMAP holder for sales made in its storefront */
  landTributeSats: number;
  feeRate: number;
  changeSats: number;
  inscriptionValueSats: number;
  fundingInputs: number;
  /** ISO time this buyer's exclusive checkout hold expires */
  reservedUntil: string | null;
};

/** Places (or renews) this buyer's exclusive 90-second checkout hold. */
async function reserveOffer(offerId: string, buyer: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("reserve_offer", {
    _offer_id: offerId,
    _buyer: buyer,
    _seconds: 90,
  });
  if (error) throw new Error("Could not reserve this listing — try again");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) throw new Error(row?.reason ?? "Listing is not available");
  return row.reserved_until ?? null;
}

export async function releaseReservation(offerId: string, buyer: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("release_offer_reservation", {
    _offer_id: offerId,
    _buyer: buyer,
  });
  return data === true;
}

/** Builds the buyer half of the sale PSBT against the buyer's live UTXO set. */
export async function buildPurchase(input: {
  offerId: string;
  buyerPaymentAddress: string;
  buyerOrdinalsAddress: string;
  tapInternalKeyHex?: string | undefined;
  paymentPublicKeyHex?: string | string[] | undefined;
}): Promise<PurchaseQuote> {
  const offer = await loadOffer(input.offerId);
  if (offer.status !== "open") throw new Error("This offer is no longer open");
  if (offer.seller_address && offer.seller_address === input.buyerOrdinalsAddress) {
    throw new Error("This is your own listing");
  }

  // Snipe protection: claim an exclusive checkout window before anything else.
  const reservedUntil = await reserveOffer(offer.id, input.buyerOrdinalsAddress);

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
  const landTribute = await storefrontTribute(offer.id, offer.seller_address, Number(offer.price_sats));
  const built = buildBuyerPsbt({
    landTribute,
    sellerPsbtBase64: offer.psbt_base64,
    inscriptionOutpoint: offer.outpoint,
    inscriptionValueSats,
    receiveScriptHex,
    changeScriptHex: paymentScriptHex,
    funding,
    feeRate: rate,
    tapInternalKeyHex: input.tapInternalKeyHex,
    paymentPublicKeyHex: input.paymentPublicKeyHex,
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
    marketFeeSats: built.marketFeeSats,
    landTributeSats: built.landTributeSats,
    feeRate: rate,
    changeSats: built.changeSats,
    inscriptionValueSats,
    fundingInputs: built.usedFunding.length,
    reservedUntil,
  };
}

export type PurchaseSubmission = {
  offerId: string;
  broadcast: boolean;
  txid: string | null;
  message: string;
  route?: "private_direct" | "public_fallback";
};

/**
 * Completes the sale from the buyer's single signature: the buyer's funding
 * inputs arrive signed, the seller's stored SIGHASH_SINGLE|ANYONECANPAY
 * signature is finalized server-side, the payout outputs are verified, and the
 * transaction is broadcast. No second signature from either party is needed.
 */
export async function submitPurchase(input: {
  offerId: string;
  psbtBase64: string;
  buyerAddress: string;
}): Promise<PurchaseSubmission> {
  const offer = await loadOffer(input.offerId);
  if (offer.status !== "open") throw new Error("This offer is no longer open");
  const holder = (offer as { reserved_by?: string | null }).reserved_by ?? null;
  const until = (offer as { reserved_until?: string | null }).reserved_until ?? null;
  const live = until !== null && new Date(until).getTime() > Date.now();
  if (live && holder !== input.buyerAddress) {
    throw new Error("Listing is reserved by another buyer");
  }
  if (!live || holder !== input.buyerAddress) {
    throw new Error("Your checkout hold expired — press Buy again to start a new one");
  }
  const clean = input.psbtBase64.replace(/\s+/g, "");
  const finalized = finalizeSignedPsbt(clean);

  // The buyer must have signed their own inputs; the seller half is finalized
  // above from the signature captured when the listing was created.
  const report = inputSignatureReport(finalized);
  const unsigned = report.filter((r) => !r.isFinal);
  if (unsigned.length > 0) {
    const missingBuyer = unsigned.filter((r) => r.index !== SELLER_INDEX && !r.hasSignature);
    if (missingBuyer.length > 0) {
      throw new Error(
        `Your wallet did not sign funding input(s) ${missingBuyer
          .map((r) => r.index)
          .join(", ")} — approve every requested input and retry`,
      );
    }
    throw new Error(
      "The seller's offer signature is missing or unsupported — ask the seller to relist this bitmap",
    );
  }

  // Guarantee the money actually moves: output 2 pays the seller the asking
  // price, and following the sats the BITMAP lands in output 1 at the buyer.
  const outs = psbtOutputs(finalized);
  if (satDestination(finalized, SELLER_INDEX) !== 1) {
    throw new Error("Refusing to broadcast: the BITMAP would not reach the buyer's output");
  }
  const expectedSeller = offer.seller_address
    ? byteArrayToHex(addressToScriptPubKey(offer.seller_address))
    : null;
  const price = Number(offer.price_sats ?? 0);
  if (expectedSeller && (outs[SELLER_INDEX]?.scriptHex !== expectedSeller || Number(outs[SELLER_INDEX]?.valueSats) < price)) {
    throw new Error("Refusing to broadcast: the seller payout output was altered");
  }
  const expectedBuyer = byteArrayToHex(addressToScriptPubKey(input.buyerAddress));
  if (outs[1]?.scriptHex !== expectedBuyer) {
    throw new Error("Refusing to broadcast: the inscription is not delivered to your address");
  }

  const rawHex = extractRawTxHex(finalized);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (rawHex === null) {
    const { error } = await supabaseAdmin
      .from("offers")
      .update({
        buyer_address: input.buyerAddress,
        buyer_psbt_base64: finalized,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", offer.id);
    if (error) throw new Error(error.message);
    return {
      offerId: offer.id,
      broadcast: false,
      txid: null,
      message: "Signed PSBT stored — it could not be assembled into a broadcastable transaction",
    };
  }


  const { relayTransaction } = await import("@/lib/mempool-relay.server");
  const result = await relayTransaction(rawHex);
  if ("error" in result) {
    await supabaseAdmin
      .from("offers")
      .update({
        buyer_address: input.buyerAddress,
        buyer_psbt_base64: finalized,
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
      reserved_by: null,
      reserved_until: null,
    })
    .eq("id", offer.id);
  if (error) throw new Error(error.message);

  // The transfer is live on the network: close the accepted bid that funded it,
  // record the sale as a trade, and log the activity so every surface updates.
  const { markBidSettled } = await import("@/lib/bids.server");
  await markBidSettled(offer.id);

  if (offer.bitmap_height !== null) {
    await supabaseAdmin.from("trades").upsert(
      {
        txid: result.txid,
        bitmap_height: offer.bitmap_height,
        inscription_id: offer.inscription_id,
        seller_address: offer.seller_address,
        buyer_address: input.buyerAddress,
        price_sats: Number(offer.price_sats ?? 0),
        hop: 0,
      },
      { onConflict: "txid" },
    );
  }

  await supabaseAdmin.from("activity").insert({
    type: "sale_broadcast",
    wallet_address: input.buyerAddress,
    metadata: {
      offer_id: offer.id,
      txid: result.txid,
      bitmap_height: offer.bitmap_height,
      price_sats: Number(offer.price_sats ?? 0),
      seller_address: offer.seller_address,
      relay_route: result.route,
      relay: result.relay,
    },
  });

  return {
    offerId: offer.id,
    broadcast: true,
    txid: result.txid,
    route: result.route,
    message:
      result.route === "private_direct"
        ? "Purchase sent through a private relay"
        : "Purchase broadcast via public mempool fallback",
  };
}
