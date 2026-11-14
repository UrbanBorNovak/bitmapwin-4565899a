// Live custody lookups for BW-ROOMS-1 holder badges. Stores nothing; every
// failure is reported as "unavailable" so it can never read as "holds nothing".
import type { HoldingCheck } from "@/lib/nostr/bitchat-landowner";

const MAX_PARCEL_CHECKS = 12;

export type BitmapHolder =
  | { status: "ok"; holder: string | null }
  | { status: "none" }
  | { status: "unavailable"; reason: string };

/** Address holding the canonical BITMAP inscription right now (read live, never cached). */
export async function bitmapHolderNow(height: number): Promise<BitmapHolder> {
  try {
    const { liveBitmapFn } = await import("@/lib/bw-matter.functions");
    const d = await liveBitmapFn({ data: { height } });
    if (!d.inscriptionId) return d.error ? { status: "unavailable", reason: "LiveOCI lookup unavailable" } : { status: "none" };
    const { ordInscription } = await import("@/lib/ord-fallback.server");
    const info = await ordInscription(d.inscriptionId);
    if (!info) return { status: "unavailable", reason: "holder lookup unavailable" };
    return { status: "ok", holder: info.address };
  } catch (e) {
    console.error("bitmapHolderNow", e);
    return { status: "unavailable", reason: "holder lookup unavailable" };
  }
}

/** Parcel indexes `address` holds right now: candidates from the parcel scan, each re-read live from ord. */
export async function liveParcelsHeldBy(height: number, address: string): Promise<HoldingCheck> {
  const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
  const { decideParcelHolding } = await import("@/lib/nostr/bitchat-landowner");
  const { ordInscription } = await import("@/lib/ord-fallback.server");
  const run = async (fresh: boolean): Promise<HoldingCheck> => {
    let holders: Awaited<ReturnType<typeof parcelHoldersFor>>;
    try { holders = await parcelHoldersFor(height, { fresh }); } catch (e) {
      console.error("liveParcelsHeldBy scan", e);
      return decideParcelHolding({ scan: "failed", incomplete: true, truncated: false, candidates: [], live: {}, address });
    }
    if (!holders) return { status: "none" }; // no canonical BITMAP for this block
    const candidates = holders.parcels.filter((p) => p.ownerAddress === address).slice(0, MAX_PARCEL_CHECKS);
    const live: Record<string, { address: string | null } | null> = {};
    await Promise.all(candidates.map(async (p) => {
      const info = await ordInscription(p.inscriptionId).catch(() => null);
      live[p.inscriptionId] = info ? { address: info.address } : null;
    }));
    return decideParcelHolding({ scan: "ok", incomplete: holders.incomplete, truncated: holders.truncated, candidates, live, address });
  };
  const first = await run(false);
  // A cached scan may predate a recent transfer to this address: read the chain once more before saying "none".
  return first.status === "none" ? run(true) : first;
}
