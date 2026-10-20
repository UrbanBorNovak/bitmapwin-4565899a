/**
 * OASIS CINEMATICS — short establishing shots that play the first time a
 * walker comes near a key landmark. The camera detaches for a few seconds,
 * circles the building, then hands back. Any movement key, Space or Esc
 * skips it instantly. Shots are pure functions of elapsed time, so the
 * flyby is identical every time.
 */
import { LANDMARKS, landmarkSpot, type LandmarkSpec } from "./world-landmarks";
import { WORLD_CELL } from "./player-state";

export type ShotMove = "orbit" | "push" | "rise";

export type CinematicShot = {
  id: string;
  landmarkId: string;
  title: string;
  line: string;
  move: ShotMove;
  /** seconds */
  duration: number;
  /** trigger distance from landmark centre, in BITMAPS */
  reach: number;
};

export const CINEMATIC_SHOTS: CinematicShot[] = [
  { id: "torii", landmarkId: "torii", title: "SACRED BITMAP TORII GATE", line: "The gate into the plaza. Every walker passes under it once.", move: "rise", duration: 5, reach: 1.6 },
  { id: "bit-cafe", landmarkId: "bit-cafe", title: "BIT CAFE", line: "The meeting house. Gossip here is cheaper than block space.", move: "orbit", duration: 5, reach: 2.2 },
  { id: "tower", landmarkId: "tower", title: "METAVOXEL TOWER", line: "Tallest thing on the sand. If you're lost, look up.", move: "rise", duration: 6, reach: 2.2 },
  { id: "arena", landmarkId: "arena", title: "THE ARENA", line: "Fights and raids end up here. Try not to end up with them.", move: "orbit", duration: 5, reach: 2.4 },
  { id: "mayor-pepe", landmarkId: "mayor-pepe", title: "MAYOR PEPE", line: "Centre of the whole map. He sees everything. Mostly memes.", move: "push", duration: 5, reach: 2.4 },
  { id: "bit-museum", landmarkId: "bit-museum", title: "THE BIT MUSEUM", line: "Where the Oasis keeps its history. Only the chain-proven kind.", move: "push", duration: 5, reach: 2.2 },
  { id: "trading-post", landmarkId: "trading-post", title: "THE TRADING POST", line: "Goods in, BIT out. Read the board before you haggle.", move: "orbit", duration: 5, reach: 2 },
].filter((shot) => LANDMARKS.some((spec) => spec.id === shot.landmarkId));

const specFor = (shot: CinematicShot): LandmarkSpec =>
  LANDMARKS.find((spec) => spec.id === shot.landmarkId)!;

/** The first not-yet-seen shot whose landmark is within reach. */
export function shotInReach(x: number, z: number, seen: ReadonlySet<string>): CinematicShot | null {
  for (const shot of CINEMATIC_SHOTS) {
    if (seen.has(shot.id)) continue;
    const spot = landmarkSpot(specFor(shot));
    if (Math.hypot(spot.x - x, spot.z - z) <= shot.reach * WORLD_CELL) return shot;
  }
  return null;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Camera position and look target `t` seconds into a shot. `groundAt` gives
 * terrain height so the shot never dips underground.
 */
export function shotFrame(shot: CinematicShot, t: number, groundAt: (x: number, z: number) => number) {
  const spec = specFor(shot);
  const spot = landmarkSpot(spec);
  const size = spec.span * WORLD_CELL;
  const k = ease(Math.min(1, Math.max(0, t / shot.duration)));
  const g = groundAt(spot.x, spot.z);
  let angle = spec.yaw + Math.PI * 0.25;
  let dist = size * 1.8;
  let up = size * 0.6;
  if (shot.move === "orbit") angle += k * Math.PI * 0.7;
  else if (shot.move === "push") dist = size * (2.6 - k * 1.2);
  else up = size * (0.15 + k * 1.1);
  const cx = spot.x + Math.cos(angle) * dist;
  const cz = spot.z + Math.sin(angle) * dist;
  const cy = Math.max(groundAt(cx, cz) + size * 0.1, g + up);
  return {
    position: { x: cx, y: cy, z: cz },
    look: { x: spot.x, y: g + size * 0.45, z: spot.z },
  };
}

/* ---------- session store: which shot plays, which have been seen ---------- */

type Active = { shot: CinematicShot; startedAt: number } | null;
let active: Active = null;
const seen = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const cinematics = {
  seen: seen as ReadonlySet<string>,
  active: () => active,
  start(shot: CinematicShot, now: number) {
    seen.add(shot.id);
    active = { shot, startedAt: now };
    emit();
  },
  stop() {
    if (!active) return;
    active = null;
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Keys that skip a playing shot. */
export const SKIP_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "escape"]);
