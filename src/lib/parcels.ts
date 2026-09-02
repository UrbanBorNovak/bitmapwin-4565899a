import { queryOptions } from "@tanstack/react-query";
import { getParcels } from "@/lib/parcels.functions";

/** A parcel claim found on chain as a child inscription of a district bitmap. */
export type ChainParcel = {
  /** Transaction index inside the district block. */
  index: number;
  inscriptionId: string;
  inscriptionNumber: number;
  inscribedInBlock: number | null;
  timestamp: number | null;
  /** true = first child claiming this index (valid), false = later duplicate. */
  valid: boolean;
};

export type ParcelScan = {
  height: number;
  districtInscriptionId: string;
  /** Max valid parcels = transaction count of the district block. */
  maxParcels: number | null;
  childrenScanned: number;
  truncated: boolean;
  parcels: ChainParcel[];
};

/** `{tx-index}.{block-height}.bitmap` — the parcel claim text to inscribe. */
export function parcelName(index: number, height: number): string {
  return `${index}.${height}.bitmap`;
}

export const parcelsQuery = (height: number, inscriptionId: string | null) =>
  queryOptions({
    queryKey: ["parcels", height, inscriptionId],
    queryFn: () =>
      getParcels({ data: { height, inscriptionId: inscriptionId as string } }) as Promise<ParcelScan>,
    enabled: Boolean(inscriptionId),
    staleTime: 60_000,
  });
