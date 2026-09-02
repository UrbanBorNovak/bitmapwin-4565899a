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
const UA = "bitmap-marketplace/1.0";

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

export type BitmapLocation = {
  bitmapHeight: number;
  inscriptionId: string;
  outpoint: string;
  valueSats: number;
  ownerAddress: string | null;
  /** true when ord reports the inscription sits at the given address */
  heldByAddress: boolean;
};

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

export async function locateBitmap(input: {
  height: number;
  address: string;
}): Promise<BitmapLocation> {
  const inscriptionId = await inscriptionIdFor(input.height);
  if (!inscriptionId) {
    throw new Error(`No indexed inscription for ${input.height}.bitmap yet`);
  }

  const meta = await ordJson<{
    address?: string | null;
    value?: number | null;
    satpoint?: string | null;
  }>(`/inscription/${inscriptionId}`);
  if (!meta?.satpoint) {
    throw new Error("Could not read the inscription location from the ordinals index");
  }

  const [txid, voutRaw] = meta.satpoint.split(":");
  if (!txid || voutRaw === undefined) throw new Error("Malformed inscription satpoint");
  const outpoint = `${txid}:${Number(voutRaw)}`;

  let valueSats = Number(meta.value ?? 0);
  if (!valueSats) {
    const output = await ordJson<{ value?: number }>(`/output/${outpoint}`, 2);
    valueSats = Number(output?.value ?? 0);
  }
  if (!valueSats) throw new Error("Could not read the inscription UTXO value");

  const ownerAddress = meta.address ?? null;
  return {
    bitmapHeight: input.height,
    inscriptionId,
    outpoint,
    valueSats,
    ownerAddress,
    heldByAddress:
      typeof ownerAddress === "string" &&
      ownerAddress.toLowerCase() === input.address.trim().toLowerCase(),
  };
}
