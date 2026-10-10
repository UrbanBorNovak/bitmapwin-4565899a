import { createServerFn } from "@tanstack/react-start";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";
import { ORD_TORCHES_PARENT, ORD_TORCHES_SUPPLY } from "./ordTorches";

let cache: { ids: string[]; at: number } | null = null;

export const getOrdTorchesFn = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return { parent: ORD_TORCHES_PARENT, ids: cache.ids };
  const ids: string[] = [];
  const fetchPage = async (page: number) => {
    const res = await fetch(`https://ordinals.com/r/children/${ORD_TORCHES_PARENT}/${page}`, { headers: { "User-Agent": "bitmapwin/1.0" } });
    if (!res.ok) return { ids: [] as string[], more: false };
    const body = (await res.json()) as { ids?: unknown[]; more?: boolean };
    return { ids: (body.ids ?? []).map((r) => String(r).toLowerCase()).filter((id) => INSCRIPTION_ID_RE.test(id)), more: body.more === true };
  };
  // Read every child page (8 in parallel) until the parent reports no more.
  let page = 0;
  let more = true;
  while (more && page < 250) {
    const batch = await Promise.all(Array.from({ length: 8 }, (_, i) => fetchPage(page + i)));
    for (const b of batch) {
      ids.push(...b.ids);
      if (!b.more) { more = false; break; }
    }
    page += 8;
  }
  const capped = ids.slice(0, ORD_TORCHES_SUPPLY);
  if (capped.length) cache = { ids: capped, at: Date.now() };
  return { parent: ORD_TORCHES_PARENT, ids: capped };
});
