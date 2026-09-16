/**
 * OASIS SETTLERS — the free bot population.
 *
 * These are rule-driven characters, not AI model calls: every decision is made
 * locally in the browser from a seeded pattern, so a crowded Oasis costs nothing
 * to run and works with no network round trips.
 *
 * This module owns the roster and the one setting the player controls: how many
 * settlers are around at once.
 */

/**
 * The on-chain figure the plain settlers wear — prospectors, raiders and traders
 * keep their blocky work bodies so a crowd still reads at a glance.
 */
export const SETTLER_INSCRIPTION =
  "7aaed056704bfb957ced2786397e0ed726e66fb181681f1e07de12d9913570f2i0";

/** The prospectors wear their own inscribed figure, so the two crowds read apart. */
export const PROSPECTOR_INSCRIPTION =
  "4319218fc12b00ca48298b0252201ba2a714900f530cf6ecab02d0acbaa691eei0";

/** The traders walk the sand as this inscribed plant. */
export const TRADER_INSCRIPTION =
  "855d5edd289bf34d7be22f095958e5a6ea0cff7df9d4ea094db33d3aa545a0b9i0";

/** The raiders come at you as this inscribed figure. */
export const RAIDER_INSCRIPTION =
  "9bcfa4ecc355441bc1fcb196cff3a78bb74bf7821fc33e3e8ef0d9c21b30ae3fi0";

export type BotRole = "wanderer" | "miner" | "raider" | "trader";


export type BotRoleSpec = {
  label: string;
  /** what they say while doing their job */
  chatter: string[];
};

export const BOT_ROLES: Record<BotRole, BotRoleSpec> = {
  wanderer: {
    label: "SETTLER",
    chatter: [
      "LONG WALK BETWEEN DISTRICTS",
      "SAND IN EVERYTHING AGAIN",
      "SAW A PUNK MOB EAST OF HERE",
      "ANY ROADS BUILT UP NORTH?",
      "NICE BLOCK YOU GOT THERE",
    ],
  },
  miner: {
    label: "PROSPECTOR",
    chatter: [
      "SEAM RUNS DEEPER THAN IT LOOKS",
      "FOUR NUGGETS TO A BAR, THEY SAY",
      "THIS ONE IS NEARLY WORKED OUT",
      "MINERALS PAY BETTER THAN GOLD",
    ],
  },
  raider: {
    label: "RAIDER",
    chatter: ["WRONG SAND TO STAND ON", "HAND IT OVER", "NOTHING PERSONAL"],
  },
  trader: {
    label: "TRADER",
    chatter: [
      "GOLD BAR FOR 40 BIT",
      "CHEESE SLICE, HOT, 6 BIT",
      "BUYING HIDES, FAIR PRICE",
      "KEYS FOR CHESTS, ASK INSIDE",
    ],
  },
};

const FIRST = [
  "ASH",
  "MERI",
  "DUNE",
  "KOVA",
  "SILT",
  "RENN",
  "VEX",
  "ORRA",
  "TAMB",
  "NIKO",
  "PIKA",
  "SOLA",
];
const LAST = ["OFTHESAND", "-9", "GRIT", "HOLLOW", "STONE", "MK2", "OASIS", "DRIFT"];

export const BOT_COUNT_MAX = 40;
export const BOT_COUNT_DEFAULT = 15;
const STORE_KEY = "oasis-bot-count";

let count = BOT_COUNT_DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const raw = window.localStorage.getItem(STORE_KEY);
  const parsed = raw === null ? Number.NaN : Number(raw);
  if (Number.isFinite(parsed)) count = Math.max(0, Math.min(BOT_COUNT_MAX, Math.round(parsed)));
}

export function botCount() {
  load();
  return count;
}

export function setBotCount(next: number) {
  load();
  count = Math.max(0, Math.min(BOT_COUNT_MAX, Math.round(next)));
  if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, String(count));
  for (const listener of listeners) listener();
}

export function subscribeBotCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable 0..1 from two numbers, so the same roster comes back every session. */
export function botHash(a: number, b: number) {
  const n = Math.sin(a * 63.17 + b * 21.91) * 24_634.6345;
  return n - Math.floor(n);
}

export type BotPlan = {
  id: number;
  name: string;
  role: BotRole;
  seed: number;
  /** body scale, so a crowd is not all the same height */
  size: number;
};

/**
 * The roster is a deterministic slice: raising the count adds settlers without
 * shuffling the ones already out there.
 */
export function botRoster(total: number): BotPlan[] {
  const list: BotPlan[] = [];
  for (let index = 0; index < total; index++) {
    const roll = botHash(index + 1, 3);
    const role: BotRole =
      roll < 0.4 ? "wanderer" : roll < 0.68 ? "miner" : roll < 0.87 ? "raider" : "trader";
    const first = FIRST[Math.floor(botHash(index + 1, 11) * FIRST.length)] ?? "ASH";
    const last = LAST[Math.floor(botHash(index + 1, 29) * LAST.length)] ?? "GRIT";
    list.push({
      id: 9_000 + index,
      name: `${first} ${last}`,
      role,
      seed: index * 3.7 + 1.3,
      size: 0.92 + botHash(index + 1, 41) * 0.22,
    });
  }
  return list;
}
