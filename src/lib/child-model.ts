import { queryOptions } from "@tanstack/react-query";

/** A 3D model inscribed as a child of a BITMAP, standing on its land. */
export type ChildModel = {
  height: number;
  inscriptionId: string;
  contentType: string;
  bitmapInscriptionId: string;
};

export const childModelQuery = (height: number) =>
  queryOptions({
    queryKey: ["child-model", height],
    queryFn: async (): Promise<ChildModel | null> => {
      const response = await fetch(`/api/public/child-model/${height}`);
      if (!response.ok) return null;
      return (await response.json()) as ChildModel | null;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
