/** Highland Charge: every seated Bitmapper is a soldier in one army. Pure maths, no React/three. */

export const CHARGE_CYCLE = 14; // seconds per charge loop
export const FIELD_GAP = 70; // distance between the two lines at the start
export const COLS = 24;
export const SPACING = 1.6;
export const RUN_SPEED = 4.2; // world units per second

export type Soldier = { seat: number; rank: number; x: number; z: number; speed: number; phase: number; hue: number; flag: boolean; founder: boolean };

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
      seat: s.seat, rank,
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

/* ---------- Battle layer: volleys, cavalry, casualties (deterministic per cycle) ---------- */

export const VOLLEYS = [4.5, 8] as const; // local launch times of the Fiat arrow volleys
export const ARROW_FLIGHT = 1.6; // seconds in the air
export const CAV_START = 9.5; // local time the cavalry breaks out of the wall
export const CAV_SPEED = 12;
export const SHIELD_WINDOW = 0.7; // seconds a raised shield protects
export const SHIELD_COOLDOWN = 1.2;

export function localTime(t: number): number {
  return ((t % CHARGE_CYCLE) + CHARGE_CYCLE) % CHARGE_CYCLE;
}
export function cycleOf(t: number): number { return Math.floor(t / CHARGE_CYCLE); }

/** Front rank z of the army at local time. */
export function armyFront(local: number): number {
  return -FIELD_GAP / 2 + Math.min(Math.max(0, local - 2) * RUN_SPEED, FIELD_GAP / 2 - 1);
}
/** Cavalry z: gallops from the enemy wall until it meets the army's front rank. */
export function cavalryZ(local: number): number {
  const z = FIELD_GAP / 2 - 2 - Math.max(0, local - CAV_START) * CAV_SPEED;
  return Math.max(z, armyFront(local) + 1);
}
/** First local time the cavalry hits the front rank. */
export const CAV_CONTACT = (() => {
  for (let l = CAV_START; l < CHARGE_CYCLE; l += 0.01) if (cavalryZ(l) <= armyFront(l) + 1.001) return l;
  return CHARGE_CYCLE - 1;
})();

/** Every threat the commander must survive, in local time: two arrow landings, then the cavalry. */
export const THREATS: { at: number; kind: "arrows" | "cavalry" }[] = [
  ...VOLLEYS.map((v) => ({ at: v + ARROW_FLIGHT, kind: "arrows" as const })),
  { at: CAV_CONTACT, kind: "cavalry" as const },
];

/** Per-soldier fate in [0,1) re-rolled each cycle so the fallen differ each charge. */
export function fate(seat: number, cycle: number): number {
  let h = Math.imul(seat ^ 0x9e3779b9, 2654435761) ^ Math.imul(cycle + 1, 40503);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Local time this soldier falls this cycle, or null if they survive. Rank 0–2 face the cavalry. */
export function deathTime(seat: number, rank: number, cycle: number): number | null {
  const f = fate(seat, cycle);
  if (f < 0.07) return VOLLEYS[0] + ARROW_FLIGHT + f * 3;
  if (f < 0.14) return VOLLEYS[1] + ARROW_FLIGHT + (f - 0.07) * 3;
  if (rank <= 2 && f < 0.4) return CAV_CONTACT + (f - 0.14) * 2;
  return null;
}

/** Mutable commander state shared between the HUD and the 3D stepper (per-frame, outside React). */
export type BattleGame = {
  raise: boolean; // HUD asks to raise the shield; the stepper stamps it with scene time
  shieldUntil: number; cooldownUntil: number;
  cycle: number; resolved: number; // threats resolved this cycle
  heroDownAt: number | null; // local time the followed soldier fell this cycle
  blocks: number; streak: number; best: number;
  last: "" | "BLOCKED" | "HIT";
  casualties: number; standing: number;
  next: { kind: "arrows" | "cavalry"; in: number } | null;
  shieldReady: boolean;
};
export function newBattleGame(best = 0): BattleGame {
  return { raise: false, shieldUntil: -1, cooldownUntil: -1, cycle: -1, resolved: 0, heroDownAt: null, blocks: 0, streak: 0, best, last: "", casualties: 0, standing: 0, next: null, shieldReady: true };
}

/** One step of the commander rules; t = scene clock seconds. Pure apart from mutating g. */
export function stepBattle(g: BattleGame, t: number, playing: boolean): void {
  const local = localTime(t), c = cycleOf(t);
  if (c !== g.cycle) {
    if (g.cycle >= 0 && playing && g.heroDownAt == null) { g.streak++; g.best = Math.max(g.best, g.streak); }
    g.cycle = c; g.resolved = 0; g.heroDownAt = null; g.last = "";
  }
  if (g.raise) {
    g.raise = false;
    if (t >= g.cooldownUntil && g.heroDownAt == null) { g.shieldUntil = t + SHIELD_WINDOW; g.cooldownUntil = t + SHIELD_COOLDOWN; }
  }
  g.shieldReady = t >= g.cooldownUntil;
  while (g.resolved < THREATS.length && local >= THREATS[g.resolved]!.at) {
    g.resolved++;
    if (!playing || g.heroDownAt != null) continue;
    if (t <= g.shieldUntil) { g.blocks++; g.last = "BLOCKED"; }
    else { g.heroDownAt = local; g.last = "HIT"; g.streak = 0; }
  }
  const nx = THREATS[g.resolved];
  g.next = nx ? { kind: nx.kind, in: nx.at - local } : null;
}
