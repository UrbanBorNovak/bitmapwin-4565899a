/**
 * COMPANIONS, WORN GEAR AND FIELD RATIONS.
 *
 * Everything a visitor carries with them that is not a weapon: the pet that
 * trots at their heel, the wizard hat that comes out with the wand, the
 * night-vision goggles, and the food they sit down to eat for a heal and a
 * short buff. Like the skill book this is personal play state kept in the
 * visitor's own browser — it never pretends to be chain ownership.
 */

import { useSyncExternalStore } from "react";

export type CompanionId = "none" | "robo-dog" | "goose";

export type CompanionSpec = {
  id: CompanionId;
  label: string;
  /** on-chain GLB, empty for "none" */
  inscription: string;
  /** how tall the pet reads, in avatar units */
  fit: number;
  /** how far behind the visitor it trails */
  follow: number;
  /** true for the goose — it lifts off the sand and flaps */
  hovers: boolean;
};

export const COMPANIONS: CompanionSpec[] = [
  { id: "none", label: "NO COMPANION", inscription: "", fit: 0, follow: 0, hovers: false },
  {
    id: "robo-dog",
    label: "ROBO DOG",
    inscription: "3eba3eadd0cf32bce7be6a21eccb9b97d9e66e9c0d779a3b1d7463a7a8432d47i0",
    fit: 0.42,
    follow: 0.85,
    hovers: false,
  },
  {
    id: "goose",
    label: "PET GOOSE",
    inscription: "b8f812d363032f4e8acd486a8316544fa28eb156344550ee606cfd33d73a23a9i0",
    fit: 0.6,
    follow: 0.9,
    hovers: true,
  },
];

export function companionSpec(id: CompanionId) {
  return COMPANIONS.find((entry) => entry.id === id) ?? COMPANIONS[0]!;
}

/** The wizard hat that comes out whenever the wand is in hand. */
export const WIZARD_HAT_INSCRIPTION =
  "b91084dd15d7df4e15fe83f866c2421686c53105ceb81ce9acf034526c63b0c4i0";
/** The magic book, held in the off hand alongside the wand. */
export const MAGIC_BOOK_INSCRIPTION =
  "9b0b033ddd5ebe5f6a78cedb2432e33d2e739ff04d59278017298564391272fbi0";
/** Night-vision goggles — worn on the head, and they tint the first-person view. */
export const GOGGLES_INSCRIPTION =
  "d8b0d7024d4fead7d5ff4adb40bd81e28fb3d6035c5eda1deef5ef24ff61b2b1i0";
/** The Punks that roam the universe. */
export const PUNK_INSCRIPTION =
  "748e439d2558d567c69d97eba12329e1bd6b6dd2ee1900c738ffbf42c9a9db9fi0";
/** Desert shoes — laced on the feet, and they quicken every stride. */
export const SHOES_INSCRIPTION =
  "d2a674751c24003e196b7a70ce4d5427a544bb84faca6e3536f4ee665b5da616i0";
/** The moon that hangs in the night sky — inscribed, not edible. */
export const MOON_INSCRIPTION =
  "37b64538bf925f3780fc22cdab1d0a8bd7a70df3ba74989fd9c891d70b2dcd34i0";
/** How much faster a visitor travels with the shoes on. */
export const SHOES_SPEED = 1.16;
/** The necklace — worn at the throat, and it steadies a visitor's recovery. */
export const NECKLACE_INSCRIPTION =
  "aa4b5be5b8aa8460ee7cc6fa19279fb6768f0e376a3901e46f8f942a16d75ac6i0";
/** Health the necklace mends every second, on top of any meal buff. */
export const NECKLACE_REGEN = 1;


export type FoodId =
  | "ice-cream"
  | "ramen"
  | "cheese-slice"
  | "candy"
  | "potion"
  | "peperoni-slice"
  | "medkit";


export type FoodSpec = {
  id: FoodId;
  label: string;
  inscription: string;
  /** how tall it reads while being eaten, in avatar units */
  fit: number;
  /** health mended the moment you take a bite */
  bite: number;
  /** how long the meal takes */
  eatMs: number;
  buff: { label: string; ms: number; regenPerSecond: number; power: number };
};

export const FOODS: Record<FoodId, FoodSpec> = {
  "ice-cream": {
    id: "ice-cream",
    label: "ICE CREAM",
    inscription: "cb6d7fc7952075255f35ecf708f96236d374bd7415ac54e799bb8372beb1ba30i0",
    fit: 0.3,
    bite: 18,
    eatMs: 6_000,
    buff: { label: "SUGAR RUSH", ms: 45_000, regenPerSecond: 4, power: 1.15 },
  },
  ramen: {
    id: "ramen",
    label: "RAMEN",
    inscription: "f41409b607e0e2e1067e9ee4bca74d3069ecd9b94a2dba5aa1dee68ac9e9ace1i0",
    fit: 0.34,
    bite: 26,
    eatMs: 8_000,
    buff: { label: "WELL FED", ms: 90_000, regenPerSecond: 3, power: 1.3 },
  },
  "cheese-slice": {
    id: "cheese-slice",
    label: "CHEESE SLICE",
    inscription: "cb2e324c8588aead7dac9d5c919beaff763db6883b01cc6ca30ce2d6112e8e4fi0",
    fit: 0.32,
    bite: 32,
    eatMs: 5_000,
    buff: { label: "CHEESY", ms: 60_000, regenPerSecond: 5, power: 1.2 },
  },
  candy: {
    id: "candy",
    label: "CANDY",
    inscription: "d9cbed1d4fec461eb123155a786c8092468123fb14688fffc1f94701b7126f5ai0",
    fit: 0.28,
    bite: 14,
    eatMs: 4_000,
    buff: { label: "SUGAR BURST", ms: 30_000, regenPerSecond: 3, power: 1.15 },
  },
  potion: {
    id: "potion",
    label: "POTION",
    inscription: "096f79d3dc7d475f60fa10b2cc285f689cf21b4762ed39735680525198fdc6d3i0",
    fit: 0.3,
    bite: 45,
    eatMs: 3_500,
    buff: { label: "FORTIFIED", ms: 120_000, regenPerSecond: 6, power: 1.35 },
  },
  "peperoni-slice": {
    id: "peperoni-slice",
    label: "PEPERONI SLICE",
    inscription: "53f9ec0c166fbdcf32ea39d5c8bd6a5f36cc8bf730fa1b57ff88be418f46b0dai0",
    fit: 0.34,
    bite: 30,
    eatMs: 5_500,
    buff: { label: "STONE OVEN", ms: 70_000, regenPerSecond: 4, power: 1.28 },
  },
  medkit: {
    id: "medkit",
    label: "MEDKIT",
    inscription: "235e6e92fc64a3f3a57e3a3d741390c3248b9589a744345d2bf7109ddd76fab0i0",
    fit: 0.3,
    bite: 70,
    eatMs: 3_000,
    buff: { label: "PATCHED UP", ms: 45_000, regenPerSecond: 8, power: 1.1 },
  },
};


export type GearBuff = { label: string; until: number; regenPerSecond: number; power: number };

export type GearSnapshot = {
  companion: CompanionId;
  goggles: boolean;
  /** the desert shoes, laced on or left in the pack */
  shoes: boolean;
  /** the necklace, worn at the throat */
  necklace: boolean;
  /** the meal in hand, while it lasts */
  eating: { food: FoodId; until: number } | null;
  buff: GearBuff | null;
};

const STORE_KEY = "bitmapwin:gear";

let state: GearSnapshot = {
  companion: "none",
  goggles: false,
  shoes: false,
  necklace: false,
  eating: null,
  buff: null,
};

let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  for (const listener of listeners) listener();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      companion?: CompanionId;
      goggles?: boolean;
      shoes?: boolean;
      necklace?: boolean;
    };
    if (parsed.companion && COMPANIONS.some((c) => c.id === parsed.companion))
      state = { ...state, companion: parsed.companion };
    if (typeof parsed.goggles === "boolean") state = { ...state, goggles: parsed.goggles };
    if (typeof parsed.shoes === "boolean") state = { ...state, shoes: parsed.shoes };
    if (typeof parsed.necklace === "boolean") state = { ...state, necklace: parsed.necklace };
  } catch {
    // a lost preference is never worth an error
  }
}

function persist() {
  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        companion: state.companion,
        goggles: state.goggles,
        shoes: state.shoes,
        necklace: state.necklace,
      }),
    );
  } catch {
    // saving kit is a nicety
  }
}



export function gearSnapshot(): GearSnapshot {
  hydrate();
  return state;
}

export function useGear() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    gearSnapshot,
    () => state,
  );
}

export function setCompanion(id: CompanionId) {
  hydrate();
  state = { ...state, companion: id };
  persist();
  emit();
}

/** Whistle for the next pet in the kennel. */
export function cycleCompanion() {
  hydrate();
  const at = COMPANIONS.findIndex((entry) => entry.id === state.companion);
  const next = COMPANIONS[(at + 1) % COMPANIONS.length]!;
  setCompanion(next.id);
  return next;
}

export function toggleGoggles() {
  hydrate();
  state = { ...state, goggles: !state.goggles };
  persist();
  emit();
  return state.goggles;
}

/** Lace the desert shoes on, or kick them off. */
export function toggleShoes() {
  hydrate();
  state = { ...state, shoes: !state.shoes };
  persist();
  emit();
  return state.shoes;
}

/** Clasp the necklace on, or take it off. */
export function toggleNecklace() {
  hydrate();
  state = { ...state, necklace: !state.necklace };
  persist();
  emit();
  return state.necklace;
}

/** How fast a visitor walks — quicker with the shoes on. */
export function walkMultiplier() {
  return state.shoes ? SHOES_SPEED : 1;
}



/**
 * Sit down and eat. Returns the meal when it starts, or null when one is already
 * on the go — you cannot double up on rations.
 */
export function startEating(food: FoodId) {
  hydrate();
  const now = Date.now();
  if (state.eating && state.eating.until > now) return null;
  const spec = FOODS[food];
  state = {
    ...state,
    eating: { food, until: now + spec.eatMs },
    buff: {
      label: spec.buff.label,
      until: now + spec.buff.ms,
      regenPerSecond: spec.buff.regenPerSecond,
      power: spec.buff.power,
    },
  };
  emit();
  return spec;
}

/** Clear anything that has run out. Called once a second by the world. */
export function tickGear(now = Date.now()) {
  hydrate();
  let changed = false;
  if (state.eating && state.eating.until <= now) {
    state = { ...state, eating: null };
    changed = true;
  }
  if (state.buff && state.buff.until <= now) {
    state = { ...state, buff: null };
    changed = true;
  }
  if (changed) emit();
}

/** How hard a buffed visitor hits — 1 with no buff running. */
export function powerMultiplier(now = Date.now()) {
  const buff = state.buff;
  return buff && buff.until > now ? buff.power : 1;
}

/** How much health mends each second — meal buff plus the necklace. */
export function activeRegen(now = Date.now()) {
  const buff = state.buff;
  const meal = buff && buff.until > now ? buff.regenPerSecond : 0;
  return meal + (state.necklace ? NECKLACE_REGEN : 0);
}

