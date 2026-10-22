/**
 * BITERNAM GEAR LOCKER — every interior shows one of the Oasis's on-chain
 * vehicle/gear models. Inspecting it salvages one part; parts combine into
 * tools, and the tools rebuild Wierdamoto's hover-skiff. Device-local only:
 * it pays no BIT and proves nothing on chain.
 */
import { useSyncExternalStore } from "react";

export type GearRoom = "safehouse" | "outpost" | "museum" | "arcade" | "cafe" | "lab" | "studio" | "void";

/** Which on-chain ride is parked in each room and which part it gives. */
export const ROOM_EXHIBITS: Record<GearRoom, { ride: string; part: string }> = {
  safehouse: { ride: "tank", part: "tread-link" },
  outpost: { ride: "cybertruck", part: "truck-battery" },
  museum: { ride: "bitsaucer", part: "saucer-coil" },
  arcade: { ride: "testarossa", part: "headlamp" },
  cafe: { ride: "cyberpunk-genesis-dog", part: "dog-tag" },
  lab: { ride: "jetpack", part: "jet-nozzle" },
  studio: { ride: "model-s", part: "dash-camera" },
  void: { ride: "spacecraft", part: "nav-chip" },
};

export const GEAR_ITEMS: Record<string, { name: string; icon: string; blurb: string }> = {
  "tread-link": { name: "TANK TREAD LINK", icon: "▤", blurb: "One link off the Safehouse tank. Heavy enough to anchor anything." },
  "truck-battery": { name: "TRUCK BATTERY", icon: "▮", blurb: "Pulled from the Cybertruck at Bitoshi's RV. Still warm." },
  "saucer-coil": { name: "SAUCER COIL", icon: "◎", blurb: "The hum inside the Bitsaucer. It floats a little on its own." },
  headlamp: { name: "TESTAROSSA HEADLAMP", icon: "◐", blurb: "A pop-up headlamp from the Arcade's Ferrari." },
  "dog-tag": { name: "GENESIS DOG TAG", icon: "◇", blurb: "The Cyberpunk Genesis Dog's collar tag. It reads block 0." },
  "jet-nozzle": { name: "JETPACK NOZZLE", icon: "▼", blurb: "Bop's spare jetpack nozzle. Do not point at face." },
  "dash-camera": { name: "MODEL S DASH CAMERA", icon: "▣", blurb: "Recorded everything at the News Studio. Everything." },
  "nav-chip": { name: "SPACECRAFT NAV CHIP", icon: "✦", blurb: "Knows the way out of the Mempool Void." },
  "hover-cell": { name: "HOVER CELL", icon: "⬡", blurb: "Battery + coil. Lifts a skiff off the sand." },
  "signal-flare": { name: "SIGNAL FLARE", icon: "✺", blurb: "Nozzle + headlamp. Visible from any BITMAP." },
  "explorer-scope": { name: "EXPLORER SCOPE", icon: "◉", blurb: "Camera + nav chip. Sees where a sat really went." },
  "skiff-anchor": { name: "SKIFF ANCHOR", icon: "⚓", blurb: "Tread link + dog tag. Holds through any re-org." },
  "skiff-engine": { name: "SKIFF ENGINE", icon: "⚙", blurb: "Hover cell + anchor. Half a hover-skiff." },
  beacon: { name: "HOMING BEACON", icon: "⌖", blurb: "Flare + scope. Finds the crew anywhere." },
  "hover-skiff": { name: "WIERDAMOTO'S HOVER-SKIFF", icon: "★", blurb: "Rebuilt from eight on-chain rides. The Marshal owes you one." },
};

/** Two inputs (order-free) make one output. */
export const RECIPES: { a: string; b: string; out: string }[] = [
  { a: "truck-battery", b: "saucer-coil", out: "hover-cell" },
  { a: "jet-nozzle", b: "headlamp", out: "signal-flare" },
  { a: "dash-camera", b: "nav-chip", out: "explorer-scope" },
  { a: "tread-link", b: "dog-tag", out: "skiff-anchor" },
  { a: "hover-cell", b: "skiff-anchor", out: "skiff-engine" },
  { a: "signal-flare", b: "explorer-scope", out: "beacon" },
  { a: "skiff-engine", b: "beacon", out: "hover-skiff" },
];

export type GearState = { inv: string[]; salvaged: GearRoom[] };
export const blankGear = (): GearState => ({ inv: [], salvaged: [] });

/** Salvage a room's part once; returns null when already taken. */
export function salvage(s: GearState, room: GearRoom): GearState | null {
  if (s.salvaged.includes(room)) return null;
  return { inv: [...s.inv, ROOM_EXHIBITS[room].part], salvaged: [...s.salvaged, room] };
}

export function recipeFor(a: string, b: string) {
  return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) ?? null;
}

/** Combine two held items; both are consumed. Null when nothing fits or an input isn't held. */
export function combine(s: GearState, a: string, b: string): GearState | null {
  if (a === b) return null;
  const r = recipeFor(a, b);
  if (!r || !s.inv.includes(a) || !s.inv.includes(b)) return null;
  return { ...s, inv: [...s.inv.filter((i) => i !== a && i !== b), r.out] };
}

const KEY = "bitmapwin:biternam-gear";
let state: GearState = blankGear();
let loaded = false;
const listeners = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && Array.isArray(v.inv) && Array.isArray(v.salvaged)) state = v; } catch { /* fresh */ }
}
export const gearStore = {
  get: () => { load(); return state; },
  set: (next: GearState) => { state = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ } listeners.forEach((l) => l()); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
const SERVER = blankGear();
export const useGear = () => useSyncExternalStore(gearStore.subscribe, gearStore.get, () => SERVER);

/** Toast channel from 3D exhibits to the DOM locker. */
export const GEAR_EVENT = "biternam-gear";
export const announceGear = (text: string) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(GEAR_EVENT, { detail: text })); };

/** Oasis wearables shown on each room's wall shelf (decor + inspect line, no loot). */
export const ROOM_SHELVES: Record<GearRoom, { id: string; name: string; blurb: string }[]> = {
  safehouse: [{ id: "goggles", name: "NIGHT-VISION GOGGLES", blurb: "The Marshal's stakeout pair." }, { id: "watch", name: "WATCH", blurb: "Set to block time, not clock time." }, { id: "shoes", name: "DESERT SHOES", blurb: "Two years of dust trails." }],
  outpost: [{ id: "shoes", name: "DESERT SHOES", blurb: "Bitoshi's spare pair, still sandy." }, { id: "necklace", name: "NECKLACE", blurb: "Steadies the nerves on long drives." }, { id: "helmet", name: "FLIGHT HELMET", blurb: "For when the RV learns to fly." }],
  museum: [{ id: "comic", name: "COMIC BOOK", blurb: "Issue #1 of the Unreasonables." }, { id: "ring", name: "RING", blurb: "Exhibit B. Do not touch. (You touched it.)" }, { id: "book", name: "MAGIC BOOK", blurb: "The Secret of Low Fees, a replica." }],
  arcade: [{ id: "goggles", name: "NIGHT-VISION GOGGLES", blurb: "Top score prize, never claimed." }, { id: "comic", name: "COMIC BOOK", blurb: "Cheat codes on the back page." }, { id: "watch", name: "WATCH", blurb: "Counts down to the next block." }],
  cafe: [{ id: "hat", name: "WIZARD HAT", blurb: "Left behind by a regular." }, { id: "necklace", name: "NECKLACE", blurb: "Dabber's lucky charm." }, { id: "ring", name: "RING", blurb: "Found in the tip jar." }],
  lab: [{ id: "helmet", name: "FLIGHT HELMET", blurb: "Bop's test-pilot lid." }, { id: "goggles", name: "NIGHT-VISION GOGGLES", blurb: "Boptimized for low light." }, { id: "watch", name: "WATCH", blurb: "Measures latency in heartbeats." }],
  studio: [{ id: "comic", name: "COMIC BOOK", blurb: "Tonight's script, in panels." }, { id: "hat", name: "WIZARD HAT", blurb: "Weather segment costume." }, { id: "shoes", name: "DESERT SHOES", blurb: "The field reporter's pair." }],
  void: [{ id: "ghost", name: "GHOST", blurb: "What you drift as when you're down." }, { id: "book", name: "MAGIC BOOK", blurb: "Pages that rewrite themselves." }, { id: "ring", name: "RING", blurb: "It hums near orphaned blocks." }],
};
