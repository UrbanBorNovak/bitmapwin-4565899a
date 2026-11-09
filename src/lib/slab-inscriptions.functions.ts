import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ParcelInscription = {
  /** transaction index in the block = parcel index on the BITMAP */
  tx: number;
  txid: string;
  /** inscription id from ord; null when only mempool.space's envelope tag is known */
  id: string | null;
  number: number | null;
  /** MIME type, or "envelope" when only the tag is known */
  type: string;
};

export type SlabInscriptions =
  | { items: ParcelInscription[]; total: number; more: boolean; source: "ord" | "tag" }
  | { error: string };

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
const PAGES = 3; // ord lists 100 per page
const DETAIL_CAP = 60;
/** mempool.space summary flag: transaction carries an OP_FALSE OP_IF envelope */
const INSC_FLAG = 2 ** 26;

async function json<T>(url: string, ms = 10_000): Promise<T> {
  const r = await fetch(url, { headers: { ...UA, accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

type Row = { txid: string; flags?: number };
async function summary(hash: string): Promise<Row[]> {
  for (const base of ["https://mempool.space/api", "https://mempool.emzy.de/api"]) {
    try { return await json<Row[]>(`${base}/v1/block/${hash}/summary`, 20_000); } catch { /* next mirror */ }
  }
  throw new Error("summary unavailable");
}

async function ordIds(height: number): Promise<{ ids: string[]; more: boolean } | null> {
  const ids: string[] = [];
  let more = false;
  for (let p = 0; p < PAGES; p++) {
    const page = await json<{ ids?: string[]; more?: boolean }>(`https://ordinals.com/inscriptions/block/${height}/${p}`).catch(() => null);
    if (!page) return p === 0 ? null : { ids, more: true };
    ids.push(...(page.ids ?? []));
    more = Boolean(page.more);
    if (!more) break;
  }
  return { ids, more };
}

/**
 * Inscriptions revealed in a block, mapped to their parcel by the reveal
 * transaction's position in the block (Bitmap theory: parcel i = tx i).
 * Ord's list is used first; if ordinals.com is unreachable, mempool.space's
 * per-transaction envelope tag marks the parcels instead. Nothing is stored.
 */
export const slabInscriptionsFn = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ height: z.number().int().min(0).max(5_000_000), hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(d))
  .handler(async ({ data }): Promise<SlabInscriptions> => {
    try {
      const [ord, rows] = await Promise.all([ordIds(data.height), summary(data.hash).catch(() => null)]);
      if (ord && rows) {
        const pos = new Map(rows.map((t, i) => [t.txid, i]));
        const mapped = ord.ids
          .map((id) => ({ id, txid: id.slice(0, 64), tx: pos.get(id.slice(0, 64)) }))
          .filter((x): x is { id: string; txid: string; tx: number } => typeof x.tx === "number");
        const details = await Promise.all(
          mapped.slice(0, DETAIL_CAP).map(async (m) => {
            const d = await json<{ number?: number; content_type?: string }>(`https://ordinals.com/r/inscription/${m.id}`, 8_000).catch(() => null);
            return { ...m, number: d?.number ?? null, type: (d?.content_type ?? "unknown").split(";")[0]!.trim() };
          }),
        );
        const rest = mapped.slice(DETAIL_CAP).map((m) => ({ ...m, number: null, type: "unknown" }));
        return { items: [...details, ...rest], total: ord.ids.length, more: ord.more, source: "ord" };
      }
      if (rows) {
        const items: ParcelInscription[] = [];
        rows.forEach((r, i) => {
          if (Math.floor((r.flags ?? 0) / INSC_FLAG) % 2 === 1) items.push({ tx: i, txid: r.txid, id: null, number: null, type: "envelope" });
        });
        return { items, total: items.length, more: false, source: "tag" };
      }
      return { error: "Inscription list unavailable right now" };
    } catch (e) {
      console.error("slab inscriptions", e);
      return { error: "Inscription list unavailable right now" };
    }
  });
