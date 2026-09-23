import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSCRIPTION_ID_RE } from "./pfpExtenders";

export type OrdiscanCollectionItem = {
  inscriptionId: string;
  contentType: string;
  number: number | null;
};

type OrdiscanPage = { data?: unknown[] };

function pickId(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  const candidate = record["inscription_id"] ?? record["inscriptionId"] ?? record["id"];
  const id = String(candidate ?? "").toLowerCase();
  return INSCRIPTION_ID_RE.test(id) ? id : null;
}

function pickContentType(item: unknown): string {
  if (typeof item !== "object" || item === null) return "";
  const record = item as Record<string, unknown>;
  return String(record["content_type"] ?? record["contentType"] ?? "").toLowerCase();
}

function pickNumber(item: unknown): number | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  const value = Number(record["inscription_number"] ?? record["number"]);
  return Number.isFinite(value) ? value : null;
}

export const getOrdiscanCollectionFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
        limit: z.number().int().min(1).max(300).default(250),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["ORDISCAN_API_KEY"];
    if (!apiKey) {
      return { slug: data.slug, needsKey: true, items: [] as OrdiscanCollectionItem[], checked: 0, truncated: false };
    }
    const items: OrdiscanCollectionItem[] = [];
    const seen = new Set<string>();
    let page = 1;
    let truncated = false;
    while (items.length < data.limit && page <= 12) {
      const response = await fetch(`https://api.ordiscan.com/v1/collection/${data.slug}/inscriptions?page=${page}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (!response.ok) break;
      const payload = (await response.json()) as OrdiscanPage;
      const rows = Array.isArray(payload.data) ? payload.data : [];
      if (rows.length === 0) break;
      for (const row of rows) {
        if (items.length >= data.limit) break;
        const id = pickId(row);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push({ inscriptionId: id, contentType: pickContentType(row), number: pickNumber(row) });
      }
      if (rows.length < 100) break;
      page += 1;
      if (items.length >= data.limit) truncated = true;
    }
    return { slug: data.slug, needsKey: false, items, checked: items.length, truncated };
  });
