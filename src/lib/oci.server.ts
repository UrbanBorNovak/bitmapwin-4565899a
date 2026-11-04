import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  LEGACY_SAT_INDICES,
  MAX_BITMAP,
  OCI_PAGES,
  PAGE9_START,
  PAGE10_START,
  PAGE_SIZE,
  isValidClaimContent,
  pageForBitmap,
  type BitmapIndexEntry,
} from "@/lib/oci";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function db() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function ordFetch(path: string, attempts = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": UA, accept: "*/*" },
      });
      if (resp.ok) return resp;
      if (resp.status === 429 || resp.status === 406 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      lastError = new Error(`HTTP ${resp.status} for ${path}`);
      break;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastError ?? new Error(`failed ${path}`);
}

type DecodedPage = { sats: number[]; satIndices: Record<number, number> };

// Pages are ~2 MB each; keep a couple hot in the worker and rely on the
// database cache for everything already resolved.
const pageCache = new Map<number, DecodedPage>();
const pageInflight = new Map<number, Promise<DecodedPage>>();

function undelta(deltas: number[]): number[] {
  const out = new Array<number>(deltas.length);
  for (let i = 0; i < deltas.length; i++) {
    out[i] = i === 0 ? deltas[i]! : out[i - 1]! + deltas[i]!;
  }
  return out;
}

async function decodePage(page: number): Promise<DecodedPage> {
  const resp = await ordFetch(`/content/${OCI_PAGES[page]}`);
  const raw = await resp.text();

  if (page === 9 || page === 10) {
    const data = JSON.parse(raw) as {
      deltaEncodedSats?: number[];
      satIndexMap?: Record<string, number>;
    };
    const sats = undelta((data.deltaEncodedSats ?? []).map(Number));
    const satIndices: Record<number, number> = {};
    for (const [k, v] of Object.entries(data.satIndexMap ?? {})) {
      satIndices[Number(k)] = Number(v);
    }
    return { sats, satIndices };
  }

  // Pages 0..8 ship as two parallel arrays (delta-encoded sats, then the
  // bitmap offsets they belong to) in a handful of loose JSON shapes, so the
  // integers are read positionally.
  const ints = (raw.match(/-?\d+/g) ?? []).map(Number).filter(Number.isFinite);
  if (ints.length < 2) throw new Error(`OCI page ${page} unreadable`);
  const half = Math.floor(ints.length / 2);
  const full = undelta(ints.slice(0, half));
  const offsets = ints.slice(half);
  const sats = new Array<number>(PAGE_SIZE).fill(0);
  for (let i = 0; i < offsets.length && i < full.length; i++) {
    const off = offsets[i]!;
    if (off >= 0 && off < PAGE_SIZE) sats[off] = full[i]!;
  }
  return { sats, satIndices: {} };
}

async function getPage(page: number): Promise<DecodedPage> {
  const cached = pageCache.get(page);
  if (cached) return cached;
  const inflight = pageInflight.get(page);
  if (inflight) return inflight;
  const task = decodePage(page)
    .then((decoded) => {
      if (pageCache.size >= 3) {
        const oldest = pageCache.keys().next().value;
        if (oldest !== undefined) pageCache.delete(oldest);
      }
      pageCache.set(page, decoded);
      return decoded;
    })
    .finally(() => pageInflight.delete(page));
  pageInflight.set(page, task);
  return task;
}

async function satFor(height: number): Promise<{ sat: number; satIndex: number }> {
  const page = pageForBitmap(height);
  const { sats, satIndices } = await getPage(page);
  const offset =
    page === 10 ? height - PAGE10_START : page === 9 ? height - PAGE9_START : height % PAGE_SIZE;
  const sat = sats[offset] ?? 0;
  const satIndex =
    (height >= PAGE9_START ? satIndices[height] : LEGACY_SAT_INDICES[height]) ?? 0;
  return { sat, satIndex };
}

export async function resolveOne(height: number): Promise<BitmapIndexEntry> {
  const { sat, satIndex } = await satFor(height);
  const base: BitmapIndexEntry = {
    blockHeight: height,
    sat,
    satIndex,
    inscriptionId: null,
    content: null,
    isValid: false,
    genesisHeight: null,
    ownerAddress: null,
    resolvedAt: new Date().toISOString(),
  };
  if (!sat) return base;

  try {
    const atResp = await ordFetch(`/r/sat/${sat}/at/${satIndex}`);
    const at = (await atResp.json()) as { id?: string };
    if (!at.id) return base;
    base.inscriptionId = at.id;

    const contentResp = await ordFetch(`/content/${at.id}`);
    const text = (await contentResp.text()).slice(0, 200);
    base.content = text.trim();
    base.isValid = isValidClaimContent(height, base.content);

    try {
      const infoResp = await ordFetch(`/r/inscription/${at.id}`, 2);
      const info = (await infoResp.json()) as {
        height?: number;
        genesis_height?: number;
        address?: string | null;
      };
      base.genesisHeight = info.genesis_height ?? info.height ?? null;
      base.ownerAddress = info.address ?? null;
    } catch {
      // metadata endpoint is optional; the claim itself is already resolved
    }
  } catch {
    // leave the entry unresolved so it can be retried later
  }
  return base;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

type Row = Database["public"]["Tables"]["bitmap_index"]["Row"];

function rowToEntry(row: Row): BitmapIndexEntry {
  return {
    blockHeight: Number(row.block_height),
    sat: Number(row.sat),
    satIndex: row.sat_index,
    inscriptionId: row.inscription_id,
    content: row.content,
    isValid: row.is_valid,
    genesisHeight: row.genesis_height === null ? null : Number(row.genesis_height),
    ownerAddress: row.owner_address,
    resolvedAt: row.resolved_at,
  };
}

export async function persist(entries: BitmapIndexEntry[]) {
  if (entries.length === 0) return;
  const client = db();
  await client.from("bitmap_index").upsert(
    entries.map((e) => ({
      block_height: e.blockHeight,
      sat: e.sat,
      sat_index: e.satIndex,
      inscription_id: e.inscriptionId,
      content: e.content,
      is_valid: e.isValid,
      genesis_height: e.genesisHeight,
      owner_address: e.ownerAddress,
      resolved_at: e.resolvedAt ?? new Date().toISOString(),
    })),
    { onConflict: "block_height" },
  );
}

/**
 * Registry read model: cached rows come from the database, anything missing is
 * resolved from the on-chain index and written back.
 */
export async function getRegistryRange(
  start: number,
  count: number,
  resolveLimit = 40,
): Promise<{ entries: BitmapIndexEntry[]; resolved: number; pending: number }> {
  const from = Math.max(0, Math.min(start, MAX_BITMAP));
  const to = Math.min(MAX_BITMAP, from + count - 1);
  const heights: number[] = [];
  for (let h = from; h <= to; h++) heights.push(h);

  const client = db();
  const { data, error } = await client
    .from("bitmap_index")
    .select("*")
    .gte("block_height", from)
    .lte("block_height", to);
  if (error) throw new Error(error.message);

  const known = new Map<number, BitmapIndexEntry>();
  for (const row of data ?? []) known.set(Number(row.block_height), rowToEntry(row));

  const missing = heights.filter((h) => {
    const hit = known.get(h);
    return !hit || hit.inscriptionId === null;
  });
  const batch = missing.slice(0, resolveLimit);
  if (batch.length > 0) {
    const resolved = await mapWithConcurrency(batch, 6, resolveOne);
    await persist(resolved);
    for (const entry of resolved) known.set(entry.blockHeight, entry);
  }

  return {
    entries: heights.map(
      (h) =>
        known.get(h) ?? {
          blockHeight: h,
          sat: 0,
          satIndex: 0,
          inscriptionId: null,
          content: null,
          isValid: false,
          genesisHeight: null,
          ownerAddress: null,
          resolvedAt: null,
        },
    ),
    resolved: batch.length,
    pending: Math.max(0, missing.length - batch.length),
  };
}

/** Single bitmap lookup, resolving on demand. */
export async function getRegistryEntry(height: number): Promise<BitmapIndexEntry> {
  const client = db();
  const { data } = await client
    .from("bitmap_index")
    .select("*")
    .eq("block_height", height)
    .maybeSingle();
  if (data && data.inscription_id) return rowToEntry(data);
  const entry = await resolveOne(height);
  await persist([entry]);
  return entry;
}

/** Registry-wide counters straight from the cached index. */
export async function getRegistryStats() {
  const client = db();
  const [indexed, valid] = await Promise.all([
    client.from("bitmap_index").select("*", { count: "exact", head: true }),
    client.from("bitmap_index").select("*", { count: "exact", head: true }).eq("is_valid", true),
  ]);
  return {
    indexed: indexed.count ?? 0,
    valid: valid.count ?? 0,
    universe: MAX_BITMAP + 1,
  };
}
