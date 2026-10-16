/**
 * Parcel clubs: communities defined by holding a VALID parcel of one specific
 * parent BITMAP. A parcel is the first child inscription claiming
 * `{index}.{height}.bitmap`, so membership is a fact already fixed on chain —
 * hold a valid parcel of the parent and the badge is yours.
 */

import { queryOptions } from "@tanstack/react-query";
import { getParcelClubBadges } from "@/lib/parcel-clubs.functions";

export type ParcelClub = {
  id: string;
  label: string;
  short: string;
  /** Parent BITMAP block height whose parcels grant membership. */
  height: number;
  /** Parent BITMAP inscription, used when the index has not resolved it yet. */
  parentInscription: string;
  blurb: string;
};

export const PARCEL_CLUBS: ParcelClub[] = [
  {
    id: "marauders",
    label: "MARAUDERS",
    short: "MARAUDER",
    height: 715093,
    parentInscription: "b8a860223abd0bad159ca45adce11859f973aefcab4a898625740e7ac3263628i0",
    blurb: "Holds a valid parcel of 715093.BITMAP.",
  },
  {
    id: "bitmap-stream",
    label: "BITMAP STREAM",
    short: "STREAM",
    height: 145159,
    parentInscription: "e754c5be450275bdbe2deffa4558f5ca0a583a582e3774266386ce0f265f305bi0",
    blurb: "Holds a valid parcel of 145159.BITMAP.",
  },
  {
    id: "9gang",
    label: "9GANG",
    short: "9GANG",
    height: 899995,
    parentInscription: "f6df0ef987c6a80f163592008af2b33910469289b686929fb8f0f37a1d46f167i0",
    blurb: "Holds a valid parcel of 899995.BITMAP.",
  },
  {
    id: "emporium",
    label: "EMPORIUM RESIDENT",
    short: "EMPORIUM",
    height: 717328,
    parentInscription: "c1e3330f25adaec23b5361ef1c1412e3fc29d5615f19fe02bf4c017a80c6031bi0",
    blurb: "Holds a valid parcel of 717328.BITMAP — Bitmap Emporium.",
  },
  {
    id: "pathscribe",
    label: "PATHSCRIBE",
    short: "PATHSCRIBE",
    height: 114588,
    parentInscription: "7b7d0d712731a66c61cd163f96a33d40f3bd4bbb4bc6236fa9bfa2959d937ea7i0",
    blurb: "Holds a valid parcel of 114588.BITMAP.",
  },
];

export function parcelClubById(id: string): ParcelClub | null {
  return PARCEL_CLUBS.find((club) => club.id === id) ?? null;
}

/** One earned membership, with the real parcels backing it. */
export type ParcelClubMembership = {
  clubId: string;
  height: number;
  /** Parcel indices this address holds inside the parent bitmap. */
  parcels: { index: number; inscriptionId: string }[];
};

export const parcelClubBadgesQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["parcel-club-badges", address],
    queryFn: () =>
      getParcelClubBadges({ data: { address: address as string } }) as Promise<ParcelClubMembership[]>,
    enabled: Boolean(address),
    staleTime: 5 * 60_000,
  });
