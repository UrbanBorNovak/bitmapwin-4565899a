import { queryOptions } from "@tanstack/react-query";

/** An image reinscribed on a BITMAP, painted flat over its land. */
export type LandSkin = {
  height: number;
  inscriptionId: string;
  contentType: string;
  bitmapInscriptionId: string;
};

/** One tile at a time, so each answer caches on its own and nothing is refetched. */
export const landSkinQuery = (height: number) =>
  queryOptions({
    queryKey: ["land-skin", height],
    queryFn: async (): Promise<LandSkin | null> => {
      const response = await fetch(`/api/public/land-skin/${height}`);
      if (!response.ok) return null;
      return (await response.json()) as LandSkin | null;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });

