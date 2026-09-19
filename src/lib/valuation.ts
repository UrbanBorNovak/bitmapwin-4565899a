/**
 * Types and client helpers for the BITMAP VALUATION INDEX.
 *
 * The index is recursive-only: every number comes from ord recursive
 * endpoints (`/r/*`) and inscription content (`/content/*`). Nothing is
 * sourced from an off-chain index or made up.
 */

export const VALUATION_MODEL = "BVI-4.0-RECURSIVE";

export type VFactor = { label: string; weight: number; score: number };

export type VNode = {
  id: string;
  number: number | null;
  depth: number;
  height: number | null;
  timestamp: number | null;
  contentType: string;
  size: number | null;
  fee: number | null;
  address: string | null;
  sat: string | null;
  rarity: string;
  parents: number;
  protocol: string;
  ok: boolean;
  body: string;
  category: string;
};

export type ValuationReport = {
  model: string;
  scannedAt: number;
  height: number;
  claimId: string | null;
  full: boolean;
  tip: { height: number | null; hash: string | null; time: number | null };
  land: {
    height: number | null;
    hash: string | null;
    txCount: number | null;
    totalFee: number | null;
    subsidy: number | null;
    timestamp: number | null;
  } | null;
  hashMatch: boolean | null;
  claim: { body: string; ok: boolean; after: boolean };
  score: number;
  confidence: number;
  factors: VFactor[];
  counts: {
    nodes: number;
    edges: number;
    depth: number;
    parcels: number;
    validParcels: number;
    blocks: number;
    txs: number;
    categories: string[];
    capped: boolean;
  };
  holders: { address: string; count: number }[];
  gini: number;
  hhi: number;
  recency: number;
  lineage: string[];
  parents: string[];
  charms: { name: string; count: number }[];
  geology: {
    ranges: number;
    sats: string;
    uncommon: string;
    rare: string;
    epic: string;
    legendary: string;
  };
  utxo: {
    outputs: number;
    verified: number;
    unverified: number;
    totalSats: number;
    coloc: number;
    runeKinds: number;
  };
  runes: { name: string; amount: number; symbol: string | null; divisibility: number | null }[];
  envelopes: { txid: string; contentType: string; metaprotocol: string }[];
  metadata: { id: string; json: string }[];
  timeline: { height: number; timestamp: number; fee: number; size: number }[];
  featured: { label: string; id: string; number: number | null; contentType: string; depth: number }[];
  nodes: VNode[];
  economics: { feeMass: number; subsidy: number | null; feeToSubsidy: number | null };
  errors: string[];
};

export const V_CATEGORIES = [
  "ALL",
  "APPLICATION",
  "CODE",
  "DATA",
  "MEDIA",
  "DOCUMENT",
  "PARCEL",
  "VALID-PARCEL",
  "DISTRICT",
  "OTHER",
] as const;

export const ORD_BASE = "https://ordinals.com";

export function scoreTier(score: number): { label: string; thesis: string } {
  if (score >= 80)
    return {
      label: "PROVEN DISTRICT",
      thesis: "Hard checks pass and the district is genuinely developed on chain.",
    };
  if (score >= 60)
    return { label: "STRONG", thesis: "Claim verifies and real structure has been built on it." };
  if (score >= 40)
    return { label: "DEVELOPING", thesis: "Valid land with early structure — room to build." };
  if (score >= 20)
    return { label: "RAW LAND", thesis: "Claim reads as land but almost nothing is built yet." };
  return { label: "UNVERIFIED", thesis: "Hard checks did not pass with the data read from chain." };
}

export const fmtNum = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-US");

export const fmtBtc = (sats: number | null | undefined) =>
  sats == null || Number.isNaN(sats) ? "—" : (sats / 1e8).toFixed(sats >= 1e6 ? 4 : 6);

export const shortHash = (s: string | null | undefined, n = 6) =>
  !s ? "—" : s.length <= n * 2 + 3 ? s : `${s.slice(0, n)}…${s.slice(-n)}`;

export function nodeMatches(
  node: VNode,
  category: string,
  depth: string,
  search: string,
): boolean {
  if (category !== "ALL") {
    if (category === "VALID-PARCEL") {
      if (node.protocol !== "PARCEL" || !node.ok) return false;
    } else if (category === "PARCEL" || category === "DISTRICT") {
      if (node.protocol !== category) return false;
    } else if (node.category !== category) return false;
  }
  if (depth !== "" && String(node.depth) !== depth) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [node.id, node.address, node.contentType, String(node.number), node.body]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}
