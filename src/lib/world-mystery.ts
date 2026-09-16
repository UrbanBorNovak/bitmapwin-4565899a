/**
 * MYSTERY BOXES.
 *
 * Inscribed crates sitting out in the sand. Where they are is worked out from
 * the tile and the UTC day, so everyone finds the same crates and a fresh run
 * appears each day. Open one and it pays out something at random from the prize
 * table — a purse of BIT, a ration, or a lump of mining experience.
 *
 * The record of what you have opened is personal play state in your own browser.
 */

/** on-chain GLB of a mystery box */
export const MYSTERY_INSCRIPTION =
  "19c23e77097285c515cfdd1cd820e467d8a4646be68b54d8ce640e26c8c5950ei0";

/** how wide one placement tile is, in avatar units */
export const MYSTERY_TILE = 34;
/** how close you have to stand to crack one open, in avatar units */
export const MYSTERY_REACH = 1.4;

export type MysteryPrize =
  | { kind: "bit"; amount: number; label: string }
  | { kind: "food"; food: string; label: string }
  | { kind: "xp"; amount: number; label: string }
  | { kind: "nothing"; label: string };

const PRIZES: { weight: number; prize: MysteryPrize }[] = [
  { weight: 22, prize: { kind: "bit", amount: 1, label: "1 BIT" } },
  { weight: 12, prize: { kind: "bit", amount: 3, label: "3 BIT" } },
  { weight: 4, prize: { kind: "bit", amount: 10, label: "10 BIT" } },
  { weight: 14, prize: { kind: "food", food: "candy", label: "A CANDY" } },
  { weight: 10, prize: { kind: "food", food: "crypto-soup", label: "A BOWL OF CRYPTO SOUP" } },
  { weight: 6, prize: { kind: "food", food: "medkit", label: "A MEDKIT" } },
  { weight: 4, prize: { kind: "food", food: "potion", label: "A POTION" } },
  { weight: 14, prize: { kind: "xp", amount: 120, label: "120 MINING XP" } },
  { weight: 6, prize: { kind: "xp", amount: 400, label: "400 MINING XP" } },
  { weight: 8, prize: { kind: "nothing", label: "SAND. NOTHING BUT SAND" } },
];

const STORE_KEY = "bitmapwin:mystery";

type Stored = { day: string; opened: string[] };

let state: Stored = { day: "", opened: [] };
let hydrated = false;

export function mysteryDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    state = {
      day: typeof parsed?.day === "string" ? parsed.day : mysteryDay(),
      opened: Array.isArray(parsed?.opened)
        ? parsed!.opened.filter((v) => typeof v === "string")
        : [],
    };
  } catch {
    state = { day: mysteryDay(), opened: [] };
  }
  rollDay();
}

function rollDay() {
  const day = mysteryDay();
  if (state.day === day) return;
  state = { day, opened: [] };
  persist();
}

function persist() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // a lost record is never worth an error
  }
}

/** Stable 0..1 from a tile and a salt, so the crates sit the same for everyone. */
export function mysteryHash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 73.19 + z * 149.37 + salt * 31.71) * 37_211.9137;
  return n - Math.floor(n);
}

export function mysteryOpened(id: string) {
  hydrate();
  rollDay();
  return state.opened.includes(id);
}

/** Crack a crate open. Returns the prize, or null when it was already emptied. */
export function openMystery(id: string, roll: number): MysteryPrize | null {
  hydrate();
  rollDay();
  if (state.opened.includes(id)) return null;
  state = { ...state, opened: [...state.opened, id].slice(-2_000) };
  persist();
  const total = PRIZES.reduce((sum, entry) => sum + entry.weight, 0);
  let acc = 0;
  const target = roll * total;
  for (const entry of PRIZES) {
    acc += entry.weight;
    if (target <= acc) return entry.prize;
  }
  return PRIZES[0]!.prize;
}
