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
  gear?: SeatGear[];
  hat?: string | null;
  food?: string | null;
  owned?: string[];
  clubHair?: "marauders" | "emporium" | null;
  clubProof?: string | null;
};

/** Provenance gear: each piece is earned only by a recorded fact, never chosen. */
export type SeatGear = "ancient" | "founder" | "tamer" | "builder";
export const GEAR_LABEL: Record<SeatGear, string> = {
  ancient: "Explorer goggles · holds a BITMAP under block 100,000",
  founder: "Marauder visor · Founders Row seat 1–100",
  tamer: "Guardian companion · summoned a Guardian",
  builder: "Hard hat · published a Forge piece",
};
export function seatGear(seat: number, heldBitmap: number | null, tamer: boolean, builder: boolean): SeatGear[] {
  const g: SeatGear[] = [];
  if (heldBitmap !== null && heldBitmap < 100_000) g.push("ancient");
  if (seat >= 1 && seat <= 100) g.push("founder");
  if (tamer) g.push("tamer");
  if (builder) g.push("builder");
  return g;
}

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

/** Hair is earned from the BITMAP club of the flag a Bitmapper holds; no BITMAP = shaved. */
export type HairStyle = "marauder-hawk" | "emporium-bob" | "genesis-crown" | "satoshi-mullet" | "pizza-spikes" | "halving-crop" | "shaved";
export const HAIR_LABEL: Record<HairStyle, string> = {
  "marauder-hawk": "Marauder red mohawk · verified 715093 parcel holder",
  "emporium-bob": "Emporium violet bob · verified 717328 Resident",
  "genesis-crown": "Golden crest · SUB 1K CLUB holder",
  "satoshi-mullet": "Satoshi mullet · SUB 10K CLUB holder",
  "pizza-spikes": "Pizza spikes · SUB 100K CLUB holder",
  "halving-crop": "Halving crop · SUB 1M CLUB holder",
  shaved: "Shaved · no BITMAP held yet",
};
/** Verified club hair (Marauders, then Emporium) wins over the BITMAP-range hair. */
export function hairFor(heldBitmap: number | null, clubHair: "marauders" | "emporium" | null = null): HairStyle {
  if (clubHair === "marauders") return "marauder-hawk";
  if (clubHair === "emporium") return "emporium-bob";
  if (heldBitmap === null) return "shaved";
  if (heldBitmap < 1_000) return "genesis-crown";
  if (heldBitmap < 10_000) return "satoshi-mullet";
  if (heldBitmap < 100_000) return "pizza-spikes";
  return "halving-crop";
}

/** Grandstand wardrobe: bought once with BIT, the newest piece per slot is worn. */
export const WEAR_SHOP = [
  { id: "top-hat", slot: "hat", name: "Top hat", price: 150 },
  { id: "cowboy", slot: "hat", name: "Cowboy hat", price: 120 },
  { id: "beanie", slot: "hat", name: "Orange beanie", price: 60 },
  { id: "crown", slot: "hat", name: "Block crown", price: 500 },
  { id: "pizza", slot: "food", name: "Pizza slice", price: 25 },
  { id: "coffee", slot: "food", name: "Café coffee", price: 15 },
  { id: "donut", slot: "food", name: "Donut", price: 20 },
] as const;
export type WearItem = (typeof WEAR_SHOP)[number]["id"];
export const wearById = (id: string) => WEAR_SHOP.find((w) => w.id === id) ?? null;
/** Newest bought piece per slot from rows sorted newest first. */
export function wornFrom(rows: { slot: string; item: string }[]) {
  return { hat: rows.find((r) => r.slot === "hat")?.item ?? null, food: rows.find((r) => r.slot === "food")?.item ?? null };
}
