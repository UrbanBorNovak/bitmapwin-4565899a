import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";

const inscriptionId = z.string().trim().regex(INSCRIPTION_ID_RE);

type ChildImage = {
  inscriptionId: string;
  contentType: string;
  contentLength: number | null;
  number: number | null;
};

type ChildrenResponse = { ids?: unknown[]; more?: boolean; page?: number };
type InscriptionMeta = { content_type?: unknown; content_length?: unknown; number?: unknown };

async function readJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export const getParentImageChildrenFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        parentInscriptionId: inscriptionId.optional(),
        bitmap: z.number().int().min(0).max(999_999).optional(),
        limit: z.number().int().min(1).max(250).default(250),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let parent = data.parentInscriptionId?.toLowerCase() ?? null;
    if (!parent && data.bitmap !== undefined) {
      const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
      parent = (await bitmapInscriptionFor(data.bitmap))?.toLowerCase() ?? null;
    }
    if (!parent) return { parentInscriptionId: null, checkedChildren: 0, imageChildren: [] as ChildImage[], truncated: false };
    const childIds: string[] = [];
    let page = 0;
    let more = true;

    while (more && page < 50 && childIds.length < data.limit * 2) {
      const payload = await readJson<ChildrenResponse>(`https://ordinals.com/r/children/${parent}/${page}`);
      if (!payload) break;
      for (const raw of payload.ids ?? []) {
        const id = String(raw).toLowerCase();
        if (INSCRIPTION_ID_RE.test(id)) childIds.push(id);
      }
      more = payload.more === true;
      page += 1;
    }

    const images: ChildImage[] = [];
    const metas: (InscriptionMeta | null)[] = [];
    for (let i = 0; i < childIds.length; i += 12) {
      const batch = childIds.slice(i, i + 12);
      metas.push(...(await Promise.all(batch.map((id) => readJson<InscriptionMeta>(`https://ordinals.com/r/inscription/${id}`).catch(() => null)))));
    }
    for (const [i, id] of childIds.entries()) {
      if (images.length >= data.limit) break;
      const meta = metas[i];
      const contentType = String(meta?.content_type ?? "").toLowerCase();
      if (!contentType.startsWith("image/") && !contentType.startsWith("text/html")) continue;
      images.push({
        inscriptionId: id,
        contentType,
        contentLength: typeof meta?.content_length === "number" ? meta.content_length : null,
        number: typeof meta?.number === "number" ? meta.number : null,
      });
    }

    return {
      parentInscriptionId: parent,
      checkedChildren: childIds.length,
      imageChildren: images,
      truncated: more || childIds.length >= data.limit * 2,
    };
  });
