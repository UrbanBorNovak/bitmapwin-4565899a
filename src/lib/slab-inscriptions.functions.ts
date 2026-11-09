import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ParcelInscription = {
  /** transaction index in the block = parcel index on the BITMAP */
  tx: number;
  id: string;
  number: number | null;
  type: string;
};

export type SlabInscriptions = { items: ParcelInscription[]; total: number; more: boolean } | { error: string };

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
const PAGES = 3; // ord lists 100 per page
const DETAIL_CAP = 60;

async function json<T>(url: string, ms = 10_000): Promise<T> {
  const r = await fetch(url, { headers: { ...UA, accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

/**
 * Inscriptions revealed in a block, mapped to their parcel by the reveal
 * transaction's position in the block (Bitmap theory: parcel i = tx i).
 * Only chain data from ordinals.com and mempool.space; nothing is stored.
 */
export const slabInscriptionsFn = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ height: z.number().int().min(0).max(5_000_000), hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(d))
  .handler(async ({ data }): Promise<SlabInscriptions> => {
    try {
      const ids: string[] = [];
      let more = false;
      for (let p = 0; p < PAGES; p++) {
        const page = await json<{ ids?: string[]; more?: boolean }>(`https://ordinals.com/inscriptions/block/${data.height}/${p}`).catch(() => null);
        if (!page) break;
        ids.push(...(page.ids ?? []));
        more = Boolean(page.more);
        if (!more) break;
      }
      if (ids.length === 0) return { items: [], total: 0, more: false };

      let txids: string[] = [];
      try { txids = await json<string[]>(`https://mempool.space/api/block/${data.hash}/txids`, 15_000); }
      catch { txids = await json<string[]>(`https://mempool.emzy.de/api/block/${data.hash}/txids`, 15_000); }
      const pos = new Map(txids.map((t, i) => [t, i]));

      const mapped = ids
        .map((id) => ({ id, tx: pos.get(id.slice(0, 64)) }))
        .filter((x): x is { id: string; tx: number } => typeof x.tx === "number");

      const details = await Promise.all(
        mapped.slice(0, DETAIL_CAP).map(async (m) => {
          const d = await json<{ number?: number; content_type?: string }>(`https://ordinals.com/r/inscription/${m.id}`, 8_000).catch(() => null);
          return { ...m, number: d?.number ?? null, type: (d?.content_type ?? "unknown").split(";")[0]!.trim() };
        }),
      );
      const rest = mapped.slice(DETAIL_CAP).map((m) => ({ ...m, number: null, type: "unknown" }));
      return { items: [...details, ...rest], total: ids.length, more };
    } catch (e) {
      console.error("slab inscriptions", e);
      return { error: "Inscription list unavailable right now" };
    }
  });
