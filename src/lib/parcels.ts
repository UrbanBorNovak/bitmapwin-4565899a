import { queryOptions } from "@tanstack/react-query";
import { getParcels } from "@/lib/parcels.functions";
import type { ParcelScan } from "@/lib/parcels.server";

export type { ChainParcel, ParcelScan } from "@/lib/parcels.server";

/** `{tx-index}.{block-height}.bitmap` — the parcel claim text to inscribe. */
export function parcelName(index: number, height: number): string {
  return `${index}.${height}.bitmap`;
}

export const parcelsQuery = (height: number, inscriptionId: string | null) =>
  queryOptions({
    queryKey: ["parcels", height, inscriptionId],
    queryFn: () => getParcels({ data: { height, inscriptionId: inscriptionId as string } }) as Promise<ParcelScan>,
    enabled: Boolean(inscriptionId),
    staleTime: 60_000,
  });
