import { PIXELS } from "@/lib/bitmap-pixels-catalog";

/** Launch Grandstand rules shared by the page and the server. */
export const LAUNCH_TIERS = [
  { seats: 100, name: "FOUNDERS ROW", perk: "Founding Bitmapper badge" },
  { seats: 500, name: "FULL HOUSE", perk: "Grandstand blueprint drop" },
  { seats: 1000, name: "IGNITION", perk: "Launch night in the Oasis" },
] as const;
export const LAUNCH_CAPACITY = 1000;
export const SEAT_MESSAGE_TTL_MS = 10 * 60 * 1000;

export type LaunchSeat = {
  seat: number;
  address: string;
  pixelId: string;
  pixelSource: "held" | "assigned";
  heldBitmap: number | null;
  createdAt: string;
};

export function seatMessage(address: string, issuedAt: string): string {
  return [
    "BITMAPWIN LAUNCH — TAKE MY SEAT",
    `ADDRESS: ${address}`,
    `ISSUED: ${issuedAt}`,
    "THIS SIGNATURE MOVES NO FUNDS AND COSTS NO FEE.",
  ].join("\n");
}

/** Next tier still to reach, or null when every tier is unlocked. */
export function nextTier(count: number) {
  return LAUNCH_TIERS.find((t) => count < t.seats) ?? null;
}

/** Deterministic Pixel for a wallet with no Pixel of its own (FNV-1a of the address). */
export function assignedPixel(address: string): string {
  let h = 0x811c9dc5;
  for (const c of address.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return PIXELS[h % PIXELS.length]!.id;
}

/** Row & column on the grandstand: row r holds 12 + 2r seats. */
export function seatPlace(seat: number): { row: number; col: number; perRow: number } {
  let n = seat - 1;
  let row = 0;
  while (n >= 12 + 2 * row) { n -= 12 + 2 * row; row++; }
  return { row, col: n, perRow: 12 + 2 * row };
}
