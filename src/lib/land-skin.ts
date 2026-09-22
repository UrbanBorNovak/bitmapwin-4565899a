import { queryOptions } from "@tanstack/react-query";
import { getLandSkins } from "@/lib/land-skin.functions";

/** An image reinscribed on a BITMAP, painted flat over its land. */
export type LandSkin = {
  height: number;
  inscriptionId: string;
  contentType: string;
  bitmapInscriptionId: string;
};

export const landSkinsQuery = (heights: number[]) =>
  queryOptions({
    queryKey: ["land-skins", heights.join(",")],
    queryFn: () => getLandSkins({ data: { heights } }) as Promise<LandSkin[]>,
    enabled: heights.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
  });
