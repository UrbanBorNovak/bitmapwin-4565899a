/**
 * MMO COMBAT LOOP — Lineage 2 style auto-attack, vitals and hotbar actions.
 *
 * Device-local feel layer only: it never awards BIT or writes server state.
 * Hits land through damageBeast in world-entities like every other weapon.
 */
export const SWING_MS = 650;
export const BASE_DAMAGE = 14;
export const CRIT_CHANCE = 0.12;
export const CRIT_MULT = 2.2;
export const MISS_CHANCE = 0.08;
export const SOULSHOT_MULT = 1.6;
export const SOULSHOT_MP = 3;
export const REGEN_PER_S = { hp: 1, mp: 0.6, cp: 2 };
export const SIT_REGEN_MULT = 4;

export type Vitals = { level: number; cp: number; maxCp: number; hp: number; maxHp: number; mp: number; maxMp: number };

export const mmoPlayer = {
  vitals: { level: 1, cp: 120, maxCp: 120, hp: 240, maxHp: 240, mp: 90, maxMp: 90 } as Vitals,
  autoAttack: false,
  sitting: false,
  soulshot: false,
  lastSwing: 0,
  inCombatUntil: 0,
};

export type Swing = { kind: "hit" | "crit" | "miss"; damage: number; usedShot: boolean };

/** Roll one swing. rng is injectable so tests are exact. */
export function rollSwing(rng: () => number, soulshot: boolean, mp: number): Swing {
  const usedShot = soulshot && mp >= SOULSHOT_MP;
  if (rng() < MISS_CHANCE) return { kind: "miss", damage: 0, usedShot: false };
  const spread = 0.85 + rng() * 0.3;
  const crit = rng() < CRIT_CHANCE;
  let dmg = BASE_DAMAGE * spread * (crit ? CRIT_MULT : 1) * (usedShot ? SOULSHOT_MULT : 1);
  dmg = Math.max(1, Math.round(dmg));
  return { kind: crit ? "crit" : "hit", damage: dmg, usedShot };
}

/** Advance regeneration by dt seconds; sitting multiplies it. */
export function regen(v: Vitals, dt: number, sitting: boolean): Vitals {
  const k = dt * (sitting ? SIT_REGEN_MULT : 1);
  return {
    ...v,
    hp: Math.min(v.maxHp, v.hp + REGEN_PER_S.hp * k),
    mp: Math.min(v.maxMp, v.mp + REGEN_PER_S.mp * k),
    cp: Math.min(v.maxCp, v.cp + REGEN_PER_S.cp * k),
  };
}

export type FloatText = { id: number; x: number; y: number; z: number; text: string; kind: "hit" | "crit" | "miss" | "heal"; at: number };
export const floats: FloatText[] = [];
let floatId = 0;
export const FLOAT_MS = 1100;
export function pushFloat(f: Omit<FloatText, "id" | "at">, now: number) {
  floats.push({ ...f, id: ++floatId, at: now });
  while (floats.length > 24) floats.shift();
}
export function pruneFloats(now: number) {
  while (floats.length && now - (floats[0]?.at ?? now) > FLOAT_MS) floats.shift();
}
