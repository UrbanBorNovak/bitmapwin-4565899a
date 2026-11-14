/**
 * District Fiefdom — who holds the valid on-chain parcels of a BITMAP.
 * Reads the real child-inscription scan (first claim per tx index wins) and
 * the live holder address of each valid parcel. Never trusts the browser.
 */
const cache = new Map<number, { expires: number; value: ParcelHolders }>();
const TTL = 10 * 60_000;

export type ParcelHolders = {
  height: number;
  /** A chain read failed: holders or parcels may be missing. Never cached. */
  incomplete: boolean;
  /** More children exist than one scan reads: parcels past the cut-off are not listed. */
  truncated: boolean;
  total: number;
  byAddress: Map<string, number>;
  parcels: { index: number; inscriptionId: string; ownerAddress: string | null }[];
};

async function districtInscription(height: number): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("bitmap_index")
    .select("inscription_id")
    .eq("block_height", height)
    .eq("is_valid", true)
    .maybeSingle();
  if (error) throw new Error(`bitmap_index lookup failed: ${error.message}`);
  return data?.inscription_id ?? null;
}

export async function parcelHoldersFor(height: number, opts?: { fresh?: boolean }): Promise<ParcelHolders | null> {
  const hit = cache.get(height);
  if (!opts?.fresh && hit && hit.expires > Date.now()) return hit.value;
  const district = await districtInscription(height);
  if (!district) return null;
  const { scanParcels } = await import("@/lib/parcels.server");
  const scan = await scanParcels(height, district);
  const valid = scan.parcels.filter((p) => p.valid);
  const byAddress = new Map<string, number>();
  for (const p of valid) if (p.ownerAddress) byAddress.set(p.ownerAddress, (byAddress.get(p.ownerAddress) ?? 0) + 1);
  const value: ParcelHolders = {
    height,
    incomplete: Boolean(scan.incomplete),
    truncated: scan.truncated,
    // Only parcels with a resolved live holder share the pool.
    total: [...byAddress.values()].reduce((a, b) => a + b, 0),
    byAddress,
    parcels: valid.map((p) => ({ index: p.index, inscriptionId: p.inscriptionId, ownerAddress: p.ownerAddress })),
  };
  // Never keep a partial scan: the next caller retries the chain instead of reusing gaps.
  if (!value.incomplete) cache.set(height, { expires: Date.now() + TTL, value });
  return value;
}

/** Valid parcels held by `address`, checked against each district's live scan. */
export async function verifyHeldParcels(address: string, claims: { id: string; index: number; height: number }[]) {
  const heights = [...new Set(claims.map((c) => c.height))].slice(0, 24);
  const out: { inscriptionId: string; index: number; height: number; valid: boolean; holdersTotal: number; sharePercent: number }[] = [];
  for (const h of heights) {
    const holders = await parcelHoldersFor(h).catch(() => null);
    for (const c of claims.filter((x) => x.height === h)) {
      const p = holders?.parcels.find((x) => x.inscriptionId === c.id);
      const valid = !!p && p.ownerAddress === address;
      const mine = holders?.byAddress.get(address) ?? 0;
      out.push({
        inscriptionId: c.id,
        index: c.index,
        height: h,
        valid,
        holdersTotal: holders?.total ?? 0,
        sharePercent: holders && holders.total > 0 ? (mine / holders.total) * 100 : 0,
      });
    }
  }
  return out;
}
