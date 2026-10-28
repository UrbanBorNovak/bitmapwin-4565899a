/** Highland Charge: every seated Bitmapper is a soldier in one army. Pure maths, no React/three. */

export const CHARGE_CYCLE = 20; // battle cry, charge, cavalry, then the King's rally // seconds per charge loop
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
export const SPEAR_WINDOW = 0.45; // seconds a thrust is deadly
export const SPEAR_COOLDOWN = 1.2;

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
  return FIELD_GAP / 2 - 2 - Math.max(0, local - CAV_START) * CAV_SPEED;
}
/** Where the cavalry stops galloping and leaves the field (well behind the last rank). */
export const CAV_EXIT_Z = -FIELD_GAP / 2 - 30;
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
  last: "" | "BLOCKED" | "HIT" | "SPEARED" | "RALLY" | "BREAKOUT";
  thrust: boolean; // HUD asks for a spear thrust
  spearUntil: number; spearCooldownUntil: number; spearReady: boolean;
  /** What the commander did to the rider charging at them this cycle: galloped past, stopped, or unseated. */
  rider: "charging" | "stopped" | "speared" | "through";
  kills: number;
  casualties: number; standing: number;
  next: { kind: "arrows" | "cavalry"; in: number } | null;
  shieldReady: boolean;
  vip: boolean; // set by the page: followed seat holds a VIP pass or sits in Founders Row
  mount: boolean; // HUD asks to mount the warhorse and rally
  rallyAt: number | null; // local time the King's rally began this cycle
  rallyReady: boolean; // VIP may mount right now
  breakouts: number; glory: number; lastGlory: number;
};
export function newBattleGame(best = 0): BattleGame {
  return { raise: false, shieldUntil: -1, cooldownUntil: -1, cycle: -1, resolved: 0, heroDownAt: null, blocks: 0, streak: 0, best, last: "", casualties: 0, standing: 0, next: null, shieldReady: true, vip: false, mount: false, rallyAt: null, rallyReady: false, breakouts: 0, glory: 0, lastGlory: 0, thrust: false, spearUntil: -1, spearCooldownUntil: -1, spearReady: true, rider: "charging", kills: 0 };
}

/** One step of the commander rules; t = scene clock seconds. Pure apart from mutating g. */
export function stepBattle(g: BattleGame, t: number, playing: boolean): void {
  const local = localTime(t), c = cycleOf(t);
  if (c !== g.cycle) {
    if (g.cycle >= 0 && playing && g.heroDownAt == null) { g.streak++; g.best = Math.max(g.best, g.streak); }
    g.cycle = c; g.resolved = 0; g.heroDownAt = null; g.last = ""; g.rallyAt = null; g.mount = false; g.rider = "charging";
  }
  if (g.thrust) {
    g.thrust = false;
    if (t >= g.spearCooldownUntil && g.heroDownAt == null) { g.spearUntil = t + SPEAR_WINDOW; g.spearCooldownUntil = t + SPEAR_COOLDOWN; }
  }
  g.spearReady = t >= g.spearCooldownUntil;
  if (g.raise) {
    g.raise = false;
    if (t >= g.cooldownUntil && g.heroDownAt == null) { g.shieldUntil = t + SHIELD_WINDOW; g.cooldownUntil = t + SHIELD_COOLDOWN; }
  }
  g.shieldReady = t >= g.cooldownUntil;
  while (g.resolved < THREATS.length && local >= THREATS[g.resolved]!.at) {
    g.resolved++;
    const cav = THREATS[g.resolved - 1]!.kind === "cavalry";
    if (!playing || g.heroDownAt != null) { if (cav) g.rider = "through"; continue; }
    // A spear only helps against the rider; arrows still need the shield.
    if (cav && t <= g.spearUntil) { g.kills++; g.last = "SPEARED"; g.rider = "speared"; }
    else if (t <= g.shieldUntil) { g.blocks++; g.last = "BLOCKED"; if (cav) g.rider = "stopped"; }
    else { g.heroDownAt = local; g.last = "HIT"; g.streak = 0; if (cav) g.rider = "through"; }
  }
  // King Richard: only a verified VIP who speared the rider takes the riderless horse and leads the army through the wall.
  g.rallyReady = playing && g.vip && g.rider === "speared" && g.heroDownAt == null && g.rallyAt == null && local >= CAV_CONTACT && local < CAV_CONTACT + RALLY_WINDOW;
  if (g.mount) { g.mount = false; if (g.rallyReady) { g.rallyAt = local; g.last = "RALLY"; } }
  if (g.rallyAt != null && g.last === "RALLY" && local >= g.rallyAt + BREAKOUT_AFTER) {
    g.breakouts++; g.lastGlory = gloryFor(g.standing, g.streak + 1); g.glory += g.lastGlory; g.last = "BREAKOUT";
  }
  const nx = THREATS[g.resolved];
  g.next = nx ? { kind: nx.kind, in: nx.at - local } : null;
}

/* ---------- The King's rally ---------- */
export const RALLY_WINDOW = 3; // seconds after cavalry contact a VIP may mount
export const RALLY_SPEED = 7; // army speed behind the King
export const KING_SPEED = 11; // warhorse speed
export const BREAKOUT_AFTER = 3.2; // seconds of riding until the enemy wall breaks
/** Extra distance gained since the rally began. */
export function rallyGain(local: number, rallyAt: number | null, speed: number): number {
  return rallyAt == null || local < rallyAt ? 0 : (local - rallyAt) * speed;
}
/** Where the King's warhorse reins in: just through the enemy wall, never off into the void. */
export const KING_STOP = FIELD_GAP / 2 + 5;
/** The King's z: eases into KING_STOP from wherever he mounted, so he never snaps or overshoots. */
export function kingZ(startZ: number, gain: number, stop = KING_STOP): number {
  const room = Math.max(0, stop - startZ);
  if (room <= 0) return startZ;
  const ease = Math.min(4, room), full = room - ease; // gallop at full speed, then rein in over the last 4 units
  return gain <= full ? startZ + gain : startZ + full + ease * (1 - Math.exp(-(gain - full) / ease));
}
/** Glory for a breakout: survivors × streak multiplier. */
export function gloryFor(standing: number, streak: number): number {
  return standing * Math.max(1, streak);
}
