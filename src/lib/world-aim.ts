/**
 * AIMING — holding the left mouse button in first person steadies the weapon.
 *
 * One tiny shared piece of state, read every frame by the camera rig (to pull
 * the view in) and by the weapon layer (to steady the shot). Kept outside React
 * on purpose: it changes on a mouse press and is read in the render loop, so it
 * must never cost a re-render.
 */

import type { WeaponKind } from "@/components/game/weapons";

export const aimState = {
  /** true while the left button is held down in first person */
  active: false,
  /** 0..1 eased amount, driven by the camera rig each frame */
  amount: 0,
};

/** How far each weapon pulls the view in when aimed. */
export function aimZoom(weapon: WeaponKind): number {
  switch (weapon) {
    case "minigun":
      return 0.6; // heavy piece, braced rather than sighted
    case "revolver":
      return 0.68;
    case "wand":
      return 0.78;
    case "whip":
      return 0.84; // just a steadier stance
    default:
      return 0.86;
  }
}

/** Aiming reaches further and lands cleaner. */
export const AIM_REACH_BONUS = 1.35;
export const AIM_FORGIVENESS = 1.6;
