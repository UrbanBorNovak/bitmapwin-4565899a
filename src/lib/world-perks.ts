/**
 * MEMBER PERKS INSIDE THE OASIS.
 *
 * The MEMBERS badge is earned by a monthly donation and confirmed against the
 * chain by the backend (see membership.server.ts). This module is only the
 * world-side echo of that answer: the page tells it whether the visitor is a
 * confirmed member, and the desert reads it for the small advantages members
 * get — a richer BIT scatter, quicker mining, and a title on the HUD.
 *
 * Nothing here decides membership. It only carries the backend's verdict into
 * the render loop, where React query hooks would be too expensive to reach.
 */

import { useSyncExternalStore } from "react";

/** The title shown beside the block readout. */
export const MEMBER_TITLE = "MEMBER";

/** BIT scatter chance for members, against 0.42 for everyone else. */
export const MEMBER_BIT_CHANCE = 0.58;
/** How many BITs a member pockets from one field pickup. */
export const MEMBER_BIT_PAYOUT = 2;
/** Members swing a pick this much faster. */
export const MEMBER_MINE_RATE = 0.68;
/** Members bank this much extra mining experience per stone. */
export const MEMBER_MINE_XP = 1.5;

let member = false;
const listeners = new Set<() => void>();

/** Is the visitor a confirmed MEMBER right now? Safe inside useFrame. */
export function isMember() {
  return member;
}

/** Carry the backend's verdict into the world. */
export function setMember(next: boolean) {
  if (member === next) return;
  member = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live MEMBERS state for the HUD. */
export function useMember() {
  return useSyncExternalStore(
    subscribe,
    () => member,
    () => false,
  );
}
