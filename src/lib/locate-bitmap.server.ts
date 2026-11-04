import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Authoritative "where does this bitmap live right now?" lookup.
 *
 * The wallet scan on /wallet only walks a capped set of outputs, so a holder
 * with many UTXOs can look like they do not hold a bitmap they clearly own.
 * This resolves the bitmap's inscription id from the registry and asks ord
 * where that inscription currently sits, then checks the holder address.
 */

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
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) return (await resp.json()) as T;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }
  return null;
}

const MEMPOOL = "https://mempool.space/api";

async function mempoolJson<T>(path: string, attempts = 2): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${MEMPOOL}${path}`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) return (await resp.json()) as T;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return null;
}

type OrdLocation = { outpoint: string; valueSats: number; ownerAddress: string | null };

/** Reads the live location from ord, trying both the HTML-API and recursive endpoints. */
async function ordLocation(inscriptionId: string): Promise<OrdLocation | null> {
  for (const path of [`/inscription/${inscriptionId}`, `/r/inscription/${inscriptionId}`]) {
    const meta = await ordJson<{
      address?: string | null;
      value?: number | null;
      satpoint?: string | null;
      output?: string | null;
    }>(path, 3);
    const point = meta?.satpoint ?? meta?.output ?? null;
    if (!point) continue;
    const [txid, voutRaw] = point.split(":");
    if (!txid || voutRaw === undefined) continue;
    return {
      outpoint: `${txid}:${Number(voutRaw)}`,
      valueSats: Number(meta?.value ?? 0),
      ownerAddress: meta?.address ?? null,
    };
  }
  return null;
}

/**
 * Chain-only fallback when the ordinals index is unreachable: the inscription
 * sits on sat offset 0 of its genesis output, so following the spend chain
 * (output 0 of each spending tx) lands on the current holding UTXO.
 */
async function chainLocation(inscriptionId: string): Promise<OrdLocation | null> {
  const genesisTxid = inscriptionId.replace(/i\d+$/, "");
  if (!/^[0-9a-f]{64}$/i.test(genesisTxid)) return null;

  let txid = genesisTxid;
  let vout = 0;
  for (let hop = 0; hop < 25; hop++) {
    const spend = await mempoolJson<{ spent?: boolean; txid?: string; vin?: number }>(
      `/tx/${txid}/outspend/${vout}`,
    );
    if (!spend) return null;
    if (!spend.spent || !spend.txid) {
      const tx = await mempoolJson<{
        vout?: Array<{ value?: number; scriptpubkey_address?: string }>;
      }>(`/tx/${txid}`);
      const out = tx?.vout?.[vout];
      if (!out) return null;
      return {
        outpoint: `${txid}:${vout}`,
        valueSats: Number(out.value ?? 0),
        ownerAddress: out.scriptpubkey_address ?? null,
      };
    }
    txid = spend.txid;
    vout = 0;
  }
  return null;
}


export type BitmapLocation = {
  bitmapHeight: number;
  inscriptionId: string;
  outpoint: string;
  valueSats: number;
  ownerAddress: string | null;
  /** true when ord reports the inscription sits at the given address */
  heldByAddress: boolean;
};

export type BitmapHolder = Omit<BitmapLocation, "heldByAddress">;

async function inscriptionIdFor(height: number): Promise<string | null> {
  const client = db();
  const idx = await client
    .from("bitmap_index")
    .select("inscription_id")
    .eq("block_height", height)
    .maybeSingle();
  if (idx.data?.inscription_id) return idx.data.inscription_id;

  const insc = await client
    .from("inscriptions")
    .select("id")
    .eq("bitmap_height", height)
    .eq("is_bitmap_claim", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return insc.data?.id ?? null;
}

/** Resolves the current on-chain UTXO and holder without requiring a wallet. */
export async function locateBitmapHolder(height: number): Promise<BitmapHolder> {
  const inscriptionId = await inscriptionIdFor(height);
  if (!inscriptionId) {
    throw new Error(`No indexed inscription for ${height}.bitmap yet`);
  }

  const located = (await ordLocation(inscriptionId)) ?? (await chainLocation(inscriptionId));
  if (!located) {
    throw new Error("Could not read the inscription location from the ordinals index");
  }

  const outpoint = located.outpoint;
  let valueSats = located.valueSats;
  let ownerAddress = located.ownerAddress;

  if (!valueSats || !ownerAddress) {
    const [txid, voutRaw] = outpoint.split(":");
    const tx = await mempoolJson<{
      vout?: Array<{ value?: number; scriptpubkey_address?: string }>;
    }>(`/tx/${txid}`);
    const out = tx?.vout?.[Number(voutRaw)];
    if (!valueSats) valueSats = Number(out?.value ?? 0);
    if (!ownerAddress) ownerAddress = out?.scriptpubkey_address ?? null;
  }
  if (!valueSats) {
    const output = await ordJson<{ value?: number }>(`/output/${outpoint}`, 2);
    valueSats = Number(output?.value ?? 0);
  }
  if (!valueSats) throw new Error("Could not read the inscription UTXO value");

  return { bitmapHeight: height, inscriptionId, outpoint, valueSats, ownerAddress };
}

export async function locateBitmap(input: {
  height: number;
  address: string;
}): Promise<BitmapLocation> {
  const holder = await locateBitmapHolder(input.height);
  return {
    ...holder,
    heldByAddress:
      typeof holder.ownerAddress === "string" &&
      holder.ownerAddress.toLowerCase() === input.address.trim().toLowerCase(),
  };
}
