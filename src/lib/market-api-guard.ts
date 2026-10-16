/**
 * Pure rules for the public trading API. Signed API messages carry an issued
 * time so a captured signature dies after SIGNATURE_TTL_MS, and the server also
 * stores each signature once so it can never be replayed inside that window.
 */

export const SIGNATURE_TTL_MS = 10 * 60_000;
/** Clock skew tolerated for signatures dated slightly in the future. */
export const FUTURE_SKEW_MS = 60_000;
export const MAX_LIVE_HOLDS_PER_BUYER = 2;

export const RATE_LIMITS = {
  readPerIp: { limit: 120, windowSeconds: 60 },
  writePerIp: { limit: 20, windowSeconds: 60 },
  writePerWallet: { limit: 10, windowSeconds: 60 },
  holdPerWallet: { limit: 6, windowSeconds: 60 },
} as const;

export type ApiAction = "BID" | "CANCEL BID" | "UNLIST";

export function apiMessage(action: ApiAction, fields: Record<string, string | number>, issuedAt: string): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return [`BITMAPWIN API ${action}`, ...lines, `issued: ${issuedAt}`].join("\n");
}

export const bidApiMessage = (height: number, priceSats: number, bidder: string, issuedAt: string) =>
  apiMessage("BID", { parcel: `${height}.bitmap`, amount: `${priceSats} sats`, bidder }, issuedAt);
export const cancelBidApiMessage = (bidId: string, address: string, issuedAt: string) =>
  apiMessage("CANCEL BID", { bid: bidId, address }, issuedAt);
export const unlistApiMessage = (offerId: string, address: string, issuedAt: string) =>
  apiMessage("UNLIST", { listing: offerId, address }, issuedAt);

/** Null when the issued time is acceptable, otherwise the reason it is not. */
export function signatureAgeProblem(issuedAt: string, now: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(issuedAt)) return "issuedAt must be an ISO-8601 UTC time";
  const t = Date.parse(issuedAt);
  if (!Number.isFinite(t)) return "issuedAt is not a valid time";
  if (t > now + FUTURE_SKEW_MS) return "issuedAt is in the future";
  if (now - t > SIGNATURE_TTL_MS) return "signature expired — sign a fresh message";
  return null;
}
