/**
 * THE RUNESTONE STAFF AND WHAT SITS ON TOP OF IT.
 *
 * The staff itself is one inscription. The socket at its head takes a stone: a
 * runestone or a coloured gem, each of which changes the colour of the cast and
 * how hard the staff hits. Stones are listed here by inscription, so fitting a
 * new one to the world is a single entry in STONES.
 */

import { useSyncExternalStore } from "react";

/** on-chain GLB of the runestone staff */
export const STAFF_INSCRIPTION =
  "2f420646455d4fa2c10cc620ee8e573d3589caca8d36ccbe244ffdd93446ff20i0";

export type StoneSpec = {
  id: string;
  label: string;
  /** on-chain GLB of the stone that sits in the socket */
  inscription: string;
  /** how wide the stone reads on the head of the staff, in strides */
  fit: number;
  /** colour of the cast and of the glow around the socket */
  glow: string;
  /** damage multiplier on the staff's bolt */
  power: number;
};

/**
 * Stones that can be seated on the staff. The head is empty until one is fitted,
 * and more inscriptions drop straight into this list.
 */
export const STONES: StoneSpec[] = [];

const STORE_KEY = "bitmapwin:staff-stone";

let fitted: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw && STONES.some((stone) => stone.id === raw)) fitted = raw;
  } catch {
    fitted = null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function stoneSpec(id: string | null) {
  return STONES.find((stone) => stone.id === id) ?? null;
}

/** The stone currently seated on the staff, or null for a bare head. */
export function fittedStone(): StoneSpec | null {
  hydrate();
  return stoneSpec(fitted);
}

export function setFittedStone(id: string | null) {
  hydrate();
  fitted = id && STONES.some((stone) => stone.id === id) ? id : null;
  try {
    if (fitted) window.localStorage.setItem(STORE_KEY, fitted);
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // keeping the socket is a nicety
  }
  emit();
  return fittedStone();
}

/** Swap to the next stone in the pouch, then back to a bare head. */
export function cycleStone() {
  hydrate();
  if (STONES.length === 0) return null;
  const at = STONES.findIndex((stone) => stone.id === fitted);
  const next = STONES[at + 1] ?? null;
  return setFittedStone(next ? next.id : null);
}

/** Live socket for the scene and the HUD. */
export function useFittedStone() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fittedStone,
    () => null,
  );
}

/** How hard the staff hits with whatever is seated on it. */
export function stonePower() {
  return fittedStone()?.power ?? 1;
}

/** Colour of the cast — plain rune blue with a bare head. */
export function stoneGlow() {
  return fittedStone()?.glow ?? "#7ad1ff";
}
