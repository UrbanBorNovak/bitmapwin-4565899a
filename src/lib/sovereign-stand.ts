/**
 * BW-STAND-1: an open Grandstand protocol. A community inscribes a small JSON
 * config; the inscription id is the stand's permanent identity. Seats are free
 * BIP-322 signatures from wallets that hold a BITMAP (optionally in a height
 * range). Every seat keeps its signature so any indexer can re-verify it.
 */
export const STAND_PROTOCOL = "BW-STAND-1";
export const STAND_ID = /^[0-9a-f]{64}i\d+$/;

export type StandConfig = {
  p: typeof STAND_PROTOCOL;
  name: string;
  host?: string | undefined;
  bitmap?: { min?: number | undefined; max?: number | undefined } | undefined;
  jumbotron?: string[] | undefined;
};

/** Strictly parses a BW-STAND-1 inscription body; anything else is not a stand. */
export function parseStandConfig(raw: unknown): StandConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r["p"] !== STAND_PROTOCOL || typeof r["name"] !== "string" || !r["name"].trim()) return null;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
  const b = r["bitmap"] && typeof r["bitmap"] === "object" ? (r["bitmap"] as Record<string, unknown>) : null;
  const jumbo = Array.isArray(r["jumbotron"]) ? r["jumbotron"].filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 120)) : undefined;
  return {
    p: STAND_PROTOCOL,
    name: r["name"].trim().slice(0, 60),
    host: typeof r["host"] === "string" ? r["host"].slice(0, 60) : undefined,
    bitmap: b ? { min: int(b["min"]), max: int(b["max"]) } : undefined,
    jumbotron: jumbo,
  };
}

/** The JSON a community inscribes to create its stand. */
export function standConfigJson(c: Omit<StandConfig, "p">): string {
  return JSON.stringify({ p: STAND_PROTOCOL, ...c });
}

export function standMessage(standId: string, address: string, issuedAt: string): string {
  return [
    `${STAND_PROTOCOL} — TAKE MY SEAT`,
    `STAND: ${standId}`,
    `ADDRESS: ${address}`,
    `ISSUED: ${issuedAt}`,
    "THIS SIGNATURE MOVES NO FUNDS AND COSTS NO FEE.",
  ].join("\n");
}

/** First held BITMAP inside the stand's height range, or null (no BITMAP = no seat). */
export function qualifyingBitmap(c: StandConfig, heights: number[]): number | null {
  const min = c.bitmap?.min ?? 0, max = c.bitmap?.max ?? Infinity;
  return heights.filter((h) => h >= min && h <= max).sort((a, b) => a - b)[0] ?? null;
}

export const CONVENTION_TIERS = [
  { stands: 10, name: "CONVENTION LEGEND" },
  { stands: 5, name: "CIRCUIT REGULAR" },
  { stands: 3, name: "DELEGATE" },
] as const;

/** Convention Badge tier from the number of distinct stands a wallet is seated in. */
export function conventionTier(stands: number) {
  return CONVENTION_TIERS.find((t) => stands >= t.stands) ?? null;
}
