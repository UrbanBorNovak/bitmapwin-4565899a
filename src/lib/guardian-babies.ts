/** On-chain babies of a Guardian: child inscriptions (Tag 3) carrying BITMAPWIN-PET metadata. */
import { queryOptions } from "@tanstack/react-query";
import { readCbor } from "@/lib/forge-delegate";

export type BabyMeta = { id: string; sire: string; dam: string; g?: number };
const ORD = "https://ordinals.com";

async function meta(id: string): Promise<BabyMeta | null> {
  const r = await fetch(`${ORD}/r/metadata/${id}`);
  if (!r.ok) return null;
  const hex = String(await r.json()).replace(/[^0-9a-f]/gi, "");
  const b = new Uint8Array(hex.length / 2);
  for (let k = 0; k < b.length; k++) b[k] = parseInt(hex.substr(k * 2, 2), 16);
  const m = readCbor(b) as { p?: string; sire?: unknown; dam?: unknown; g?: number } | null;
  if (!m || m.p !== "BITMAPWIN-PET" || typeof m.sire !== "string" || typeof m.dam !== "string") return null;
  return { id, sire: m.sire, dam: m.dam, g: m.g };
}

/** Only children whose own metadata names this Guardian as sire or dam count as its babies. */
export const guardianBabiesQuery = (parentId: string | null) =>
  queryOptions({
    queryKey: ["guardian-babies", parentId],
    enabled: !!parentId,
    staleTime: 300_000,
    retry: 1,
    queryFn: async (): Promise<BabyMeta[]> => {
      const ids: string[] = [];
      for (let page = 0; page < 5; page++) {
        const r = await fetch(`${ORD}/r/children/${parentId}/${page}`);
        if (!r.ok) break;
        const j = (await r.json()) as { ids?: string[]; more?: boolean };
        ids.push(...(j.ids ?? []));
        if (!j.more) break;
      }
      const all = await Promise.all(ids.slice(0, 40).map((id) => meta(id).catch(() => null)));
      return all.filter((b): b is BabyMeta => !!b && (b.sire === parentId || b.dam === parentId));
    },
  });
