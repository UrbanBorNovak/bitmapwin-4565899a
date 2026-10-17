/**
 * Tiny event bus for the pixel stickman mascot. Any component can nudge the
 * mascot into a short reaction without importing the component itself.
 */

export type MascotMood = "idle" | "think" | "cheer" | "alert";

export type MascotReaction = { text: string; mood: MascotMood };

type Listener = (reaction: MascotReaction) => void;

const listeners = new Set<Listener>();

export function onMascot(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Show a short line above the mascot. Keep it terminal-short, ALL CAPS reads best. */
export function mascotReact(text: string, mood: MascotMood = "cheer") {
  listeners.forEach((listener) => listener({ text, mood }));
}

/** Ambient thoughts while roaming. */
export const MASCOT_THOUGHTS = [
  "SCANNING BLOCKS…",
  "SUB 10K LOOKS THIN",
  "CHECKING THE BID BOOK",
  "SATS DON'T LIE",
  "THE INDEX NEVER SLEEPS",
  "SOMEONE SHOULD BUILD HERE",
  "WATCHING THE MEMPOOL",
  "LOW FLOOR = GOOD DAY",
];

/** Route-aware greetings, matched longest-prefix first. */
const ROUTE_LINES: Array<[string, string]> = [
  ["/marketplace", "ASKS, BIDS, SPREAD — LOOK HERE"],
  ["/collections", "CLUBS SORTED BY BLOCK RANGE"],
  ["/builds", "SOMEONE'S BUILDING AGAIN"],
  ["/leases", "RENT A BITMAP, KEEP THE BUILD"],
  ["/coins", "BIT EARNED BY ATTENTION"],
  ["/dashboard", "YOUR PORTFOLIO NEEDS EYES"],
  ["/wallet", "LIST, UNLIST, SIGN"],
  ["/bitmap/", "READING THIS BLOCK…"],
  ["/profile/", "NICE COLLECTION"],
  ["/auth", "SIGN IN WITH A WALLET"],
  ["/", "WELCOME TO BITCOIN LAND"],
];

export function mascotLineForPath(pathname: string): string {
  const hit = ROUTE_LINES.find(([prefix]) => pathname.startsWith(prefix) && prefix !== "/");
  if (hit) return hit[1];
  return pathname === "/" ? "WELCOME TO BITCOIN LAND" : "STILL EXPLORING…";
}
