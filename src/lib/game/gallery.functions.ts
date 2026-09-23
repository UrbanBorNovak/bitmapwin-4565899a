import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";

const ID_IN_HTML = /\/preview\/([0-9a-f]{64}i\d+)/g;

/** Reads every item of an ordinals.com gallery (100 per page). */
export const getGalleryItemsFn = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ inscriptionId: z.string().trim().regex(INSCRIPTION_ID_RE), maxPages: z.number().int().min(1).max(60).default(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const ids: string[] = [];
    const seen = new Set<string>();
    let pages = 0;
    let truncated = false;
    for (let page = 0; page < data.maxPages; page++) {
      const url = page === 0 ? `https://ordinals.com/gallery/${data.inscriptionId}` : `https://ordinals.com/gallery/${data.inscriptionId}/page/${page}`;
      const res = await fetch(url, { headers: { "User-Agent": "bitmapwin/1.0" } }).catch(() => null);
      if (!res || !res.ok) break;
      const html = await res.text();
      let added = 0;
      for (const m of html.matchAll(ID_IN_HTML)) {
        const id = m[1];
        if (id === data.inscriptionId || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        added++;
      }
      pages++;
      if (added === 0) break;
      if (!html.includes(`/page/${page + 1}`)) break;
      if (page === data.maxPages - 1) truncated = true;
    }
    return { inscriptionId: data.inscriptionId, ids, pages, truncated };
  });
