import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { decodePsbt, scriptToAddress, type DecodedPsbt } from "@/lib/psbt";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function db() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function ordJson<T>(path: string, attempts = 3): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (resp.ok) return (await resp.json()) as T;
      if (resp.status === 429 || resp.status === 406 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

type OrdOutput = {
  address: string | null;
  inscriptions: string[];
  outpoint: string;
  spent: boolean;
  value: number;
};

function htmlText(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<dt>${escaped}<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>`, "i").exec(html);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}

/**
 * ordinals.com occasionally disables or throttles its JSON API while its HTML
 * explorer remains available. Both representations come from the same ord
 * index, so parsing the explorer page preserves the chain validation instead
 * of trusting inscription details supplied by the browser.
 */
async function fetchOutputHtml(outpoint: string, attempts = 2): Promise<OrdOutput | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}/output/${outpoint}`, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) {
        if (resp.status === 429 || resp.status === 406 || resp.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
          continue;
        }
        return null;
      }

      const html = await resp.text();
      const inscriptions = [
        ...html.matchAll(/href=["']?\/inscription\/([0-9a-f]{64}i\d+)/gi),
      ]
        .flatMap((match) => (match[1] ? [match[1]] : []))
        .filter((id, index, all) => all.indexOf(id) === index);
      const addressMatch = /href=["']?\/address\/([^"'\s>]+)/i.exec(html);
      const value = Number(htmlText(html, "value") ?? 0);
      const spent = htmlText(html, "spent") === "true";

      if (!html.includes("<dt>outpoint</dt>") && !html.includes("<dt>value</dt>")) return null;
      return {
        address: addressMatch?.[1] ?? null,
        inscriptions,
        outpoint,
        spent,
        value: Number.isFinite(value) ? value : 0,
      };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  return null;
}

export async function fetchOutput(outpoint: string): Promise<OrdOutput | null> {
  const json = await ordJson<OrdOutput>(`/output/${outpoint}`, 2);
  if (json) {
    return {
      ...json,
      inscriptions: Array.isArray(json.inscriptions) ? json.inscriptions : [],
      spent: json.spent === true,
    };
  }
  return fetchOutputHtml(outpoint);
}

/** Reads the inscription body and returns the bitmap number it claims. */
async function bitmapHeightOf(inscriptionId: string): Promise<number | null> {
  try {
    const resp = await fetch(`${ORD}/content/${inscriptionId}`, {
      headers: { "user-agent": UA, accept: "*/*" },
    });
    if (!resp.ok) return null;
    const body = (await resp.text()).trim();
    const match = /^(\d+)\.bitmap$/.exec(body);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type OfferValidation = {
  psbtBase64: string;
  outpoint: string;
  inscriptionId: string | null;
  bitmapHeight: number | null;
  sellerAddress: string | null;
  priceSats: number;
  status: "open" | "spent";
  decoded: DecodedPsbt;
};

/**
 * Validates a base64 PSBT as a bitmap sale offer against the live UTXO set:
 * one input must hold an inscription whose content is `<height>.bitmap`, and
 * the asking price is what the transaction pays back to the holder.
 */
export async function validateOffer(psbtBase64: string): Promise<OfferValidation> {
  const decoded = decodePsbt(psbtBase64);
  if (decoded.inputs.length === 0) throw new Error("PSBT has no inputs");
  if (decoded.outputs.length === 0) throw new Error("PSBT has no outputs");

  const outputs = await Promise.all(
    decoded.inputs.slice(0, 6).map((input) => fetchOutput(input.outpoint)),
  );
  if (outputs.every((output) => output === null)) {
    throw new Error("The live ord index is unavailable in both JSON and explorer modes — try again shortly");
  }
  const index = outputs.findIndex((output) => (output?.inscriptions.length ?? 0) > 0);
  if (index === -1) {
    throw new Error("No inscription found in any input UTXO — this PSBT does not sell an ordinal");
  }

  const ordOutput = outputs[index]!;
  const input = decoded.inputs[index]!;
  const inscriptionId = ordOutput.inscriptions[0] ?? null;

  // Listing gate 1 — only the key holder can list: the selling input must
  // already carry a signature, which nobody but the wallet holding the
  // inscription can produce.
  if (!input.signed) {
    throw new Error(
      "PSBT IS NOT SIGNED — ONLY THE WALLET HOLDING THIS BITMAP CAN LIST IT",
    );
  }

  // Listing gate 1b — the seller's signature must be SIGHASH_SINGLE|ANYONECANPAY
  // (0x83) and nothing else. SINGLE ties the inscription input to the seller's
  // price output; NONE (0x82) would let anyone take the BITMAP for nothing, and
  // ALL (0x00/0x01) could never be completed by a buyer.
  if (input.sighashes.length === 0 || input.sighashes.some((t) => t !== 0x83)) {
    throw new Error(
      "UNSAFE OR UNUSABLE SIGNATURE — THE LISTING MUST BE SIGNED SIGHASH_SINGLE|ANYONECANPAY. RELIST AND APPROVE THE SIGNATURE YOUR WALLET REQUESTS",
    );
  }
  // Listing gate 1c — exactly one inscription input paired with one price
  // output at the same index, so the signed output is the seller's payout.
  if (decoded.inputs.length !== 1 || decoded.outputs.length !== 1 || index !== 0) {
    throw new Error("UNSUPPORTED OFFER SHAPE — EXPECTED ONE INSCRIPTION INPUT AND ONE PRICE OUTPUT");
  }

  // Listing gate 2 — the inscription must still be sitting in an unspent
  // output, i.e. the seller really holds it right now.
  if (ordOutput.spent) {
    throw new Error("THIS UTXO IS ALREADY SPENT — THE INSCRIPTION HAS MOVED");
  }

  // Any ordinal can be sold (shop assets, images, bitmaps). A `<height>.bitmap`
  // body just tags the offer with its bitmap height for registry views.
  const bitmapHeight = inscriptionId ? await bitmapHeightOf(inscriptionId) : null;

  // Listing gate 3 — a bitmap listing must be the VALID claim for that height.
  // Losing duplicate claims for the same block cannot be listed as land.
  if (bitmapHeight !== null && inscriptionId) {
    const { data: indexRow } = await db()
      .from("bitmap_index")
      .select("inscription_id, is_valid")
      .eq("block_height", bitmapHeight)
      .maybeSingle();
    if (indexRow?.inscription_id && indexRow.inscription_id !== inscriptionId) {
      throw new Error(
        `NOT THE VALID ${bitmapHeight}.BITMAP — THAT BLOCK IS HELD BY AN EARLIER INSCRIPTION`,
      );
    }
    if (indexRow && indexRow.is_valid === false) {
      throw new Error(`${bitmapHeight}.BITMAP IS NOT A VALID CLAIM`);
    }
  }



  const sellerAddress =
    ordOutput.address ?? scriptToAddress(input.witnessScriptPubKeyHex ?? "") ?? null;

  // Standard ord sale shape: the transaction pays the holder. Fall back to the
  // total paid out when the seller's address can't be resolved.
  const toSeller = sellerAddress
    ? decoded.outputs
        .filter((output) => output.address === sellerAddress)
        .reduce((sum, output) => sum + output.valueSats, 0)
    : 0;
  // The signed output must pay the address that holds the inscription.
  if (sellerAddress && decoded.outputs[0]?.address !== sellerAddress) {
    throw new Error("THE SIGNED PRICE OUTPUT DOES NOT PAY THE WALLET HOLDING THIS BITMAP");
  }
  const priceSats = toSeller > 0 ? toSeller : decoded.totalOutSats;

  return {
    psbtBase64,
    outpoint: input.outpoint,
    inscriptionId,
    bitmapHeight,
    sellerAddress,
    priceSats,
    status: ordOutput.spent ? "spent" : "open",
    decoded,
  };
}

export type StoredOffer = {
  id: string;
  bitmapHeight: number | null;
  inscriptionId: string | null;
  outpoint: string;
  sellerAddress: string | null;
  priceSats: number;
  status: string;
  duplicate: boolean;
};

/** Validates then stores an offer. Re-submitting the same PSBT is idempotent. */
export async function submitOffer(psbtBase64: string): Promise<StoredOffer> {
  const clean = psbtBase64.replace(/\s+/g, "");
  const validation = await validateOffer(clean);
  const hash = await sha256Hex(clean);
  const client = db();

  const existing = await client
    .from("offers")
    .select("id, bitmap_height, inscription_id, outpoint, seller_address, price_sats, status")
    .eq("psbt_hash", hash)
    .maybeSingle();

  if (existing.data) {
    const row = existing.data;
    return {
      id: row.id,
      bitmapHeight: row.bitmap_height,
      inscriptionId: row.inscription_id,
      outpoint: row.outpoint,
      sellerAddress: row.seller_address,
      priceSats: Number(row.price_sats ?? 0),
      status: row.status,
      duplicate: true,
    };
  }

  // Listings are written with the privileged client only AFTER validateOffer
  // proved the seller signed the input and still holds the inscription. The
  // table itself denies direct inserts, so this is the only way in.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("offers")
    .insert({
      psbt_base64: clean,
      psbt_hash: hash,
      bitmap_height: validation.bitmapHeight,
      inscription_id: validation.inscriptionId,
      outpoint: validation.outpoint,
      seller_address: validation.sellerAddress,
      price_sats: validation.priceSats,
      status: validation.status,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    bitmapHeight: validation.bitmapHeight,
    inscriptionId: validation.inscriptionId,
    outpoint: validation.outpoint,
    sellerAddress: validation.sellerAddress,
    priceSats: validation.priceSats,
    status: validation.status,
    duplicate: false,
  };
}

/** Every stored offer as raw base64 PSBTs, matching `GET /offers` on ord. */
export async function listOfferPsbts(limit = 200): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("psbt_base64")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.psbt_base64);
}

/** Re-checks open offers against the UTXO set and marks spent ones. */
export async function refreshOfferStatuses(limit = 40): Promise<{ checked: number; spent: number }> {
  const client = db();
  const { data, error } = await client
    .from("offers")
    .select("id, outpoint")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  let spent = 0;
  for (const row of rows) {
    const output = await fetchOutput(row.outpoint);
    if (output?.spent) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("offers").update({ status: "spent" }).eq("id", row.id);
      spent += 1;
    }
  }
  return { checked: rows.length, spent };
}
