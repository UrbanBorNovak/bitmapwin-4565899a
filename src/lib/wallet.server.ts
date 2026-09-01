import type { WalletSnapshot, WalletUtxo } from "@/lib/wallet";

const ORD = "https://ordinals.com";
const UA = "bitmap-marketplace/1.0";
const ESPLORA_HOSTS = [
  "https://mempool.space/api",
  "https://blockstream.info/api",
  "https://mempool.emzy.de/api",
  "https://bitcoin.bitaroo.net/api",
];

let lastFailure = "";

async function ordJson<T>(path: string, attempts = 5): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      if (resp.ok) return (await resp.json()) as T;
      lastFailure = `HTTP ${resp.status}`;
      if (resp.status === 429 || resp.status === 406 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      return null;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "network error";
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

type OrdAddressOutput = {
  address: string | null;
  confirmations?: number;
  inscriptions?: string[] | null;
  outpoint: string;
  runes?: unknown;
  spent?: boolean;
  value: number;
};

/** Inscription body -> the bitmap number it claims, when it is a claim. */
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

/** ord's inscription metadata view — the content type, when the index knows it. */
async function contentTypeOf(inscriptionId: string): Promise<string | null> {
  const meta = await ordJson<{ content_type?: string | null }>(`/inscription/${inscriptionId}`, 1);
  return typeof meta?.content_type === "string" ? meta.content_type : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]!);
      }
    }),
  );
  return results;
}

/**
 * Reads a wallet straight off the chain: every unspent output the ord index
 * knows for the address, which inscriptions sit in each one, and which of
 * those inscriptions are bitmap claims.
 */
type MempoolUtxo = {
  txid: string;
  vout: number;
  value: number;
  status?: { confirmed?: boolean; block_height?: number };
};

/**
 * Fallback source when ord's JSON API is unavailable (it intermittently answers
 * 406 "JSON API disabled"): esplora gives the unspent outputs, and each
 * one's inscriptions are then enriched best-effort from ord.
 */
async function fetchOutputsViaEsplora(address: string): Promise<OrdAddressOutput[] | null> {
  for (const host of ESPLORA_HOSTS) {
    try {
      const utxoResp = await fetch(`${host}/address/${address}/utxo`, {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      if (!utxoResp.ok) {
        lastFailure = `esplora HTTP ${utxoResp.status}`;
        continue;
      }
      const utxos = (await utxoResp.json()) as MempoolUtxo[];
      let tip = 0;
      try {
        const tipResp = await fetch(`${host}/blocks/tip/height`, {
          headers: { "user-agent": UA },
        });
        if (tipResp.ok) tip = Number(await tipResp.text());
      } catch {
        tip = 0;
      }
      return utxos.map((utxo) => {
        const height = utxo.status?.block_height ?? 0;
        return {
          address,
          confirmations: tip && height ? tip - height + 1 : 0,
          inscriptions: null,
          outpoint: `${utxo.txid}:${utxo.vout}`,
          spent: false,
          value: Number(utxo.value ?? 0),
        };
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "network error";
    }
  }
  return null;
}

/**
 * ord's per-output view, used to learn which inscriptions an outpoint holds.
 * Retries each output individually so a single rate-limit or transient failure
 * does not blank every other output's inscriptions.
 */
async function inscriptionsOfOutpoint(
  outpoint: string,
  state: { ordDown: boolean },
): Promise<string[]> {
  if (state.ordDown) return [];
  const output = await ordJson<{ inscriptions?: string[] | null }>(`/output/${outpoint}`, 3);
  if (output === null) {
    // Keep trying other outputs; only mark ord as down after repeated failures.
    return [];
  }
  return (output.inscriptions ?? []).filter((id): id is string => typeof id === "string");
}

export async function fetchWallet(address: string, maxOutputs = 60): Promise<WalletSnapshot> {
  const ordState = { ordDown: false };
  let needsInscriptionLookup = false;
  let outputs = await ordJson<OrdAddressOutput[]>(`/outputs/${address}`);
  if (outputs === null) {
    outputs = await fetchOutputsViaEsplora(address);
    needsInscriptionLookup = true;
  }
  if (outputs === null) {
    throw new Error(
      `Could not read unspent outputs for ${address} (${lastFailure || "no response"}) — try again shortly`,
    );
  }


  const unspent = outputs.filter((output) => output.spent !== true);
  const scanned = unspent.slice(0, maxOutputs);

  const utxos: WalletUtxo[] = await mapWithConcurrency(scanned, 4, async (output) => {
    const inscriptionIds = needsInscriptionLookup
      ? await inscriptionsOfOutpoint(output.outpoint, ordState)
      : (output.inscriptions ?? []).filter((id): id is string => typeof id === "string");
    const inscriptions = await mapWithConcurrency(inscriptionIds.slice(0, 8), 3, async (id) => ({
      id,
      bitmapHeight: await bitmapHeightOf(id),
      contentType: await contentTypeOf(id),
    }));
    return {
      outpoint: output.outpoint,
      valueSats: Number(output.value ?? 0),
      confirmations: Number(output.confirmations ?? 0),
      inscriptions,
    };
  });

  utxos.sort((a, b) => b.inscriptions.length - a.inscriptions.length || b.valueSats - a.valueSats);

  return {
    address,
    utxoCount: unspent.length,
    scannedOutputs: scanned.length,
    balanceSats: unspent.reduce((sum, output) => sum + Number(output.value ?? 0), 0),
    utxos,
  };
}

const ADDRESS_RE = /^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;

export function isBitcoinAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

/**
 * Hands a stored offer PSBT to a specific buyer address. The offer stays in the
 * public book; the buyer additionally sees it in their wallet inbox and can
 * take the raw PSBT into their own wallet to complete and broadcast the sale.
 */
export async function deliverOffer(input: {
  offerId: string;
  buyerAddress: string;
  note?: string | undefined;
}): Promise<{ offerId: string; buyerAddress: string; deliveredAt: string }> {
  const buyerAddress = input.buyerAddress.trim();
  if (!isBitcoinAddress(buyerAddress)) throw new Error("Not a valid Bitcoin address");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await supabaseAdmin
    .from("offers")
    .select("id, status, seller_address")
    .eq("id", input.offerId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) throw new Error("Offer not found");
  if (existing.data.status !== "open") throw new Error("Offer is no longer open");
  if (existing.data.seller_address === buyerAddress) {
    throw new Error("Buyer address is the seller's own address");
  }

  const deliveredAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("offers")
    .update({
      buyer_address: buyerAddress,
      delivered_at: deliveredAt,
      delivery_note: input.note?.slice(0, 200) ?? null,
    })
    .eq("id", input.offerId);
  if (error) throw new Error(error.message);

  return { offerId: input.offerId, buyerAddress, deliveredAt };
}
