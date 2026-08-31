import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBitmapOwners } from "@/lib/ordinals-scan.functions";
import type { BitmapStatus } from "@/lib/bitmap";

/**
 * Marketplace read model: real on-chain bitmap claims from the inscription
 * registry, joined with the market layer (listings / prices) and with the
 * present holder resolved from the chain.
 */

export type RegistryParcel = {
  bitmapHeight: number;
  inscriptionId: string;
  txid: string;
  /** Block the claim was inscribed in (not the parcel itself). */
  inscribedInBlock: number | null;
  inscribedAt: string;
  ownerAddress: string | null;
  transfers: number;
  priceBtc: number | null;
  listed: boolean;
  status: BitmapStatus;
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

type MarketRow = { block_height: number; price_btc: number | null; status: string };

async function fetchMarket(heights: number[]): Promise<Map<number, MarketRow>> {
  const map = new Map<number, MarketRow>();
  if (heights.length === 0) return map;
  const { data, error } = await supabase
    .from("bitmaps")
    .select("block_height, price_btc, status")
    .in("block_height", heights);
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.block_height, {
      block_height: row.block_height,
      price_btc: row.price_btc === null ? null : Number(row.price_btc),
      status: row.status,
    });
  }
  return map;
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

async function buildParcels(rows: ClaimRow[]): Promise<RegistryParcel[]> {
  const claims = dedupeClaims(rows);
  if (claims.length === 0) return [];

  const heights = claims.map((c) => c.row.bitmap_height!);
  const [market, owners] = await Promise.all([
    fetchMarket(heights).catch(() => new Map<number, MarketRow>()),
    getBitmapOwners({ data: { txids: claims.slice(0, 60).map((c) => c.row.txid) } }).catch(
      () => [] as Array<{ txid: string; address: string | null; transfers: number }>,
    ),
  ]);
  const ownerByTxid = new Map(owners.map((o) => [o.txid, o]));

  return claims.map(({ row, supersedes }) => {
    const height = row.bitmap_height!;
    const listing = market.get(height);
    const owner = ownerByTxid.get(row.txid);
    const listed = listing?.status === "for_sale" && listing.price_btc !== null;
    return {
      bitmapHeight: height,
      inscriptionId: row.id,
      txid: row.txid,
      inscribedInBlock: row.block_height,
      inscribedAt: row.created_at,
      ownerAddress: owner?.address ?? null,
      transfers: owner?.transfers ?? 0,
      priceBtc: listed ? listing!.price_btc : null,
      listed: Boolean(listed),
      status: listed ? "for_sale" : "owned",
      supersedes,
    } satisfies RegistryParcel;
  });
}

export async function fetchRegistryParcels(limit = 300): Promise<RegistryParcel[]> {
  return buildParcels(await fetchClaimRows(limit));
}

export async function fetchRegistryParcel(block: number): Promise<RegistryParcel | null> {
  const parcels = await buildParcels(await fetchClaimRows(20, block));
  return parcels[0] ?? null;
}

export const registryParcelsQuery = (limit = 300) =>
  queryOptions({
    queryKey: ["registry", "parcels", limit],
    queryFn: () => fetchRegistryParcels(limit),
    staleTime: 60_000,
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
