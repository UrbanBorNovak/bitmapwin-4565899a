import { ATLAS_POOL } from "./cardFactory";
import { rng } from "./engine";
import { supabase } from "@/integrations/supabase/client";

/** SOLO CUP — an 8-seat knockout bracket against game-run rival decks. Stored on this device. */
/** Rivals are real BITMAPs: `height` leads, `deck` is the 5 BITMAPs they field (their builds count live). */
export type CupEntrant = { name: string; you?: boolean; height?: number; deck?: number[] };
export type CupState = {
  id: string;
  seed: number;
  startedAt: number;
  entrants: CupEntrant[];
  /** rounds[r][m] = winner index or null */
  rounds: (number | null)[][];
  round: number;
  status: "running" | "won" | "out";
};
export type CupRecord = { cupsPlayed: number; cupsWon: number; best: string };

const KEY = "bitmapwin.play.cup.v1";
const REC = "bitmapwin.play.cup-record.v1";
export const CUP_ROUNDS = ["QUARTER-FINAL", "SEMI-FINAL", "FINAL"];

export function readCup(): CupState | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null") as CupState | null; } catch { return null; }
}
export function readCupRecord(): CupRecord {
  try { return { cupsPlayed: 0, cupsWon: 0, best: "—", ...(JSON.parse(localStorage.getItem(REC) ?? "{}") as Partial<CupRecord>) }; } catch { return { cupsPlayed: 0, cupsWon: 0, best: "—" }; }
}
function save(c: CupState | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* private */ }
  window.dispatchEvent(new Event("bitmapwin-cup"));
}

/** BITMAPs that carry real Oasis builds, most-built first. */
async function builtHeights(): Promise<number[]> {
  try {
    const { data } = await supabase.from("world_structures").select("bitmap_height").limit(2000);
    const n = new Map<number, number>();
    for (const r of data ?? []) n.set(Number(r.bitmap_height), (n.get(Number(r.bitmap_height)) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  } catch { return []; }
}

export async function startCup(exclude: number[] = []): Promise<CupState> {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const r = rng(seed);
  const skip = new Set(exclude);
  const built = (await builtHeights()).filter((h) => !skip.has(h));
  const atlas = [...ATLAS_POOL].filter((h) => !skip.has(h) && !built.includes(h)).sort(() => r() - 0.5);
  const leaders = [...built.slice(0, 7), ...atlas].slice(0, 7);
  const spare = [...built.slice(7), ...atlas.filter((h) => !leaders.includes(h))];
  const rivals = leaders.map((h, i) => {
    const deck = [h];
    for (let k = 0; deck.length < 5 && k < spare.length; k++) { const c = spare[(i * 4 + k) % spare.length]!; if (!deck.includes(c)) deck.push(c); }
    return { name: `${h}.BITMAP`, height: h, deck };
  });
  const cup: CupState = {
    id: seed.toString(36),
    seed,
    startedAt: Date.now(),
    entrants: [{ name: "YOU", you: true }, ...rivals.sort(() => r() - 0.5)],
    rounds: [[null, null, null, null], [null, null], [null]],
    round: 0,
    status: "running",
  };
  save(cup);
  return cup;
}
export function abandonCup() { save(null); }

/** Entrant indices meeting in match m of round r. */
export function pairOf(c: CupState, r: number, m: number): [number | null, number | null] {
  if (r === 0) return [m * 2, m * 2 + 1];
  return [c.rounds[r - 1]![m * 2] ?? null, c.rounds[r - 1]![m * 2 + 1] ?? null];
}
export function yourMatch(c: CupState) {
  const i = c.rounds[c.round]!.findIndex((_, m) => pairOf(c, c.round, m).includes(0));
  return i;
}
/** The rival entrant you face this round. */
export function yourRival(c: CupState): CupEntrant | null {
  const m = yourMatch(c);
  if (m < 0) return null;
  const [a, b] = pairOf(c, c.round, m);
  const o = a === 0 ? b : a;
  return o === null ? null : c.entrants[o] ?? null;
}
/** Seed for your match this round — also picks the rival deck. */
export const cupMatchSeed = (c: CupState) => (c.seed + (c.round + 1) * 104_729) >>> 0;

export function reportCup(win: boolean) {
  const c = readCup();
  if (!c || c.status !== "running") return;
  const r = rng(c.seed ^ (c.round * 7919));
  const round = c.rounds[c.round]!;
  round.forEach((_, m) => {
    const [a, b] = pairOf(c, c.round, m);
    if (a === 0 || b === 0) round[m] = win ? 0 : a === 0 ? b : a;
    else round[m] = r() < 0.5 ? a : b;
  });
  const rec = readCupRecord();
  const reached = CUP_ROUNDS[c.round]!;
  if (!win) {
    c.status = "out";
  } else if (c.round === CUP_ROUNDS.length - 1) {
    c.status = "won";
  } else c.round += 1;
  if (c.status !== "running") {
    rec.cupsPlayed += 1;
    if (c.status === "won") { rec.cupsWon += 1; rec.best = "CHAMPION"; }
    else if (rec.best !== "CHAMPION" && CUP_ROUNDS.indexOf(rec.best) < CUP_ROUNDS.indexOf(reached)) rec.best = reached;
    try { localStorage.setItem(REC, JSON.stringify(rec)); } catch { /* private */ }
  }
  save(c);
}
