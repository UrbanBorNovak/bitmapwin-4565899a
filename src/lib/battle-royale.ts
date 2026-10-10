/**
 * Battle Royale — one shared match every CYCLE seconds, scheduled by the wall
 * clock. Plane line, storm circles and crate spots are all derived from the
 * match id, so every visitor sees the same dropship and storm with no server
 * round-trip. Joins, eliminations and opened crates are shared over a live
 * channel. Presentation only: nothing here awards BIT.
 */
import { STRIDE, WORLD_CELL, cellX, cellZ, syncCell, type MoveIntent, type PlayerState } from "./player-state";

export type DropPhase = "idle" | "queued" | "plane" | "freefall" | "glide" | "landed";

export const MATCH = {
  cycle: 360,
  lobby: 60,
  hold: 40,
  shrink: 30,
  /** storm radii per phase, world units */
  radii: [STRIDE * 300, STRIDE * 160, STRIDE * 70, STRIDE * 20],
  dps: [2, 4, 8],
  crates: 14,
  pickup: STRIDE * 3,
} as const;

export const DROP = {
  altitude: STRIDE * 120,
  reach: STRIDE * 300,
  flight: 38,
  fall: STRIDE * 22,
  dive: STRIDE * 34,
  fallSteer: STRIDE * 9,
  glideSink: STRIDE * 4.5,
  glideSpeed: STRIDE * 14,
  autoDeploy: STRIDE * 18,
} as const;

export const STORM_START = MATCH.lobby + DROP.flight;

// ---------- deterministic match ----------
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Crate = { id: number; x: number; z: number; kind: "medkit" | "bigmed" | "shield" };
export type Match = {
  id: number;
  cx: number;
  cz: number;
  yaw: number;
  circles: { x: number; z: number; r: number }[];
  crates: Crate[];
};

const cache = new Map<number, Match>();
export function matchById(id: number): Match {
  const hit = cache.get(id);
  if (hit) return hit;
  const r = rng(id * 2654435761);
  const col = 120 + Math.floor(r() * 760);
  const row = 120 + Math.floor(r() * 760);
  const cx = cellX(col);
  const cz = cellZ(row);
  const yaw = r() * Math.PI * 2;
  const circles = [{ x: cx, z: cz, r: MATCH.radii[0] }];
  for (let i = 1; i < MATCH.radii.length; i++) {
    const prev = circles[i - 1]!;
    const nr = MATCH.radii[i]!;
    const a = r() * Math.PI * 2;
    const d = r() * (prev.r - nr);
    circles.push({ x: prev.x + Math.sin(a) * d, z: prev.z + Math.cos(a) * d, r: nr });
  }
  const crates: Crate[] = [];
  for (let i = 0; i < MATCH.crates; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * MATCH.radii[0] * 0.9;
    const roll = r();
    crates.push({ id: i, x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d, kind: roll < 0.5 ? "medkit" : roll < 0.8 ? "shield" : "bigmed" });
  }
  const m = { id, cx, cz, yaw, circles, crates };
  cache.set(id, m);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return m;
}

export const clock = (now = Date.now()) => {
  const s = now / 1000;
  const id = Math.floor(s / MATCH.cycle);
  return { id, t: s - id * MATCH.cycle };
};

export function planeAt(m: Match, t: number) {
  const p = Math.min(1, Math.max(0, (t - MATCH.lobby) / DROP.flight));
  const dx = Math.sin(m.yaw) * DROP.reach;
  const dz = Math.cos(m.yaw) * DROP.reach;
  return { x: m.cx - dx + 2 * dx * p, z: m.cz - dz + 2 * dz * p, yaw: m.yaw, p, flying: t >= MATCH.lobby && t < STORM_START };
}

/** Current safe circle, or null before the storm forms. */
export function stormAt(m: Match, t: number) {
  if (t < STORM_START) return null;
  const into = t - STORM_START;
  const step = MATCH.hold + MATCH.shrink;
  const i = Math.min(MATCH.dps.length, Math.floor(into / step));
  if (i >= MATCH.dps.length) {
    const c = m.circles[MATCH.dps.length]!;
    return { ...c, phase: i, shrinking: false, next: 0, dps: MATCH.dps[MATCH.dps.length - 1]! * 2 };
  }
  const local = into - i * step;
  const a = m.circles[i]!;
  const b = m.circles[i + 1]!;
  const k = local <= MATCH.hold ? 0 : (local - MATCH.hold) / MATCH.shrink;
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    r: a.r + (b.r - a.r) * k,
    phase: i,
    shrinking: k > 0,
    next: Math.ceil(local <= MATCH.hold ? MATCH.hold - local : step - local),
    dps: MATCH.dps[i]!,
  };
}

// ---------- local state + shared roster ----------
type State = {
  phase: DropPhase;
  matchId: number;
  baseY: number;
  landedAt: number;
  shieldUntil: number;
  outside: boolean;
  result: "eliminated" | "victory" | "survived" | null;
  joined: Set<string>;
  out: Set<string>;
  opened: Set<string>;
  note: string | null;
};
const state: State = {
  phase: "idle", matchId: -1, baseY: 0, landedAt: 0, shieldUntil: 0, outside: false, result: null,
  joined: new Set(), out: new Set(), opened: new Set(), note: null,
};
const listeners = new Set<() => void>();
let rev = 0;
const emit = () => { rev++; for (const l of listeners) l(); };
export const subscribeDrop = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const dropRevision = () => rev;
export const dropState = () => state;
export const inMatch = () => state.phase !== "idle";
export const alive = () => [...state.joined].filter((p) => !state.out.has(p)).length;

type Hooks = { hurt: (d: number) => void; heal: (n: number) => void; send: (event: string, payload: Record<string, unknown>) => void; me: string };
let hooks: Hooks = { hurt: () => {}, heal: () => {}, send: () => {}, me: "" };
export const setBrHooks = (h: Partial<Hooks>) => { hooks = { ...hooks, ...h }; };

/** Remote events from the live channel. */
export function onBrEvent(event: string, p: { match?: number; id?: string; crate?: number }) {
  const { id: now } = clock();
  if (p.match !== now) return;
  if (state.matchId !== now) resetRoster(now);
  if (event === "join" && p.id) state.joined.add(p.id);
  if (event === "out" && p.id) state.out.add(p.id);
  if (event === "crate" && p.crate !== undefined) state.opened.add(`${now}:${p.crate}`);
  emit();
}
function resetRoster(id: number) {
  state.matchId = id;
  state.joined = new Set();
  state.out = new Set();
  state.opened = new Set([...state.opened].filter((k) => k.startsWith(`${id}:`)));
}

export function requestDrop() {
  const { id, t } = clock();
  if (state.phase !== "idle" || t >= STORM_START) return;
  if (state.matchId !== id) resetRoster(id);
  state.phase = "queued";
  state.result = null;
  state.joined.add(hooks.me);
  hooks.send("join", { match: id, id: hooks.me });
  emit();
}

export function dropAction() {
  if (state.phase === "plane") state.phase = "freefall";
  else if (state.phase === "freefall") state.phase = "glide";
  else return;
  emit();
}

function leave(result: State["result"]) {
  if (state.phase === "idle") return;
  state.phase = "idle";
  state.result = result;
  state.outside = false;
  if (result === "eliminated") {
    state.out.add(hooks.me);
    hooks.send("out", { match: state.matchId, id: hooks.me });
  }
  emit();
}
export const cancelDrop = () => leave("eliminated");
export const clearResult = () => { state.result = null; emit(); };

let stormTick = 0;
let watch = 0;

/** Runs every frame before stepPlayer. Returns true when it moved the player. */
export function stepDrop(player: PlayerState, intent: MoveIntent, rawDelta: number, surface: (x: number, z: number) => number): boolean {
  const dt = Math.min(Math.max(rawDelta, 0), 0.05);
  if (state.phase === "idle") return false;
  const { id, t } = clock();
  if (id !== state.matchId) { leave(alive() <= 1 ? "victory" : "survived"); return false; }
  if (player.combat === "down") { leave("eliminated"); return false; }
  const m = matchById(id);

  // storm + crates + win check for everyone who is in the match
  const storm = stormAt(m, t);
  if (storm) {
    const outside = Math.hypot(player.x - storm.x, player.z - storm.z) > storm.r;
    if (outside !== state.outside) { state.outside = outside; emit(); }
    stormTick += dt;
    if (stormTick >= 1) {
      stormTick = 0;
      if (outside && Date.now() > state.shieldUntil) hooks.hurt(storm.dps);
    }
    if (state.joined.size > 1 && alive() <= 1 && state.phase === "landed") { leave("victory"); return false; }
  }
  watch += dt;
  if (watch > 0.25) { watch = 0; emit(); }

  if (state.phase === "queued") {
    if (t < MATCH.lobby) return false;
    state.phase = "plane";
    state.baseY = surface(m.cx, m.cz) + DROP.altitude;
    emit();
  }
  if (state.phase === "landed") {
    for (const c of m.crates) {
      const key = `${id}:${c.id}`;
      if (state.opened.has(key)) continue;
      if (Math.hypot(player.x - c.x, player.z - c.z) < MATCH.pickup) {
        state.opened.add(key);
        hooks.send("crate", { match: id, crate: c.id });
        if (c.kind === "medkit") { hooks.heal(40); state.note = "MEDKIT · +40 HP"; }
        else if (c.kind === "bigmed") { hooks.heal(100); state.note = "FIELD KIT · FULL HEAL"; }
        else { state.shieldUntil = Date.now() + 15_000; state.note = "STORM SHIELD · 15s"; }
        window.setTimeout(() => { state.note = null; emit(); }, 2200);
        emit();
      }
    }
    return false;
  }

  if (state.phase === "plane") {
    const at = planeAt(m, t);
    player.x = at.x;
    player.z = at.z;
    player.y = state.baseY - surface(at.x, at.z) - STRIDE * 1.5;
    player.yaw = at.yaw;
    player.vx = (Math.sin(at.yaw) * DROP.reach * 2) / DROP.flight;
    player.vz = (Math.cos(at.yaw) * DROP.reach * 2) / DROP.flight;
    player.vy = 0;
    if (at.p >= 1) { state.phase = "freefall"; emit(); }
  } else {
    player.yaw += intent.turn * 2.4 * dt;
    const gliding = state.phase === "glide";
    const fwd = gliding ? Math.max(0.35, intent.forward) : intent.forward;
    const steer = gliding ? DROP.glideSpeed : DROP.fallSteer;
    const wantX = (Math.sin(player.yaw) * fwd + Math.cos(player.yaw) * intent.strafe) * steer;
    const wantZ = (Math.cos(player.yaw) * fwd - Math.sin(player.yaw) * intent.strafe) * steer;
    const k = 1 - Math.exp(-3 * dt);
    player.vx += (wantX - player.vx) * k;
    player.vz += (wantZ - player.vz) * k;
    const sink = gliding ? DROP.glideSink : intent.forward > 0 ? DROP.dive : DROP.fall;
    player.vy += (-sink - player.vy) * (1 - Math.exp(-(gliding ? 4 : 1.6) * dt));
    const before = player.y + surface(player.x, player.z);
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.y = before + player.vy * dt - surface(player.x, player.z);
    if (!gliding && player.y < DROP.autoDeploy) { state.phase = "glide"; emit(); }
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.vx = 0;
      player.vz = 0;
      player.grounded = true;
      state.phase = "landed";
      state.landedAt = Date.now();
      emit();
      syncCell(player);
      return true;
    }
  }
  player.grounded = false;
  player.animation = "jump";
  player.movement = "idle";
  player.target = null;
  syncCell(player);
  return true;
}

/** sanity for tests */
export const _cellSize = WORLD_CELL;
