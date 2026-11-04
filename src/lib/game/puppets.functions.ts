import { createServerFn } from "@tanstack/react-start";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";
import { PUPPETS_PARENT, PUPPETS_SUPPLY } from "./puppets";

let cache: { ids: string[]; at: number } | null = null;

export const getPuppetsFn = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return { parent: PUPPETS_PARENT, ids: cache.ids };
  // The parent is itself a hood — it leads the pool, children follow.
  const ids: string[] = [];
  const fetchPage = async (page: number) => {
    const res = await fetch(`https://ordinals.com/r/children/${PUPPETS_PARENT}/${page}`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
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
  const capped = ids.slice(0, PUPPETS_SUPPLY);
  if (capped.length) cache = { ids: capped, at: Date.now() };
  return { parent: PUPPETS_PARENT, ids: capped };
});
