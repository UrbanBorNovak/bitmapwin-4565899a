/** Highland Charge: every seated Bitmapper is a soldier in one army. Pure maths, no React/three. */

export const CHARGE_CYCLE = 14; // seconds per charge loop
export const FIELD_GAP = 70; // distance between the two lines at the start
export const COLS = 24;
export const SPACING = 1.6;
export const RUN_SPEED = 4.2; // world units per second

export type Soldier = { seat: number; x: number; z: number; speed: number; phase: number; hue: number; flag: boolean; founder: boolean };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Seat 1 leads the front rank; ranks fill behind it. Jitter is derived from the wallet address. */
export function formation(seats: { seat: number; address: string; heldBitmap: number | null }[]): Soldier[] {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  return sorted.map((s, i) => {
    const h = hash(s.address);
    const rank = Math.floor(i / COLS);
    const col = (i % COLS) - (COLS - 1) / 2;
    return {
      seat: s.seat,
      x: col * SPACING + ((h & 255) / 255 - 0.5) * 0.6,
      z: -FIELD_GAP / 2 - rank * SPACING - (((h >> 8) & 255) / 255) * 0.5,
      speed: RUN_SPEED * (0.9 + ((h >> 16) & 255) / 255 * 0.2),
      phase: ((h >> 24) & 255) / 255 * Math.PI * 2,
      hue: (h % 360) / 360,
      flag: s.heldBitmap != null,
      founder: s.seat <= 100,
    };
  });
}

/** Time into the charge: 0–2s the battle cry (standing), then the run until contact at the centre line. */
export function chargeOffset(t: number, speed: number): number {
  const local = ((t % CHARGE_CYCLE) + CHARGE_CYCLE) % CHARGE_CYCLE;
  const run = Math.max(0, local - 2);
  return Math.min(run * speed, FIELD_GAP / 2 - 1);
}
