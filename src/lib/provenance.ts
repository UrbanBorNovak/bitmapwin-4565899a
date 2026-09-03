import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchTradesForHeight, type TradeRow } from "@/lib/trade-store";

/**
 * Provenance read model for a single bitmap. Every field comes from real
 * indexed on-chain data or real tracked visits — when a metric cannot be
 * backed by a record it is reported as unknown, never estimated.
 */

export type VerificationStatus = "verified" | "pending" | "unverifiable";

export type OwnerHistory = {
  address: string;
  /** Paid sales where this address was the seller. */
  salesMade: number;
  /** Paid sales where this address was the buyer. */
  purchases: number;
  /** Total sats received across those sales. */
  volumeSats: number;
  /** Distinct bitmaps this address has touched in a traced transfer. */
  bitmaps: number;
};

export type Provenance = {
  height: number;
  verification: VerificationStatus;
  verificationNote: string;
  inscriptionId: string | null;
  /** Later duplicate claims for the same height (invalid under bitmap theory). */
  duplicateClaims: number;
  transfers: number;
  paidSales: number;
  lastTransferAt: string | null;
  lastSaleAt: string | null;
  lastSaleSats: number | null;
  firstSeenAt: string | null;
  totalViews: number | null;
  lastViewedAt: string | null;
  owner: OwnerHistory | null;
};

async function fetchIndexRow(height: number) {
  const { data } = await supabase
    .from("bitmap_index")
    .select("inscription_id, is_valid, owner_address, resolved_at")
    .eq("block_height", height)
    .maybeSingle();
  return data ?? null;
}

async function fetchClaimCount(height: number) {
  const { data } = await supabase
    .from("inscriptions")
    .select("id, created_at")
    .eq("is_bitmap_claim", true)
    .eq("bitmap_height", height)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function fetchViewStats(height: number) {
  const { data } = await supabase
    .from("bitmap_view_stats")
    .select("total_views, last_viewed_at")
    .eq("bitmap_height", height)
    .maybeSingle();
  return data ?? null;
}

async function fetchOwnerHistory(address: string | null): Promise<OwnerHistory | null> {
  if (!address) return null;
  const { data } = await supabase
    .from("trades")
    .select("bitmap_height, price_sats, seller_address, buyer_address")
    .or(`seller_address.eq.${address},buyer_address.eq.${address}`)
    .limit(1000);
  const rows = data ?? [];
  if (rows.length === 0) {
    return { address, salesMade: 0, purchases: 0, volumeSats: 0, bitmaps: 0 };
  }
  let salesMade = 0;
  let purchases = 0;
  let volumeSats = 0;
  const heights = new Set<number>();
  for (const row of rows) {
    const price = Number(row.price_sats ?? 0);
    heights.add(row.bitmap_height);
    if (row.seller_address === address && price > 0) {
      salesMade += 1;
      volumeSats += price;
    }
    if (row.buyer_address === address && price > 0) purchases += 1;
  }
  return { address, salesMade, purchases, volumeSats, bitmaps: heights.size };
}

function summariseTrades(rows: TradeRow[]) {
  const sorted = [...rows].sort((a, b) => a.hop - b.hop);
  const paid = sorted.filter((r) => r.price_sats > 0);
  const last = sorted[sorted.length - 1] ?? null;
  const lastPaid = paid[paid.length - 1] ?? null;
  const stamp = (row: TradeRow | null) => row?.block_time ?? row?.created_at ?? null;
  return {
    transfers: sorted.length,
    paidSales: paid.length,
    lastTransferAt: stamp(last),
    lastSaleAt: stamp(lastPaid),
    lastSaleSats: lastPaid ? lastPaid.price_sats : null,
    latestOwner: last?.buyer_address ?? null,
  };
}

export async function fetchProvenance(
  height: number,
  ownerAddress: string | null,
): Promise<Provenance> {
  const [indexRow, claims, views, trades] = await Promise.all([
    fetchIndexRow(height).catch(() => null),
    fetchClaimCount(height).catch(() => []),
    fetchViewStats(height).catch(() => null),
    fetchTradesForHeight(height).catch(() => [] as TradeRow[]),
  ]);

  const summary = summariseTrades(trades);
  const inscriptionId = indexRow?.inscription_id ?? null;

  let verification: VerificationStatus = "pending";
  let verificationNote = "NO INSCRIPTION RESOLVED FROM THE ORDINALS INDEX YET";
  if (indexRow && indexRow.is_valid === false) {
    verification = "unverifiable";
    verificationNote = "THE INDEXED CLAIM FOR THIS BLOCK IS NOT A VALID BITMAP";
  } else if (inscriptionId) {
    verification = "verified";
    verificationNote = "FIRST VALID INSCRIPTION FOR THIS BLOCK, RESOLVED FROM THE ORDINALS INDEX";
  } else if (claims.length > 0) {
    verification = "pending";
    verificationNote = "CLAIM DECODED FROM CHAIN DATA — AWAITING ORDINALS INDEX RESOLUTION";
  }

  const resolvedOwner = ownerAddress ?? summary.latestOwner ?? indexRow?.owner_address ?? null;

  return {
    height,
    verification,
    verificationNote,
    inscriptionId,
    duplicateClaims: Math.max(0, claims.length - 1),
    transfers: summary.transfers,
    paidSales: summary.paidSales,
    lastTransferAt: summary.lastTransferAt,
    lastSaleAt: summary.lastSaleAt,
    lastSaleSats: summary.lastSaleSats,
    firstSeenAt: claims[0]?.created_at ?? indexRow?.resolved_at ?? null,
    totalViews: views ? Number(views.total_views) : null,
    lastViewedAt: views?.last_viewed_at ?? null,
    owner: await fetchOwnerHistory(resolvedOwner).catch(() => null),
  };
}

export const provenanceQuery = (height: number, ownerAddress: string | null) =>
  queryOptions({
    queryKey: ["provenance", height, ownerAddress],
    queryFn: () => fetchProvenance(height, ownerAddress),
    staleTime: 60_000,
  });

/**
 * 0–100 score built only from facts we hold: verification, traced transfer
 * history, real paid sales and the holder's own traced track record.
 */
export function provenanceScore(p: Provenance): { score: number; grade: string } {
  let score = 0;
  if (p.verification === "verified") score += 45;
  else if (p.verification === "pending") score += 15;
  if (p.duplicateClaims === 0 && p.verification === "verified") score += 5;

  if (p.transfers > 0) score += 10;
  if (p.paidSales > 0) score += 15;
  if (p.paidSales > 2) score += 5;

  const owner = p.owner;
  if (owner) {
    if (owner.salesMade > 0) score += 10;
    if (owner.salesMade > 3) score += 5;
    if (owner.bitmaps > 1) score += 5;
  }

  score = Math.min(100, score);
  const grade = score >= 80 ? "STRONG" : score >= 55 ? "SOLID" : score >= 30 ? "THIN" : "UNPROVEN";
  return { score, grade };
}
