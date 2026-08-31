import { queryOptions } from "@tanstack/react-query";
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

export type ParcelStatus = "sold" | "held" | "unclaimed";

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
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
  const [trades, owners] = await Promise.all([
    fetchTradesForHeights(heights).catch(() => [] as TradeRow[]),
    getBitmapOwners({ data: { txids: claims.slice(0, 60).map((c) => c.row.txid) } }).catch(
      () => [] as Array<{ txid: string; address: string | null; transfers: number }>,
    ),
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
      status: sale ? "sold" : "held",
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
