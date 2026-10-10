import { createServerFn } from "@tanstack/react-start";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";
import { ORD_TORCHES_PARENT, ORD_TORCHES_SUPPLY } from "./ordTorches";

let cache: { ids: string[]; at: number } | null = null;

export const getOrdTorchesFn = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return { parent: ORD_TORCHES_PARENT, ids: cache.ids };
  const ids: string[] = [];
  let page = 0;
  let more = true;
  while (more && page < 250 && ids.length < ORD_TORCHES_SUPPLY) {
    const res = await fetch(`https://ordinals.com/r/children/${ORD_TORCHES_PARENT}/${page}`, { headers: { "User-Agent": "bitmapwin/1.0" } });
    if (!res.ok) break;
    const body = (await res.json()) as { ids?: unknown[]; more?: boolean };
    for (const raw of body.ids ?? []) {
      const id = String(raw).toLowerCase();
      if (INSCRIPTION_ID_RE.test(id)) ids.push(id);
    }
    more = body.more === true;
    page += 1;
  }
  const capped = ids.slice(0, ORD_TORCHES_SUPPLY);
  if (capped.length) cache = { ids: capped, at: Date.now() };
  return { parent: ORD_TORCHES_PARENT, ids: capped };
});
