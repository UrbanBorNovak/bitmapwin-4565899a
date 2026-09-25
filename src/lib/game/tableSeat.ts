import type { PlayProfile } from "./types";
import type { SideId } from "./engine";

/** Seat keys for head-to-head tables (per browser; the server holds only a hash). */
export type Seat = { token: string; seat: SideId; entrant?: number };
const KEY = "bitmapwin.play.seats.v1";

function all(): Record<string, Seat> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Seat>; } catch { return {}; }
}
export function readSeat(code: string): Seat | null { return all()[code] ?? null; }
export function saveSeat(code: string, seat: Seat) {
  const a = all(); a[code] = seat;
  const keys = Object.keys(a); if (keys.length > 20) delete a[keys[0]!];
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ }
}
export function deckHeights(p: PlayProfile): number[] {
  const ids = p.order.filter((id) => p.cards[id]);
  const lead = p.selectedBitmap !== null ? `bitmap-${p.selectedBitmap}` : null;
  const sorted = lead && p.cards[lead] ? [lead, ...ids.filter((x) => x !== lead)] : ids;
  return sorted.slice(0, 12).map((id) => p.cards[id]!.bitmap);
}
export function seatName(p: PlayProfile) {
  return p.owner === "guest" ? "A TRAVELLER" : `${p.owner.slice(0, 6)}…${p.owner.slice(-4)}`;
}
