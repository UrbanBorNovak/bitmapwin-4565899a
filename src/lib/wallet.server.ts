import type { WalletSnapshot, WalletUtxo } from "@/lib/wallet";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
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
const parcelClaims = new Map<string, { index: number; height: number }>();
/** Parcel claim `{index}.{height}.bitmap` seen during the last content read, if any. */
export function parcelClaimOf(inscriptionId: string) {
  return parcelClaims.get(inscriptionId) ?? null;
}

async function bitmapHeightOf(inscriptionId: string): Promise<number | null> {
  try {
    const resp = await fetch(`${ORD}/content/${inscriptionId}`, {
      headers: { "user-agent": UA, accept: "*/*" },
    });
    if (!resp.ok) return null;
    const body = (await resp.text()).trim();
    const parcel = /^(\d+)\.(\d+)\.bitmap$/.exec(body);
    if (parcel) parcelClaims.set(inscriptionId, { index: Number(parcel[1]), height: Number(parcel[2]) });
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
  const html = await ordHtml(`/output/${outpoint}`);
  if (html === null) return [];
  return idsInHtml(html);
}

const ID_RE = /\/inscription\/([0-9a-f]{64}i\d+)/g;

function idsInHtml(html: string): string[] {
  return [...new Set([...html.matchAll(ID_RE)].map((m) => m[1]!))];
}

/** ord's HTML views stay up when its JSON API is disabled. */
async function ordHtml(path: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": "Mozilla/5.0 (bitmapwin)", accept: "text/html" },
      });
      if (resp.ok) return await resp.text();
      lastFailure = `HTTP ${resp.status}`;
      if (resp.status === 404) return null;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "network error";
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

type RecursiveMeta = { output?: string; value?: number; content_type?: string | null };

async function recursiveMeta(id: string): Promise<RecursiveMeta | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await fetch(`${ORD}/r/inscription/${id}`, {
        headers: { "user-agent": "Mozilla/5.0 (bitmapwin)" },
      });
      if (resp.ok) return (await resp.json()) as RecursiveMeta;
      if (resp.status === 404) return null;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return null;
}

/** Bulk inscription id -> bitmap height from the local index. */
async function indexedHeights(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || ids.length === 0) return out;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data } = await client
      .from("bitmap_index")
      .select("block_height, inscription_id")
      .in("inscription_id", chunk);
    for (const row of (data ?? []) as Array<{ block_height: number; inscription_id: string }>) {
      out.set(row.inscription_id, Number(row.block_height));
    }
  }
  return out;
}

/**
 * Full holdings from ord's address page: every inscription the address holds,
 * in one request. Bitmaps are found via the index (plus a capped content check
 * for unindexed ones) and located to their live outpoint.
 */
async function fetchWalletViaAddressPage(address: string): Promise<WalletSnapshot | null> {
  const html = await ordHtml(`/address/${address}`);
  if (html === null) return null;
  const balanceMatch = /<dt>sat balance<\/dt>\s*<dd>(\d+)<\/dd>/.exec(html);
  const [head, outputsSection = ""] = html.split("<dt>outputs</dt>");
  const outpoints = [...new Set([...outputsSection.matchAll(/\/output\/([0-9a-f]{64}:\d+)/g)].map((m) => m[1]!))];
  const ids = idsInHtml(head ?? html);

  const heights = await indexedHeights(ids);
  const unindexed = ids.filter((id) => !heights.has(id)).slice(0, 80);
  await mapWithConcurrency(unindexed, 6, async (id) => {
    const h = await bitmapHeightOf(id);
    if (h !== null) heights.set(id, h);
  });

  const others = ids.filter((id) => !heights.has(id)).slice(0, 40);
  const toLocate = [...ids.filter((id) => heights.has(id)), ...others];
  const byOutpoint = new Map<string, WalletUtxo>();
  await mapWithConcurrency(toLocate, 6, async (id) => {
    const meta = await recursiveMeta(id);
    if (!meta?.output) return;
    const utxo: WalletUtxo = byOutpoint.get(meta.output) ?? {
      outpoint: meta.output,
      valueSats: Number(meta.value ?? 0),
      confirmations: 1,
      inscriptions: [],
    };
    utxo.inscriptions.push({
      id,
      bitmapHeight: heights.get(id) ?? null,
      contentType: meta.content_type ?? null,
      parcel: parcelClaimOf(id),
    });
    byOutpoint.set(meta.output, utxo);
  });

  const utxos = [...byOutpoint.values()];
  utxos.sort((a, b) => b.inscriptions.length - a.inscriptions.length || b.valueSats - a.valueSats);
  return {
    address,
    utxoCount: outpoints.length,
    scannedOutputs: outpoints.length,
    balanceSats: balanceMatch ? Number(balanceMatch[1]) : utxos.reduce((s, u) => s + u.valueSats, 0),
    utxos,
  };
}

export async function fetchWallet(address: string, maxOutputs = 60): Promise<WalletSnapshot> {
  try {
    const full = await fetchWalletViaAddressPage(address);
    if (full) return full;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : "address page failed";
  }
  const ordState = { ordDown: false };
  let needsInscriptionLookup = false;
  let outputs = await ordJson<OrdAddressOutput[]>(`/outputs/${address}`, 1);
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

/** Reads the seller address of an offer so callers can prove they own it. */
export async function offerSeller(offerId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("seller_address")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.seller_address) throw new Error("Offer not found");
  return data.seller_address;
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
