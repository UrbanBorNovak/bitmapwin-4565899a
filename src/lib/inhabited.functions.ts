// Inhabited BITMAPs: lands whose Guardian child is inscribed on Bitcoin.
// Source of truth is the chain: children of the V6 collection root, each
// resolved to its `<height>.bitmap` parent by reading that parent's content.
import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { GUARDIAN_V6_MASTER_ID } from "@/lib/guardian-delegate";

const ORD = "https://ordinals.com";
const H = { Accept: "application/json", "User-Agent": "curl/8.5.0" };
export type Inhabitant = { height: number; inscriptionId: string };

let cache: { at: number; value: Inhabitant[] } | null = null;
const parentHeight = new Map<string, number | null>();

async function get(path: string, json = true): Promise<unknown> {
  const res = await fetch(`${ORD}${path}`, { headers: H, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return json ? res.json() : res.text();
}

export const inhabitedBitmapsFn = createServerFn({ method: "GET" }).handler(async (): Promise<Inhabitant[]> => {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  const ids: string[] = [];
  for (let page = 0; page < 20; page++) {
    const body = (await get(`/r/children/${GUARDIAN_V6_MASTER_ID}/${page}`).catch(() => null)) as { ids?: string[]; more?: boolean } | null;
    if (!body) { if (cache) return cache.value; break; }
    ids.push(...(body.ids ?? []).filter((id) => /^[0-9a-f]{64}i\d+$/.test(id)));
    if (!body.more) break;
  }
  const out: Inhabitant[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    const parents = ((await get(`/r/parents/${id}`).catch(() => ({ ids: [] }))) as { ids?: string[] }).ids ?? [];
    for (const p of parents) {
      if (p === GUARDIAN_V6_MASTER_ID) continue;
      if (!parentHeight.has(p)) {
        const text = String(await get(`/content/${p}`, false).catch(() => "")).trim();
        const m = /^(\d+)\.bitmap$/.exec(text);
        parentHeight.set(p, m ? Number(m[1]) : null);
      }
      const h = parentHeight.get(p);
      // First inscribed Guardian per block wins; later ones don't count.
      if (h != null && !seen.has(h)) { seen.add(h); out.push({ height: h, inscriptionId: id }); }
    }
  }
  cache = { at: Date.now(), value: out };
  return out;
});

export const inhabitedQuery = () =>
  queryOptions({
    queryKey: ["inhabited-bitmaps"],
    queryFn: async () => new Map((await inhabitedBitmapsFn()).map((i) => [i.height, i.inscriptionId])),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
