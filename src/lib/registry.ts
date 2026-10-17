import { queryOptions } from "@tanstack/react-query";
import { MAX_BITMAP } from "@/lib/oci";
import { heightTraitQuery } from "@/lib/traits";
import { supabase } from "@/integrations/supabase/client";
import { getBitmapOwners } from "@/lib/ordinals-scan.functions";
import {
  fetchTradesForHeights,
  latestByHeight,
  latestSaleByHeight,
  type TradeRow,
} from "@/lib/trade-store";
import { satsToBtc } from "@/lib/trades";

/**
 * Marketplace read model: real on-chain bitmap claims from the inscription
 * registry, joined with the trades traced from Bitcoin transactions. Price,
 * status and holder all come from the chain — there is no mock market layer.
 */

export type ParcelStatus = "listed" | "sold" | "held" | "unclaimed";

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
  listed: "LISTED",
  sold: "SOLD ON CHAIN",
  held: "HELD",
  unclaimed: "UNCLAIMED",
};

export type RegistryParcel = {
  bitmapHeight: number;
  inscriptionId: string;
  txid: string;
  /** Block the claim was inscribed in (not the parcel itself). */
  inscribedInBlock: number | null;
  inscribedAt: string;
  ownerAddress: string | null;
  transfers: number;
  /** Last price actually paid on chain, in BTC. */
  priceBtc: number | null;
  lastSaleSats: number | null;
  lastSaleTxid: string | null;
  lastSaleBlock: number | null;
  lastSaleAt: string | null;
  traded: boolean;
  status: ParcelStatus;
  /** Asking price of the cheapest open PSBT offer for this parcel, in sats. */
  listedSats: number | null;
  /** Id of that open offer, so a buyer can claim it. */
  listedOfferId: string | null;
  /** Address the seller delivered that PSBT to, when it is a private sale. */
  listedBuyerAddress: string | null;
  /** A later claim for the same height exists — invalid under bitmap theory. */
  supersedes: number;
};

type ClaimRow = {
  id: string;
  txid: string;
  block_height: number | null;
  bitmap_height: number | null;
  created_at: string;
};

async function fetchClaimRows(limit: number, block?: number): Promise<ClaimRow[]> {
  let query = supabase
    .from("inscriptions")
    .select("id, txid, block_height, bitmap_height, created_at")
    .eq("is_bitmap_claim", true);
  if (block !== undefined) query = query.eq("bitmap_height", block);
  const { data, error } = await query
    .order("bitmap_height", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

/**
 * Claims resolved through the on-chain index (OCI). These are real inscriptions
 * whose content is `<height>.bitmap`, resolved from the indexed satoshi.
 */
async function fetchIndexedClaimRows(limit: number, block?: number): Promise<ClaimRow[]> {
  let query = supabase
    .from("bitmap_index")
    .select("block_height, inscription_id, genesis_height, is_valid, resolved_at")
    .eq("is_valid", true)
    .not("inscription_id", "is", null);
  if (block !== undefined) query = query.eq("block_height", block);
  const { data, error } = await query
    .order("block_height", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    const id = row.inscription_id;
    if (!id) return [];
    const txid = id.split("i")[0] ?? "";
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) return [];
    return [
      {
        id,
        txid,
        block_height: row.genesis_height ?? null,
        bitmap_height: row.block_height,
        created_at: row.resolved_at ?? new Date(0).toISOString(),
      } satisfies ClaimRow,
    ];
  });
}

type OpenListing = { offerId: string; priceSats: number; buyerAddress: string | null };

/**
 * Cheapest open PSBT offer per height. These are real signed seller
 * transactions in the offer book, so they are the live asking prices.
 */
async function fetchOpenListings(heights: number[]): Promise<Map<number, OpenListing>> {
  const map = new Map<number, OpenListing>();
  if (heights.length === 0) return map;
  const { data, error } = await supabase
    .from("offers")
    .select("id, bitmap_height, price_sats, buyer_address")
    .eq("status", "open")
    .in("bitmap_height", heights.slice(0, 400));
  if (error) return map;
  for (const row of data ?? []) {
    const height = row.bitmap_height;
    if (height === null) continue;
    const priceSats = Number(row.price_sats ?? 0);
    const current = map.get(height);
    if (!current || priceSats < current.priceSats) {
      map.set(height, { offerId: row.id, priceSats, buyerAddress: row.buyer_address ?? null });
    }
  }
  return map;
}

/**
 * Claim rows synthesised from open PSBT offers, so a parcel that was just
 * listed shows up on the marketplace even before it lands in the inscription
 * registry or the OCI index.
 */
async function fetchListedClaimRows(block?: number): Promise<ClaimRow[]> {
  let query = supabase
    .from("offers")
    .select("inscription_id, outpoint, bitmap_height, created_at")
    .eq("status", "open");
  if (block !== undefined) query = query.eq("bitmap_height", block);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(400);
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    if (row.bitmap_height === null) return [];
    const id = row.inscription_id ?? `${row.outpoint}`;
    const txid = (row.inscription_id?.split("i")[0] ?? row.outpoint?.split(":")[0] ?? "").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) return [];
    return [
      {
        id,
        txid,
        block_height: null,
        bitmap_height: row.bitmap_height,
        created_at: row.created_at ?? new Date(0).toISOString(),
      } satisfies ClaimRow,
    ];
  });
}

/** Union of extractor-indexed claims, OCI-resolved claims and open listings. */
async function fetchAllClaimRows(limit: number, block?: number): Promise<ClaimRow[]> {
  const [decoded, indexed, listed] = await Promise.all([
    fetchClaimRows(limit, block),
    fetchIndexedClaimRows(limit, block).catch(() => [] as ClaimRow[]),
    fetchListedClaimRows(block).catch(() => [] as ClaimRow[]),
  ]);
  const seen = new Set(decoded.map((r) => r.id));
  const merged = [...decoded, ...indexed.filter((r) => !seen.has(r.id))];
  const heights = new Set(merged.map((r) => r.bitmap_height));
  // Listings only add a row when nothing else claims that height yet.
  return [...merged, ...listed.filter((r) => !heights.has(r.bitmap_height))];
}



/** Earliest inscription per height wins; later ones are counted as superseded. */
function dedupeClaims(rows: ClaimRow[]): Array<{ row: ClaimRow; supersedes: number }> {
  const byHeight = new Map<number, ClaimRow[]>();
  for (const row of rows) {
    if (row.bitmap_height === null) continue;
    const list = byHeight.get(row.bitmap_height);
    if (list) list.push(row);
    else byHeight.set(row.bitmap_height, [row]);
  }
  return [...byHeight.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { row: sorted[0]!, supersedes: sorted.length - 1 };
    })
    .sort((a, b) => (b.row.bitmap_height ?? 0) - (a.row.bitmap_height ?? 0));
}

/**
 * Chain reads must never hold a render hostage: whichever enrichment misses its
 * deadline falls back to the neutral value and the parcel list still renders.
 */
async function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type OwnerRow = { txid: string; address: string | null; transfers: number };

/**
 * Builds the read model. `resolveOwners: false` skips the chain hop-following
 * lookup entirely, so the list renders from database reads only — the page then
 * resolves holders for the visible page with `fetchParcelOwners`.
 */
async function buildParcels(
  rows: ClaimRow[],
  options: { resolveOwners?: boolean } = {},
): Promise<RegistryParcel[]> {
  const claims = dedupeClaims(rows);
  if (claims.length === 0) return [];
  const resolveOwners = options.resolveOwners !== false;

  const heights = claims.map((c) => c.row.bitmap_height!);
  const [trades, owners, listings] = await Promise.all([
    withDeadline(fetchTradesForHeights(heights), 8_000, [] as TradeRow[]),
    resolveOwners
      ? withDeadline(
          getBitmapOwners({ data: { txids: claims.slice(0, 24).map((c) => c.row.txid) } }),
          12_000,
          [] as OwnerRow[],
        )
      : Promise.resolve([] as OwnerRow[]),
    withDeadline(fetchOpenListings(heights), 8_000, new Map<number, OpenListing>()),
  ]);
  const ownerByTxid = new Map(owners.map((o) => [o.txid, o]));

  const tradeCount = new Map<number, number>();
  for (const row of trades) {
    tradeCount.set(row.bitmap_height, (tradeCount.get(row.bitmap_height) ?? 0) + 1);
  }
  const lastMove = latestByHeight(trades);
  const lastSale = latestSaleByHeight(trades);

  return claims.map(({ row, supersedes }) => {
    const height = row.bitmap_height!;
    const chainOwner = ownerByTxid.get(row.txid);
    const move = lastMove.get(height);
    const sale = lastSale.get(height);
    const listing = listings.get(height) ?? null;
    const transfers = tradeCount.get(height) ?? chainOwner?.transfers ?? 0;
    return {
      bitmapHeight: height,
      inscriptionId: row.id,
      txid: row.txid,
      inscribedInBlock: row.block_height,
      inscribedAt: row.created_at,
      ownerAddress: move?.buyer_address ?? chainOwner?.address ?? null,
      transfers,
      priceBtc: satsToBtc(sale?.price_sats ?? null),
      lastSaleSats: sale ? sale.price_sats : null,
      lastSaleTxid: sale?.txid ?? null,
      lastSaleBlock: sale?.block_height ?? null,
      lastSaleAt: sale?.block_time ?? sale?.created_at ?? null,
      traded: transfers > 0,
      status: listing ? "listed" : sale ? "sold" : "held",
      listedSats: listing ? listing.priceSats : null,
      listedOfferId: listing ? listing.offerId : null,
      listedBuyerAddress: listing?.buyerAddress ?? null,
      supersedes,
    } satisfies RegistryParcel;
  });
}

export async function fetchRegistryParcels(limit = 300): Promise<RegistryParcel[]> {
  return buildParcels(await fetchAllClaimRows(limit));
}

/**
 * Database-only registry read: claims, stored trades and open listings. No
 * chain hop-following, so it returns in one round trip and the grid can paint
 * immediately. Holders are filled in per page by `fetchParcelOwners`.
 */
export async function fetchRegistryBase(limit = 300): Promise<RegistryParcel[]> {
  return buildParcels(await fetchAllClaimRows(limit), { resolveOwners: false });
}

/** Resolves current holders on chain for one page of parcels. */
export async function fetchParcelOwners(txids: string[]): Promise<Map<string, OwnerRow>> {
  if (txids.length === 0) return new Map();
  const owners = await withDeadline(
    getBitmapOwners({ data: { txids: txids.slice(0, 40) } }),
    12_000,
    [] as OwnerRow[],
  );
  return new Map(owners.map((o) => [o.txid, o]));
}

export async function fetchRegistryParcel(block: number): Promise<RegistryParcel | null> {
  const parcels = await buildParcels(await fetchAllClaimRows(20, block));
  return parcels[0] ?? null;
}

export const registryParcelsQuery = (limit = 300) =>
  queryOptions({
    queryKey: ["registry", "parcels", limit],
    queryFn: () => fetchRegistryParcels(limit),
    staleTime: 60_000,
  });

export type IndexPageArgs = {
  page: number;
  pageSize: number;
  search: string;
  ascending: boolean;
  trait: string | null;
  /** Explicit height set (e.g. a verified Bitmon shape group), paged in height order. */
  heights?: number[] | null;
};

/**
 * One server-paginated page straight from the full BITMAP index (900k+ rows).
 * Search hits the whole index: a number is an exact height, an inscription id
 * or txid matches its claim, anything else is a holder address. Trait pages
 * come from the official_trait_bitmaps RPC. No full-index count is requested.
 */
export async function fetchRegistryIndexPage(
  args: IndexPageArgs,
): Promise<{ parcels: RegistryParcel[]; total: number | null; hasMore: boolean }> {
  const { page, pageSize, ascending, trait } = args;
  const q = args.search.trim();
  const from = page * pageSize;
  const toRow = (r: { block_height: number; inscription_id: string | null; genesis_height: number | null; resolved_at?: string | null }): ClaimRow[] => {
    const id = r.inscription_id;
    if (!id) return [];
    const txid = id.split("i")[0] ?? "";
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) return [];
    return [{ id, txid, block_height: r.genesis_height ?? null, bitmap_height: r.block_height, created_at: r.resolved_at ?? new Date(0).toISOString() }];
  };

  if (args.heights) {
    const sorted = [...args.heights].sort((a, b) => (ascending ? a - b : b - a));
    const slice = sorted.slice(from, from + pageSize);
    if (slice.length === 0) return { parcels: [], total: sorted.length, hasMore: false };
    const { data, error } = await supabase
      .from("bitmap_index")
      .select("block_height, inscription_id, genesis_height, resolved_at")
      .eq("is_valid", true)
      .not("inscription_id", "is", null)
      .in("block_height", slice);
    if (error) throw error;
    const parcels = await buildParcels((data ?? []).flatMap(toRow), { resolveOwners: false });
    parcels.sort((a, b) => (ascending ? a.bitmapHeight - b.bitmapHeight : b.bitmapHeight - a.bitmapHeight));
    return { parcels, total: sorted.length, hasMore: from + pageSize < sorted.length };
  }

  const heightTrait = trait && !q ? heightTraitQuery(trait, MAX_BITMAP + 100_000) : null;
  if (heightTrait) {
    let hq = supabase
      .from("bitmap_index")
      .select("block_height, inscription_id, genesis_height, resolved_at")
      .eq("is_valid", true)
      .not("inscription_id", "is", null);
    hq = "heights" in heightTrait
      ? hq.in("block_height", heightTrait.heights.length ? heightTrait.heights : [-1])
      : hq.gte("block_height", heightTrait.from).lte("block_height", heightTrait.to);
    const { data, error } = await hq.order("block_height", { ascending }).range(from, from + pageSize);
    if (error) throw error;
    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const parcels = await buildParcels(rows.slice(0, pageSize).flatMap(toRow), { resolveOwners: false });
    parcels.sort((a, b) => (ascending ? a.bitmapHeight - b.bitmapHeight : b.bitmapHeight - a.bitmapHeight));
    return { parcels, total: hasMore ? null : from + rows.length, hasMore };
  }

  if (trait && !q) {
    const { data, error } = await supabase.rpc("official_trait_bitmaps", { p_trait: trait, p_offset: from, p_limit: pageSize });
    if (error) throw error;
    const rows = (data ?? []) as Array<{ block_height: number; inscription_id: string | null; genesis_height: number | null; total_count: number }>;
    const rawTotal = rows[0]?.total_count != null ? Number(rows[0].total_count) : null;
    const total = rawTotal !== null && rawTotal >= 0 ? rawTotal : rows.length ? null : from;
    const parcels = await buildParcels(rows.flatMap(toRow), { resolveOwners: false });
    parcels.sort((a, b) => (ascending ? a.bitmapHeight - b.bitmapHeight : b.bitmapHeight - a.bitmapHeight));
    return { parcels, total, hasMore: total !== null ? from + rows.length < total : rows.length === pageSize };
  }

  let query = supabase
    .from("bitmap_index")
    .select("block_height, inscription_id, genesis_height, resolved_at")
    .eq("is_valid", true)
    .not("inscription_id", "is", null);
  if (q) {
    if (/^\d+$/.test(q)) query = query.eq("block_height", Number(q));
    else if (/^[0-9a-f]{64}i\d+$/i.test(q)) query = query.eq("inscription_id", q.toLowerCase());
    else if (/^[0-9a-f]{64}$/i.test(q)) query = query.like("inscription_id", `${q.toLowerCase()}i%`);
    else query = query.eq("owner_address", q);
  }
  const { data, error } = await query
    .order("block_height", { ascending })
    .range(from, from + pageSize);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const parcels = await buildParcels(rows.slice(0, pageSize).flatMap(toRow), { resolveOwners: false });
  parcels.sort((a, b) => (ascending ? a.bitmapHeight - b.bitmapHeight : b.bitmapHeight - a.bitmapHeight));
  return { parcels, total: q ? (hasMore ? null : from + rows.length) : null, hasMore };
}

export const registryIndexPageQuery = (args: IndexPageArgs) =>
  queryOptions({
    queryKey: ["registry", "index-page", args],
    queryFn: () => fetchRegistryIndexPage(args),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

export const registryBaseQuery = (limit = 300) =>
  queryOptions({
    queryKey: ["registry", "base", limit],
    queryFn: () => fetchRegistryBase(limit),
    staleTime: 60_000,
  });

/** Total valid bitmap claims in the index — a real count, not the loaded page. */
export async function fetchRegistryCount(): Promise<number> {
  const [{ count, error }, { data: top }] = await Promise.all([
    supabase
      .from("bitmap_index")
      .select("block_height", { count: "exact", head: true })
      .eq("is_valid", true),
    // The live resolver caches newest blocks past the inscribed OCI pages.
    supabase
      .from("bitmap_index")
      .select("block_height")
      .not("inscription_id", "is", null)
      .order("block_height", { ascending: false })
      .limit(1),
  ]);
  if (error) throw error;
  // The inscribed OCI is the authoritative complete registry (up to
  // MAX_BITMAP); beyond it the live resolver extends the frontier, so the
  // coverage shown is the highest block the registry can actually resolve.
  const liveFrontier = top?.[0]?.block_height != null ? Number(top[0].block_height) + 1 : 0;
  return Math.max(count ?? 0, MAX_BITMAP + 1, liveFrontier);
}

export const registryCountQuery = () =>
  queryOptions({
    queryKey: ["registry", "count"],
    queryFn: fetchRegistryCount,
    staleTime: 300_000,
  });

export const parcelOwnersQuery = (txids: string[]) =>
  queryOptions({
    queryKey: ["registry", "owners", [...txids].sort().join(",")],
    queryFn: () => fetchParcelOwners(txids),
    staleTime: 120_000,
  });


export const registryParcelQuery = (block: number) =>
  queryOptions({
    queryKey: ["registry", "parcel", block],
    queryFn: () => fetchRegistryParcel(block),
    staleTime: 60_000,
  });

export function shortenAddress(address: string | null): string {
  if (!address) return "UNRESOLVED";
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export type ScopeArgs = {
  /** Finite candidate heights (pattern, built, listed, sold…), or null for a pure range. */
  heights: number[] | null;
  min: number;
  max: number;
  /** Pure-height trait id, intersected server-side. */
  heightTrait: string | null;
  ascending: boolean;
  page: number;
  pageSize: number;
  /** Build every candidate (small sets) so the caller can filter/sort on market data. */
  buildAll: boolean;
};

const SCOPE_BUILD_MAX = 3_000;
const SCOPE_EXACT_RANGE = 120_000;

/**
 * Full-index scope read for combined marketplace filters. Candidates are validated
 * against bitmap_index (valid claims only), so totals are exact claim counts.
 */
export async function fetchRegistryScope(args: ScopeArgs): Promise<{ parcels: RegistryParcel[]; total: number | null; hasMore: boolean; all: boolean }> {
  const { ascending, page, pageSize } = args;
  let min = args.min;
  let max = args.max;
  let heights = args.heights;
  const ht = args.heightTrait ? heightTraitQuery(args.heightTrait, MAX_BITMAP + 100_000) : null;
  if (ht) {
    if ("heights" in ht) heights = heights ? heights.filter((h) => ht.heights.includes(h)) : ht.heights;
    else { min = Math.max(min, ht.from); max = Math.min(max, ht.to); }
  }
  const cols = "block_height, inscription_id, genesis_height, resolved_at";
  const toRow = (r: { block_height: number; inscription_id: string | null; genesis_height: number | null; resolved_at?: string | null }): ClaimRow[] => {
    const id = r.inscription_id;
    if (!id) return [];
    const txid = id.split("i")[0] ?? "";
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) return [];
    return [{ id, txid, block_height: r.genesis_height ?? null, bitmap_height: r.block_height, created_at: r.resolved_at ?? new Date(0).toISOString() }];
  };
  const sortP = (ps: RegistryParcel[]) => ps.sort((a, b) => (ascending ? a.bitmapHeight - b.bitmapHeight : b.bitmapHeight - a.bitmapHeight));

  if (heights === null) {
    if (min > max) return { parcels: [], total: 0, hasMore: false, all: false };
    const exact = max - min <= SCOPE_EXACT_RANGE;
    const from = page * pageSize;
    const { data, error, count } = await supabase
      .from("bitmap_index")
      .select(cols, exact ? { count: "exact" } : undefined)
      .eq("is_valid", true)
      .not("inscription_id", "is", null)
      .gte("block_height", min)
      .lte("block_height", max)
      .order("block_height", { ascending })
      .range(from, from + pageSize);
    if (error) throw error;
    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const parcels = sortP(await buildParcels(rows.slice(0, pageSize).flatMap(toRow), { resolveOwners: false }));
    return { parcels, total: exact ? count ?? null : hasMore ? null : from + rows.length, hasMore, all: false };
  }

  const cand = [...new Set(heights)].filter((h) => h >= min && h <= max);
  const valid: ClaimRow[] = [];
  for (let i = 0; i < cand.length; i += 500) {
    const { data, error } = await supabase.from("bitmap_index").select(cols).eq("is_valid", true).not("inscription_id", "is", null).in("block_height", cand.slice(i, i + 500));
    if (error) throw error;
    for (const r of data ?? []) valid.push(...toRow(r));
  }
  valid.sort((a, b) => (ascending ? a.bitmap_height! - b.bitmap_height! : b.bitmap_height! - a.bitmap_height!));
  if (args.buildAll && valid.length <= SCOPE_BUILD_MAX) {
    const out: RegistryParcel[] = [];
    for (let i = 0; i < valid.length; i += 300) out.push(...(await buildParcels(valid.slice(i, i + 300), { resolveOwners: false })));
    return { parcels: sortP(out), total: valid.length, hasMore: false, all: true };
  }
  const slice = valid.slice(page * pageSize, page * pageSize + pageSize);
  const parcels = sortP(await buildParcels(slice, { resolveOwners: false }));
  return { parcels, total: valid.length, hasMore: (page + 1) * pageSize < valid.length, all: false };
}

export const registryScopeQuery = (args: ScopeArgs) =>
  queryOptions({
    queryKey: ["registry", "scope", { ...args, heights: args.heights ? args.heights.length + ":" + args.heights.slice(0, 50).join(",") + ":" + args.heights.reduce((s, h) => (s * 31 + h) % 1e9, 7) : null, page: args.buildAll ? 0 : args.page }],
    queryFn: () => fetchRegistryScope(args.buildAll ? { ...args, page: 0 } : args),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

/** Every BITMAP height with at least one recorded on-chain move. */
export async function fetchTradedHeights(): Promise<number[]> {
  const out = new Set<number>();
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase.from("trades").select("bitmap_height").order("id").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (r.bitmap_height != null) out.add(Number(r.bitmap_height));
    if (!data || data.length < 1000) break;
  }
  return [...out];
}
