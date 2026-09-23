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
  const response = await fetch(url, { headers: { "User-Agent": "bitmapwin/1.0" } });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export const getParentImageChildrenFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        parentInscriptionId: inscriptionId,
        limit: z.number().int().min(1).max(60).default(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const parent = data.parentInscriptionId.toLowerCase();
    const childIds: string[] = [];
    let page = 0;
    let more = true;

    while (more && page < 10 && childIds.length < data.limit * 3) {
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
    for (const id of childIds) {
      if (images.length >= data.limit) break;
      const meta = await readJson<InscriptionMeta>(`https://ordinals.com/r/inscription/${id}`);
      const contentType = String(meta?.content_type ?? "").toLowerCase();
      if (!contentType.startsWith("image/")) continue;
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
      truncated: more || childIds.length >= data.limit * 3,
    };
  });
