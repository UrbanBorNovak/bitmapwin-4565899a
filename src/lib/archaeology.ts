import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ArchaeologyNomination = {
  id: string;
  traitId: string;
  bitmapHeight: number;
  inscriptionId: string;
  thesis: string;
  evidenceUrl: string;
  contributorName: string;
  status: "pending" | "accepted" | "rejected";
  reviewNote: string | null;
  featuredPosition: number | null;
  createdAt: string;
  reviewedAt: string | null;
};

function mapNomination(row: {
  id: string; trait_id: string; bitmap_height: number; inscription_id: string;
  thesis: string; evidence_url: string; contributor_name: string; status: string;
  review_note: string | null; featured_position: number | null; created_at: string;
  reviewed_at: string | null;
}): ArchaeologyNomination {
  return {
    id: row.id,
    traitId: row.trait_id,
    bitmapHeight: Number(row.bitmap_height),
    inscriptionId: row.inscription_id,
    thesis: row.thesis,
    evidenceUrl: row.evidence_url,
    contributorName: row.contributor_name,
    status: row.status as ArchaeologyNomination["status"],
    reviewNote: row.review_note,
    featuredPosition: row.featured_position,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export async function fetchArchaeologyNominations(traitId: string): Promise<ArchaeologyNomination[]> {
  const { data, error } = await supabase
    .from("bitmap_archaeology_nominations")
    .select("id, trait_id, bitmap_height, inscription_id, thesis, evidence_url, contributor_name, status, review_note, featured_position, created_at, reviewed_at")
    .eq("trait_id", traitId)
    .order("featured_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNomination);
}

export const archaeologyNominationsQuery = (traitId: string) => queryOptions({
  queryKey: ["bitmap-archaeology", traitId],
  queryFn: () => fetchArchaeologyNominations(traitId),
  staleTime: 30_000,
});