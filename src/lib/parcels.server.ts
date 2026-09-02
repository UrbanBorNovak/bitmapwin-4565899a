/**
 * Parcel Theory resolver.
 *
 * A parcel is the FIRST valid child inscription of a district (block) bitmap,
 * named `{tx-index}.{block-height}.bitmap`. Everything here reads real chain
 * data from the ord recursive endpoints — no synthetic parcels.
 */

const ORD = "https://ordinals.com";
const UA = "bitmap-marketplace/1.0";

import type { ChainParcel, ParcelScan } from "@/lib/parcels";

export type { ChainParcel, ParcelScan };

type ChildRow = {
  id: string;
  number: number;
  height?: number;
  timestamp?: number;
};

async function ordFetch(path: string, attempts = 3): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": UA, accept: "application/json, text/plain, */*" },
      });
      if (resp.ok) return resp;
      if (resp.status === 404) return null;
      if (resp.status === 429 || resp.status === 406 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

async function fetchChildren(inscriptionId: string, maxPages: number): Promise<{ rows: ChildRow[]; more: boolean }> {
  const rows: ChildRow[] = [];
  let more = false;
  for (let page = 0; page < maxPages; page++) {
    const resp = await ordFetch(`/r/children/${inscriptionId}/inscriptions/${page}`);
    if (!resp) break;
    const json = (await resp.json()) as { children?: ChildRow[]; more?: boolean };
    const children = json.children ?? [];
    rows.push(...children);
    more = Boolean(json.more);
    if (!json.more || children.length === 0) break;
  }
  return { rows, more };
}

/**
 * Reads a child's content type and, when it is a plain-text parcel claim, its
 * parcel index. Non-text children keep their content type so the UI can render
 * html, images, svg, models and json children as they are on chain.
 */
async function inspectChild(
  id: string,
  height: number,
): Promise<{ contentType: string | null; parcelIndex: number | null }> {
  const resp = await ordFetch(`/content/${id}`, 2);
  if (!resp) return { contentType: null, parcelIndex: null };
  const type = (resp.headers.get("content-type") ?? "").toLowerCase();
  if (type && !type.includes("text/plain")) return { contentType: type || null, parcelIndex: null };
  const text = (await resp.text()).trim().toLowerCase();
  const match = /^(\d+)\.(\d+)\.bitmap$/.exec(text);
  if (!match || Number(match[2]) !== height) return { contentType: type || null, parcelIndex: null };
  const index = Number(match[1]);
  return {
    contentType: type || null,
    parcelIndex: Number.isSafeInteger(index) && index >= 0 ? index : null,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

async function blockTxCount(height: number): Promise<number | null> {
  try {
    const resp = await fetch(`https://mempool.space/api/block-height/${height}`, {
      headers: { "user-agent": UA },
    });
    if (!resp.ok) return null;
    const hash = (await resp.text()).trim();
    const block = await fetch(`https://mempool.space/api/block/${hash}`, { headers: { "user-agent": UA } });
    if (!block.ok) return null;
    const json = (await block.json()) as { tx_count?: number };
    return typeof json.tx_count === "number" ? json.tx_count : null;
  } catch {
    return null;
  }
}

export async function scanParcels(
  height: number,
  districtInscriptionId: string,
  maxChildren = 300,
): Promise<ParcelScan> {
  const [{ rows, more }, maxParcels] = await Promise.all([
    fetchChildren(districtInscriptionId, 6),
    blockTxCount(height),
  ]);

  const truncated = more || rows.length > maxChildren;
  const inspected = rows.slice(0, maxChildren);

  const details = await mapLimit(inspected, 8, (child) => inspectChild(child.id, height));

  const children = inspected.map((child, i) => ({
    inscriptionId: child.id,
    inscriptionNumber: child.number,
    inscribedInBlock: child.height ?? null,
    timestamp: child.timestamp ?? null,
    contentType: details[i]?.contentType ?? null,
    parcelIndex: details[i]?.parcelIndex ?? null,
  }));

  const claims: ChainParcel[] = [];
  for (let i = 0; i < inspected.length; i++) {
    const index = details[i]?.parcelIndex;
    if (index === null || index === undefined) continue;
    const child = inspected[i]!;
    if (maxParcels !== null && index >= maxParcels) continue; // beyond the block's tx count
    claims.push({
      index,
      inscriptionId: child.id,
      inscriptionNumber: child.number,
      inscribedInBlock: child.height ?? null,
      timestamp: child.timestamp ?? null,
      valid: false,
    });
  }

  // First inscription (lowest inscription number) claiming an index wins.
  claims.sort((a, b) => a.inscriptionNumber - b.inscriptionNumber);
  const taken = new Set<number>();
  for (const claim of claims) {
    if (!taken.has(claim.index)) {
      claim.valid = true;
      taken.add(claim.index);
    }
  }
  claims.sort((a, b) => a.index - b.index || a.inscriptionNumber - b.inscriptionNumber);

  return {
    height,
    districtInscriptionId,
    maxParcels,
    childrenScanned: inspected.length,
    truncated,
    parcels: claims,
  };
}
