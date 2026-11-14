/**
 * Parcel Theory resolver.
 *
 * A parcel is the FIRST valid child inscription of a district (block) bitmap,
 * named `{tx-index}.{block-height}.bitmap`. Everything here reads real chain
 * data from the ord recursive endpoints — no synthetic parcels.
 */

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

import type { ChainChild, ChainParcel, ParcelScan } from "@/lib/parcels";

export type { ChainChild, ChainParcel, ParcelScan };

export type ParcelizationSummary = {
  height: number;
  validParcels: number;
  holders: number;
  maxParcels: number | null;
  truncated: boolean;
  /** Ranked parcel owners on this BITMAP, biggest stake first. */
  owners: Array<{ address: string | null; parcels: number; indexes: number[] }>;
  /** Every valid parcel found, so the map can show who holds each one. */
  parcels: Array<{ index: number; address: string | null; inscriptionId: string }>;
};

const parcelSummaryCache = new Map<string, { expires: number; value: ParcelizationSummary }>();
const PARCEL_SUMMARY_TTL = 5 * 60_000;

type ChildRow = {
  id: string;
  number: number;
  height?: number;
  timestamp?: number;
};

/** Counts reads that failed for a reason other than "not found", so callers can tell an empty answer from an outage. */
type ReadTrack = { failed: number };

async function ordFetch(path: string, attempts = 3, track?: ReadTrack): Promise<Response | null> {
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
      if (track) track.failed++;
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  if (track) track.failed++;
  return null;
}

async function fetchChildren(inscriptionId: string, maxPages: number, track?: ReadTrack): Promise<{ rows: ChildRow[]; more: boolean }> {
  const rows: ChildRow[] = [];
  let more = false;
  for (let page = 0; page < maxPages; page++) {
    const resp = await ordFetch(`/r/children/${inscriptionId}/inscriptions/${page}`, 3, track);
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
  track?: ReadTrack,
): Promise<{ contentType: string | null; parcelIndex: number | null }> {
  const resp = await ordFetch(`/content/${id}`, 2, track);
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

async function blockTxCount(height: number, track?: ReadTrack): Promise<number | null> {
  try {
    const resp = await fetch(`https://mempool.space/api/block-height/${height}`, {
      headers: { "user-agent": UA },
    });
    if (!resp.ok) { if (track) track.failed++; return null; }
    const hash = (await resp.text()).trim();
    const block = await fetch(`https://mempool.space/api/block/${hash}`, { headers: { "user-agent": UA } });
    if (!block.ok) { if (track) track.failed++; return null; }
    const json = (await block.json()) as { tx_count?: number };
    if (typeof json.tx_count === "number") return json.tx_count;
    if (track) track.failed++;
    return null;
  } catch {
    if (track) track.failed++;
    return null;
  }
}

export async function scanParcels(
  height: number,
  districtInscriptionId: string,
  maxChildren = 300,
): Promise<ParcelScan> {
  const track: ReadTrack = { failed: 0 };
  const [{ rows, more }, maxParcels] = await Promise.all([
    fetchChildren(districtInscriptionId, 6, track),
    blockTxCount(height, track),
  ]);

  const truncated = more || rows.length > maxChildren;
  const inspected = rows.slice(0, maxChildren);

  const details = await mapLimit(inspected, 8, (child) => inspectChild(child.id, height, track));

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
      ownerAddress: null,
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

  const validClaims = claims.filter((claim) => claim.valid);
  const holderAddresses = await mapLimit(validClaims, 8, async (claim) => {
    const resp = await ordFetch(`/r/inscription/${claim.inscriptionId}`, 2, track);
    if (!resp) return null;
    const meta = (await resp.json()) as { address?: string | null };
    return meta.address ?? null;
  });
  validClaims.forEach((claim, index) => {
    claim.ownerAddress = holderAddresses[index] ?? null;
  });

  return {
    height,
    districtInscriptionId,
    maxParcels,
    childrenScanned: inspected.length,
    truncated,
    incomplete: track.failed > 0,
    parcels: claims,
    children,
  };
}

/**
 * Small atlas read-model backed by the same recursive parcel scan as the land
 * page. Results are cached so panning back over a BITMAP does not rescan ord.
 */
export async function summarizeParcelization(
  items: Array<{ height: number; inscriptionId: string }>,
): Promise<ParcelizationSummary[]> {
  return mapLimit(items, 3, async (item) => {
    const key = `${item.height}:${item.inscriptionId}`;
    const cached = parcelSummaryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const scan = await scanParcels(item.height, item.inscriptionId);
    const valid = scan.parcels.filter((parcel) => parcel.valid);
    const byOwner = new Map<string, { address: string | null; parcels: number; indexes: number[] }>();
    for (const parcel of valid) {
      const key = parcel.ownerAddress ?? "__unknown__";
      const row = byOwner.get(key) ?? { address: parcel.ownerAddress ?? null, parcels: 0, indexes: [] };
      row.parcels += 1;
      if (row.indexes.length < 6) row.indexes.push(parcel.index);
      byOwner.set(key, row);
    }
    const value: ParcelizationSummary = {
      height: item.height,
      validParcels: valid.length,
      holders: new Set(valid.flatMap((parcel) => parcel.ownerAddress ? [parcel.ownerAddress] : [])).size,
      maxParcels: scan.maxParcels,
      truncated: scan.truncated,
      owners: [...byOwner.values()].sort((a, b) => b.parcels - a.parcels).slice(0, 8),
      parcels: valid
        .slice()
        .sort((a, b) => a.index - b.index)
        .slice(0, 240)
        .map((parcel) => ({
          index: parcel.index,
          address: parcel.ownerAddress ?? null,
          inscriptionId: parcel.inscriptionId,
        })),
    };
    parcelSummaryCache.set(key, { expires: Date.now() + PARCEL_SUMMARY_TTL, value });
    return value;
  });
}

/** Children of a parcel inscription (grandchildren of the district). */
export async function scanChildInscriptions(inscriptionId: string, max = 48): Promise<ChainChild[]> {
  const { rows } = await fetchChildren(inscriptionId, 3);
  const inspected = rows.slice(0, max);
  const types = await mapLimit(inspected, 8, async (child) => {
    const resp = await ordFetch(`/content/${child.id}`, 2);
    return (resp?.headers.get("content-type") ?? "").toLowerCase() || null;
  });
  return inspected.map((child, i) => ({
    inscriptionId: child.id,
    inscriptionNumber: child.number,
    inscribedInBlock: child.height ?? null,
    timestamp: child.timestamp ?? null,
    contentType: types[i] ?? null,
    parcelIndex: null,
  }));
}

/**
 * Reinscriptions of a district: every later inscription sharing the sat that
 * carries the district's bitmap claim. The first inscription on the sat is the
 * original; anything after it is a reinscription.
 */
export async function scanReinscriptions(inscriptionId: string): Promise<{
  sat: number | null;
  original: string | null;
  reinscriptions: ChainChild[];
}> {
  const info = await ordFetch(`/r/inscription/${inscriptionId}`, 2);
  if (!info) return { sat: null, original: null, reinscriptions: [] };
  const json = (await info.json()) as { sat?: number | null };
  const sat = typeof json.sat === "number" ? json.sat : null;
  if (sat === null) return { sat: null, original: null, reinscriptions: [] };

  const ids: string[] = [];
  for (let page = 0; page < 3; page++) {
    const resp = await ordFetch(`/r/sat/${sat}/${page}`, 2);
    if (!resp) break;
    const body = (await resp.json()) as { ids?: string[]; more?: boolean };
    ids.push(...(body.ids ?? []));
    if (!body.more) break;
  }
  if (ids.length <= 1) return { sat, original: ids[0] ?? null, reinscriptions: [] };

  const later = ids.slice(1);
  const details = await mapLimit(later, 6, async (id) => {
    const resp = await ordFetch(`/r/inscription/${id}`, 2);
    const meta = resp
      ? ((await resp.json()) as { content_type?: string | null; number?: number; height?: number; timestamp?: number })
      : null;
    return meta;
  });

  return {
    sat,
    original: ids[0] ?? null,
    reinscriptions: later.map((id, i) => ({
      inscriptionId: id,
      inscriptionNumber: details[i]?.number ?? 0,
      inscribedInBlock: details[i]?.height ?? null,
      timestamp: details[i]?.timestamp ?? null,
      contentType: (details[i]?.content_type ?? null) as string | null,
      parcelIndex: null,
    })),
  };
}
