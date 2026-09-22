import { queryOptions } from "@tanstack/react-query";
import { getLandSkins } from "@/lib/land-skin.functions";

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
    queryFn: async () => {
      const found = (await getLandSkins({ data: { heights: [height] } })) as LandSkin[];
      return found[0] ?? null;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
