import { queryOptions } from "@tanstack/react-query";
import { getInscriptionChildren, getParcels, getReinscriptions } from "@/lib/parcels.functions";

/** A parcel claim found on chain as a child inscription of a district bitmap. */
export type ChainParcel = {
  /** Transaction index inside the district block. */
  index: number;
  inscriptionId: string;
  inscriptionNumber: number;
  inscribedInBlock: number | null;
  timestamp: number | null;
  /** Current address holding this parcel inscription, read live from ord. */
  ownerAddress: string | null;
  /** true = first child claiming this index (valid), false = later duplicate. */
  valid: boolean;
};

/** Any child inscription of the district bitmap, parcel claim or not. */
export type ChainChild = {
  inscriptionId: string;
  inscriptionNumber: number;
  inscribedInBlock: number | null;
  timestamp: number | null;
  /** Content type as served by ord, e.g. `text/html;charset=utf-8`. */
  contentType: string | null;
  /** Parcel index when this child is a `{index}.{height}.bitmap` claim. */
  parcelIndex: number | null;
};

export type ParcelScan = {
  height: number;
  districtInscriptionId: string;
  /** Max valid parcels = transaction count of the district block. */
  maxParcels: number | null;
  childrenScanned: number;
  truncated: boolean;
  /** true when an ord/mempool read failed (not "not found"): the parcel list or holders may be missing entries. */
  incomplete?: boolean;
  parcels: ChainParcel[];
  /** Every scanned child inscription, so the UI can render their content. */
  children: ChainChild[];
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

export const inscriptionChildrenQuery = (inscriptionId: string | null) =>
  queryOptions({
    queryKey: ["inscription-children", inscriptionId],
    queryFn: () =>
      getInscriptionChildren({
        data: { inscriptionId: inscriptionId as string },
      }) as Promise<ChainChild[]>,
    enabled: Boolean(inscriptionId),
    staleTime: 60_000,
  });

export type ReinscriptionScan = {
  sat: number | null;
  original: string | null;
  reinscriptions: ChainChild[];
};

export const reinscriptionsQuery = (inscriptionId: string | null) =>
  queryOptions({
    queryKey: ["reinscriptions", inscriptionId],
    queryFn: () =>
      getReinscriptions({
        data: { inscriptionId: inscriptionId as string },
      }) as Promise<ReinscriptionScan>,
    enabled: Boolean(inscriptionId),
    staleTime: 5 * 60_000,
  });
