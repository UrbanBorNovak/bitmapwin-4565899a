/**
 * GUARDIAN DISPATCH — shared route maths. A dispatch is a list of BITMAP
 * heights walked at constant speed between server timestamps, so every
 * player computes the exact same position for a commanded Guardian.
 */
import { WORLD_GRID, cellX, cellZ } from "@/lib/player-state";

export type Directive = "patrol" | "march" | "farm";
export const DIRECTIVES: { id: Directive; label: string; note: string }[] = [
  { id: "patrol", label: "PATROL", note: "Walks a ring around its home BITMAP." },
  { id: "march", label: "MARCH", note: "Travels to a target BITMAP, holds, then returns home." },
  { id: "farm", label: "AUTO-FARM", note: "Walker loop through nearby BITMAPs, then home." },
];

/** Max march distance in BITMAP widths. */
export const MAX_RANGE = 16;
const HOLD_SECONDS = 30;

export const colOf = (h: number) => h % WORLD_GRID;
export const rowOf = (h: number) => Math.floor(h / WORLD_GRID);
const at = (c: number, r: number) => r * WORLD_GRID + c;
const valid = (c: number, r: number) => c >= 0 && r >= 0 && c < WORLD_GRID;

export function cellDistance(a: number, b: number) {
  return Math.hypot(colOf(a) - colOf(b), rowOf(a) - rowOf(b));
}

/** Cells per second for a Guardian with this speed stat. */
export const cellsPerSecond = (speed: number) => 0.05 * (1 + Math.max(0, speed) / 60);

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function planRoute(directive: Directive, home: number, target: number | null, seed: number): number[] {
  const hc = colOf(home), hr = rowOf(home);
  if (directive === "march" && target != null) return [home, target, target, home];
  if (directive === "patrol") {
    const ring: number[] = [home];
    for (let lap = 0; lap < 2; lap++)
      for (const [dc, dr] of [[-2, -2], [2, -2], [2, 2], [-2, 2]] as const) if (valid(hc + dc, hr + dr)) ring.push(at(hc + dc, hr + dr));
    ring.push(home);
    return ring;
  }
  const rnd = seeded(seed);
  const pts = [home];
  for (let i = 0; i < 5; i++) {
    const c = hc + Math.round((rnd() * 2 - 1) * 4);
    const r = hr + Math.round((rnd() * 2 - 1) * 4);
    if (valid(c, r)) pts.push(at(c, r));
  }
  pts.push(home);
  return pts;
}

/** Seconds a route takes, including the hold at a march target. */
export function routeSeconds(points: number[], speed: number, directive: Directive) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += cellDistance(points[i - 1]!, points[i]!);
  return Math.ceil(len / cellsPerSecond(speed)) + (directive === "march" ? HOLD_SECONDS : 0);
}

/** World position along the route at `now`, constant speed between start and end. */
export function positionAt(points: number[], startMs: number, endMs: number, now: number) {
  const pos = points.map((h) => ({ x: cellX(colOf(h)), z: cellZ(rowOf(h)) }));
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pos.length; i++) {
    const d = Math.hypot(pos[i]!.x - pos[i - 1]!.x, pos[i]!.z - pos[i - 1]!.z);
    segs.push(d);
    total += d;
  }
  const f = Math.min(1, Math.max(0, (now - startMs) / Math.max(1, endMs - startMs)));
  let want = f * total;
  for (let i = 0; i < segs.length; i++) {
    const a = pos[i]!, b = pos[i + 1]!;
    const sg = segs[i]!;
    if (want <= sg || i === segs.length - 1) {
      const k = sg ? Math.min(1, want / sg) : 1;
      const yaw = sg ? Math.atan2(b.x - a.x, b.z - a.z) : 0;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw, moving: sg > 0, progress: f, leg: i };
    }
    want -= sg;
  }
  return { x: pos[0]?.x ?? 0, z: pos[0]?.z ?? 0, yaw: 0, moving: false, progress: f, leg: 0 };
}

export type Dispatch = {
  id: string;
  height: number;
  directive: Directive;
  target: number | null;
  waypoints: number[];
  startMs: number;
  endMs: number;
};

export const DISPATCH_COLS = "id, guardian_height, directive, target_height, waypoints, started_at, ends_at";
export function toDispatch(r: {
  id: string; guardian_height: number; directive: string; target_height: number | null;
  waypoints: unknown; started_at: string; ends_at: string;
}): Dispatch {
  return {
    id: r.id,
    height: Number(r.guardian_height),
    directive: r.directive as Directive,
    target: r.target_height == null ? null : Number(r.target_height),
    waypoints: Array.isArray(r.waypoints) ? (r.waypoints as unknown[]).map(Number) : [Number(r.guardian_height)],
    startMs: Date.parse(r.started_at),
    endMs: Date.parse(r.ends_at),
  };
}
