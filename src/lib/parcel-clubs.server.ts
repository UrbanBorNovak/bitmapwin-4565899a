import { PARCEL_CLUBS, type ParcelClubMembership } from "@/lib/parcel-clubs";

/**
 * Resolves which parcel clubs an address belongs to by reading the real parcel
 * claims of each club's parent BITMAP and keeping only valid parcels currently
 * held by that address.
 */
export async function readParcelClubBadges(address: string): Promise<ParcelClubMembership[]> {
  const { scanParcels } = await import("@/lib/parcels.server");
  const wanted = address.trim();
  if (!wanted) return [];

  const inscriptionByHeight = await resolveParents();

  const results = await Promise.all(
    PARCEL_CLUBS.map(async (club) => {
      const inscriptionId = inscriptionByHeight.get(club.height) ?? club.parentInscription;
      try {
        const scan = await scanParcels(club.height, inscriptionId);
        const parcels = scan.parcels
          .filter((parcel) => parcel.valid && parcel.ownerAddress === wanted)
          .map((parcel) => ({ index: parcel.index, inscriptionId: parcel.inscriptionId }));
        if (parcels.length === 0) return null;
        return { clubId: club.id, height: club.height, parcels } satisfies ParcelClubMembership;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((entry): entry is ParcelClubMembership => entry !== null);
}

async function resolveParents(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bitmap_index")
      .select("block_height, inscription_id")
      .in("block_height", PARCEL_CLUBS.map((club) => club.height));
    for (const row of data ?? []) {
      if (row.inscription_id) map.set(Number(row.block_height), row.inscription_id);
    }
  } catch {
    // fall back to the known parent inscriptions
  }
  return map;
}

/**
 * Every address holding a valid parcel of one parcel club, with the parcel inscription as proof.
 * Throws when the chain scan fails, so a failed check is never mistaken for "not a member".
 */
export async function clubParcelHolders(clubId: string): Promise<Map<string, string>> {
  const club = PARCEL_CLUBS.find((c) => c.id === clubId);
  if (!club) throw new Error("Unknown club");
  const { scanParcels } = await import("@/lib/parcels.server");
  const parent = (await resolveParents()).get(club.height) ?? club.parentInscription;
  const scan = await scanParcels(club.height, parent);
  const holders = new Map<string, string>();
  for (const p of scan.parcels) {
    if (p.valid && p.ownerAddress && !holders.has(p.ownerAddress.toLowerCase())) holders.set(p.ownerAddress.toLowerCase(), p.inscriptionId);
  }
  return holders;
}
