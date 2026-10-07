/**
 * LIGHTSABER DUEL — device-local duel state. A duel locks onto one rival,
 * hits on that rival land harder, and a raised guard (hold right button with a
 * saber) deflects most of an incoming hit. Your own HP is yours to report, so
 * the guard only ever reduces damage you take — it never touches anyone else.
 */
export const DUEL_EVENT = "oasis:duel";

export const duel = {
  targetId: null as string | null,
  targetHandle: null as string | null,
  /** a saber is held right now */
  saber: false,
  /** right button held with a saber */
  guarding: false,
};

export const DUEL_DAMAGE_BONUS = 1.5;
export const GUARD_BLOCK = 0.7;

export function setDuel(targetId: string | null, targetHandle: string | null) {
  duel.targetId = targetId;
  duel.targetHandle = targetHandle;
  window.dispatchEvent(new CustomEvent(DUEL_EVENT, { detail: { targetHandle } }));
}

/** Damage after the saber guard — used on hits you receive. */
export function guardedDamage(damage: number) {
  return duel.saber && duel.guarding ? Math.max(1, Math.round(damage * (1 - GUARD_BLOCK))) : damage;
}
