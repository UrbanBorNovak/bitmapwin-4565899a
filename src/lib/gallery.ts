/** Client-side reader for inscribed gallery membership (real chain data). */

export type GalleryMembers = {
  inscriptionId: string;
  count: number;
  ids: string[];
  heights: number[];
};

export async function fetchGalleryMembers(inscriptionId: string): Promise<GalleryMembers> {
  const resp = await fetch(`/api/public/gallery/${inscriptionId}`);
  if (!resp.ok) throw new Error(`gallery ${inscriptionId}: ${resp.status}`);
  return (await resp.json()) as GalleryMembers;
}

export function galleryMembersQuery(inscriptionId: string) {
  return {
    queryKey: ["gallery-members", inscriptionId] as const,
    queryFn: () => fetchGalleryMembers(inscriptionId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  };
}
