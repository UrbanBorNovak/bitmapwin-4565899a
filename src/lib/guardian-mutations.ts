/**
 * Seasonal mutations + gadget loadout for Guardians. Pure and deterministic:
 * the season comes from the calendar date (UTC), the gadgets from the block
 * hash seed, so every viewer sees the same Guardian on the same day.
 * Purely cosmetic — never changes stats.
 */
export type MutationId = "NONE" | "WHITEPAPER" | "HALLOWEEN" | "WINTER" | "GENESIS" | "PIZZA" | "HALVING_EVE" | "BLOOD_MOON";

export type Mutation = { id: MutationId; label: string; blurb: string; color: string; accent: string };

export const MUTATIONS: Record<MutationId, Mutation> = {
  NONE: { id: "NONE", label: "BASELINE", blurb: "No seasonal mutation active.", color: "#7fd6e6", accent: "#f7931a" },
  WHITEPAPER: { id: "WHITEPAPER", label: "WHITEPAPER SCROLL", blurb: "Oct 31, 2008 anniversary: a paper scroll halo orbits the crest.", color: "#f2ead8", accent: "#f7931a" },
  HALLOWEEN: { id: "HALLOWEEN", label: "WRAITHFIRE", blurb: "Halloween week: spectral flames and a lantern core.", color: "#9b5cff", accent: "#ff7a1a" },
  WINTER: { id: "WINTER", label: "CRYO-FROST", blurb: "Winter solstice to new year: ice horns and a star beacon.", color: "#bfe9ff", accent: "#ffffff" },
  GENESIS: { id: "GENESIS", label: "GENESIS CIPHER", blurb: "Jan 3 genesis week: a golden Merkle ring.", color: "#ffd166", accent: "#f7931a" },
  PIZZA: { id: "PIZZA", label: "10,000 BTC REACTOR", blurb: "Bitcoin Pizza Day (May 22): a molten slice reactor on its back.", color: "#ffb347", accent: "#e8442e" },
  HALVING_EVE: { id: "HALVING_EVE", label: "HALVING HALO", blurb: "Its own block is a halving block: a permanent twin ring.", color: "#f7931a", accent: "#ffd166" },
  BLOOD_MOON: { id: "BLOOD_MOON", label: "BLOOD-FURY", blurb: "Blood Moon block (height % 144 = 0): crimson spikes.", color: "#c81e1e", accent: "#ff5a5a" },
};

/** Calendar season active on a UTC date. */
export function seasonFor(date: Date): MutationId {
  const m = date.getUTCMonth() + 1, d = date.getUTCDate();
  const md = m * 100 + d;
  if (md >= 1025 && md <= 1030) return "HALLOWEEN";
  if (md === 1031) return "WHITEPAPER";
  if (md >= 1101 && md <= 1102) return "HALLOWEEN";
  if (md >= 1220 || md <= 102) return "WINTER";
  if (md >= 103 && md <= 112) return "GENESIS";
  if (md >= 520 && md <= 524) return "PIZZA";
  return "NONE";
}

/** Block-permanent mutations win over the calendar. */
export function mutationFor(height: number, date: Date = new Date(), override?: MutationId | null): Mutation {
  if (override) return MUTATIONS[override];
  if (height > 0 && height % 210_000 === 0) return MUTATIONS.HALVING_EVE;
  if (height % 144 === 0) return MUTATIONS.BLOOD_MOON;
  return MUTATIONS[seasonFor(date)];
}

export type HeadGadget = "VISOR" | "MONOCLE" | "ANTENNA" | "NONE";
export type BackGadget = "THRUSTERS" | "BATTERY" | "COILS" | "NONE";
export type Loadout = { head: HeadGadget; back: BackGadget; drone: boolean };

export function loadoutFor(seed: string, height: number): Loadout {
  const n = parseInt(seed.slice(0, 8) || "0", 16) ^ height;
  const heads: HeadGadget[] = ["VISOR", "MONOCLE", "ANTENNA", "NONE"];
  const backs: BackGadget[] = ["THRUSTERS", "BATTERY", "COILS", "NONE"];
  return { head: heads[n & 3]!, back: backs[(n >>> 2) & 3]!, drone: ((n >>> 4) & 7) === 0 };
}

const OVERRIDE_KEY = "bitmapwin:guardian-season";
/** Device-local preview override (cosmetic only). */
export function readSeasonOverride(): MutationId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(OVERRIDE_KEY);
  return v && v in MUTATIONS ? (v as MutationId) : null;
}
export function writeSeasonOverride(v: MutationId | null) {
  if (v) window.localStorage.setItem(OVERRIDE_KEY, v);
  else window.localStorage.removeItem(OVERRIDE_KEY);
  window.dispatchEvent(new Event("guardian-season"));
}
