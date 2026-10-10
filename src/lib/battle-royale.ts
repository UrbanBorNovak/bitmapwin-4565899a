/**
 * Battle Royale drop — phase 1: dropship flight, eject, freefall, glider, landing.
 * Device-local presentation only: it moves the visitor's own avatar and never
 * settles anything (no BIT, no kills). The storm circle comes in a later phase.
 */
import { STRIDE, WORLD_UNITS, syncCell, type MoveIntent, type PlayerState } from "./player-state";

export type DropPhase = "idle" | "plane" | "freefall" | "glide";

/** Feel constants, in world units (one STRIDE = one avatar step). */
export const DROP = {
  /** plane altitude above the start ground */
  altitude: STRIDE * 120,
  /** half the flight line length */
  reach: STRIDE * 300,
  /** seconds to fly the whole line */
  flight: 38,
  /** freefall terminal sink, and the steeper dive while holding forward */
  fall: STRIDE * 22,
  dive: STRIDE * 34,
  fallSteer: STRIDE * 9,
  /** glider sink and cruise */
  glideSink: STRIDE * 4.5,
  glideSpeed: STRIDE * 14,
  /** the glider pops open by itself below this height */
  autoDeploy: STRIDE * 18,
} as const;

type Path = { ax: number; az: number; bx: number; bz: number; y: number; yaw: number };

type State = { phase: DropPhase; t: number; path: Path | null; pending: boolean; landedAt: number };
const state: State = { phase: "idle", t: 0, path: null, pending: false, landedAt: 0 };
const listeners = new Set<() => void>();
let rev = 0;
const emit = () => {
  rev++;
  for (const l of listeners) l();
};

export const subscribeDrop = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const dropRevision = () => rev;
export const dropState = () => state;

/** Opt in: the next world frame builds a flight line across the visitor. */
export function requestDrop() {
  if (state.phase !== "idle") return;
  state.pending = true;
  emit();
}

/** SPACE: jump out of the plane, then open the glider. */
export function dropAction() {
  if (state.phase === "plane") {
    state.phase = "freefall";
    emit();
  } else if (state.phase === "freefall") {
    state.phase = "glide";
    emit();
  }
}

export function cancelDrop() {
  state.phase = "idle";
  state.pending = false;
  state.path = null;
  emit();
}

const clampX = (x: number) => Math.max(-WORLD_UNITS / 2 + 0.05, Math.min(WORLD_UNITS / 2 - 0.05, x));
const clampZ = (z: number) => Math.max(0.05, Math.min(WORLD_UNITS - 0.05, z));

/** Plane position at progress 0..1 along its line. */
export function planeAt(p: number) {
  const path = state.path;
  if (!path) return null;
  return {
    x: path.ax + (path.bx - path.ax) * p,
    z: path.az + (path.bz - path.az) * p,
    y: path.y,
    yaw: path.yaw,
  };
}

export const planeProgress = () => Math.min(1, state.t / DROP.flight);

/**
 * Runs in place of stepPlayer while a drop is on. Returns false when the
 * normal walker should move the player instead.
 */
export function stepDrop(
  player: PlayerState,
  intent: MoveIntent,
  rawDelta: number,
  surface: (x: number, z: number) => number,
): boolean {
  const dt = Math.min(Math.max(rawDelta, 0), 0.05);
  if (state.pending) {
    state.pending = false;
    const yaw = Math.random() * Math.PI * 2;
    const dx = Math.sin(yaw) * DROP.reach;
    const dz = Math.cos(yaw) * DROP.reach;
    const y = surface(player.x, player.z) + DROP.altitude;
    state.path = {
      ax: clampX(player.x - dx),
      az: clampZ(player.z - dz),
      bx: clampX(player.x + dx),
      bz: clampZ(player.z + dz),
      y,
      yaw,
    };
    state.t = 0;
    state.phase = "plane";
    emit();
  }
  if (state.phase === "idle") return false;
  if (player.combat === "down") {
    cancelDrop();
    return false;
  }

  if (state.phase === "plane") {
    state.t += dt;
    const p = planeProgress();
    const at = planeAt(p)!;
    player.x = at.x;
    player.z = at.z;
    player.y = at.y - surface(at.x, at.z) - STRIDE * 1.5;
    player.yaw = at.yaw;
    player.vx = (Math.sin(at.yaw) * DROP.reach * 2) / DROP.flight;
    player.vz = (Math.cos(at.yaw) * DROP.reach * 2) / DROP.flight;
    player.vy = 0;
    // End of the line: the jumpmaster pushes you out.
    if (p >= 1) {
      state.phase = "freefall";
      emit();
    }
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
    player.x = clampX(player.x + player.vx * dt);
    player.z = clampZ(player.z + player.vz * dt);
    const ground = surface(player.x, player.z);
    const worldY = player.y + surface(player.x - player.vx * dt, player.z - player.vz * dt);
    player.y = worldY + player.vy * dt - ground;
    if (!gliding && player.y < DROP.autoDeploy) {
      state.phase = "glide";
      emit();
    }
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      state.phase = "idle";
      state.path = null;
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
