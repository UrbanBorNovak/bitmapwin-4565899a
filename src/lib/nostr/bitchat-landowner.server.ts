// Live custody lookups for BW-ROOMS-1 holder badges. Stores nothing.
const MAX_PARCEL_CHECKS = 12;

/** Address holding the canonical BITMAP inscription right now, or null. */
export async function bitmapHolderNow(height: number): Promise<string | null> {
  const { liveBitmapFn } = await import("@/lib/bw-matter.functions");
  const d = await liveBitmapFn({ data: { height } });
  if (!d.inscriptionId) return null;
  const { ordInscription } = await import("@/lib/ord-fallback.server");
  return (await ordInscription(d.inscriptionId))?.address ?? null;
}

/** Valid parcels of `height` the scan attributes to `address` (cached up to 10 min, may be stale). */
export async function scannedParcelsOf(height: number, address: string) {
  const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
  const holders = await parcelHoldersFor(height);
  return (holders?.parcels ?? []).filter((p) => p.ownerAddress === address).slice(0, MAX_PARCEL_CHECKS);
}

/** Parcel indexes `address` holds right now: each candidate is re-read live from ord. */
export async function liveParcelsHeldBy(height: number, address: string): Promise<number[]> {
  const candidates = await scannedParcelsOf(height, address);
  if (!candidates.length) return [];
  const { ordInscription } = await import("@/lib/ord-fallback.server");
  const { heldParcelIndexes } = await import("@/lib/nostr/bitchat-landowner");
  const live: Record<string, string | null> = {};
  await Promise.all(candidates.map(async (p) => {
    live[p.inscriptionId] = (await ordInscription(p.inscriptionId).catch(() => null))?.address ?? null;
  }));
  return heldParcelIndexes(candidates, live, address);
}
