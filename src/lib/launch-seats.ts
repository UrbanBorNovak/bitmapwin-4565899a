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
  ticketId?: string | null;
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

type ScannedInscription = { id: string; bitmapHeight: number | null };

/** Avatar for a seat from a wallet scan: the first held BITMAP Pixel wins, else the address's assigned Pixel; the first held BITMAP is raised as a flag. */
export function seatAvatarFrom(address: string, inscriptions: ScannedInscription[]) {
  const pixelIds = new Set(PIXELS.map((p) => p.id));
  const pixel = inscriptions.find((i) => pixelIds.has(i.id));
  const bitmap = inscriptions.find((i) => i.bitmapHeight !== null);
  return {
    pixelId: pixel?.id ?? assignedPixel(address),
    pixelSource: (pixel ? "held" : "assigned") as "held" | "assigned",
    heldBitmap: bitmap?.bitmapHeight ?? null,
  };
}

/** Returning Bitmapper: a successful scan replaces the avatar and flag; a failed scan (null) keeps them. Seat number never changes. */
export function refreshedAvatar(
  current: { pixelId: string; pixelSource: "held" | "assigned"; heldBitmap: number | null },
  address: string,
  scan: ScannedInscription[] | null,
) {
  return scan ? seatAvatarFrom(address, scan) : current;
}

/** Founders Row: the first 100 seats. */
export const FOUNDERS_ROW = 100;
export const VIP_GLASS_MS = 10 * 60 * 1000;

export function loungeMessage(address: string, issuedAt: string): string {
  return [
    "BITMAPWIN BACKSTAGE — OPEN THE VIP LOUNGE",
    `ADDRESS: ${address}`,
    `ISSUED: ${issuedAt}`,
    "THIS SIGNATURE MOVES NO FUNDS AND COSTS NO FEE.",
  ].join("\n");
}

/** The lounge opens only for a wallet that already holds a seat. */
export function loungeSeat(seats: { seat: number; address: string }[], address: string) {
  const a = address.trim().toLowerCase();
  return seats.find((s) => s.address.toLowerCase() === a) ?? null;
}

export function foundersOf<T extends { seat: number }>(seats: T[]): T[] {
  return seats.filter((s) => s.seat <= FOUNDERS_ROW).sort((a, b) => a.seat - b.seat);
}

export function backchannelMessage(address: string, issuedAt: string): string {
  return [
    "BITERNAM BATCAVE — OPEN DEV9'S BACKCHANNEL",
    `ADDRESS: ${address}`,
    `ISSUED: ${issuedAt}`,
    "THIS SIGNATURE MOVES NO FUNDS AND COSTS NO FEE.",
  ].join("\n");
}
