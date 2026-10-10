/**
 * Land-map player model and movement simulation.
 *
 * The client simulates its own avatar every frame (prediction) and smooths
 * every peer between the sparse broadcasts it receives (interpolation) so the
 * world stays fluid while multiplayer traffic trickles in.
 *
 * Authority boundary: this module is presentation and feel only. It never
 * decides anything the game is settled on — ownership, listings, trades and
 * balances all come from the chain and the database. Incoming peer movement is
 * validated and clamped here (`clampPeerStep`) precisely because a client is
 * never trusted with world state: a peer can only ever move itself, at most at
 * the shared maximum speed, inside the world bounds.
 */

/** Districts per side of the world grid — mirrors the 3D world. */
export const WORLD_GRID = 1_000;
/** World units across one side of the terrain. */
export const WORLD_UNITS = 850;
/** World units per district cell. */
export const WORLD_CELL = WORLD_UNITS / WORLD_GRID;
/** Chunk side in cells — the region label a player reports as their locale. */
export const CHUNK_CELLS = 50;

/**
 * One stride unit — the avatar's own scale. A BITMAP is ten strides across, so
 * districts read as walkable plots rather than single steps.
 */
export const STRIDE = 0.01;

/** Tuning constants for movement feel. Tune these, never the integrator. */
export const MOVE = {
  /** top walking speed in world units per second */
  walkSpeed: STRIDE * 7.15,
  /** multiplier while sprinting */
  sprint: 1.72,
  jumpSpeed: STRIDE * 28,
  gravity: STRIDE * 78,
  /** how hard the avatar accelerates toward the wanted velocity */
  accel: 18,
  /** exponential damping applied when no input is held */
  drag: 11,
  /** keyboard turn rate in radians per second */
  turnRate: 3.25,

  /** how fast the body swings toward the direction it is travelling */
  faceRate: 12,
  /** click-to-move stops inside this radius */
  arrive: STRIDE * 1.4,
  /** speed below which the player counts as idle */
  idleSpeed: STRIDE * 0.6,
} as const;

/**
 * Absolute traversal ceiling. Even a stacked equipment or vehicle bonus may
 * not move farther than the streamer can safely prepare in front of it.
 */
export const TRAVERSAL_SPEED_CAP = STRIDE * 32;
/** Spacecraft afterburner ceiling — high above the land it may outrun the ground. */
export const SPACECRAFT_SPEED_CAP = STRIDE * 140;

export type MovementState = "idle" | "walk" | "run" | "turn";
export type AnimationState = "idle" | "walk" | "run" | "jump" | "hurt" | "attack" | "down";
export type CombatState = "alive" | "attacking" | "hurt" | "down";

/** Everything the world needs to know about one player, self or peer. */
export type PlayerState = {
  /** world position on the terrain plane */
  x: number;
  z: number;
  /** current velocity in world units per second */
  vx: number;
  vz: number;
  /** vertical offset and velocity above the terrain */
  y: number;
  vy: number;
  grounded: boolean;
  /** facing, radians — also the camera yaw in third person */
  yaw: number;
  movement: MovementState;
  animation: AnimationState;
  combat: CombatState;
  /** district cell the player stands on */
  col: number;
  row: number;
  height: number;
  /** coarse region key, cheap to compare and to label */
  chunk: string;
  /** click/tap destination the player is walking to, if any */
  target: { x: number; z: number } | null;
  /** forward body tilt, radians — leans into flight, flat on foot */
  lean: number;
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export const cellX = (col: number) => (col + 0.5) * WORLD_CELL - WORLD_UNITS / 2;
export const cellZ = (row: number) => (row + 0.5) * WORLD_CELL;

export function colAt(x: number) {
  return clamp(Math.floor((x + WORLD_UNITS / 2) / WORLD_CELL), 0, WORLD_GRID - 1);
}
export function rowAt(z: number) {
  return clamp(Math.floor(z / WORLD_CELL), 0, WORLD_GRID - 1);
}
export function chunkKey(col: number, row: number) {
  return `${Math.floor(col / CHUNK_CELLS)}:${Math.floor(row / CHUNK_CELLS)}`;
}

export function createPlayerState(x = 0, z = WORLD_CELL, yaw = 0): PlayerState {
  const col = colAt(x);
  const row = rowAt(z);
  return {
    x,
    z,
    vx: 0,
    vz: 0,
    y: 0,
    vy: 0,
    grounded: true,
    yaw,
    movement: "idle",
    animation: "idle",
    combat: "alive",
    col,
    row,
    height: row * WORLD_GRID + col,
    chunk: chunkKey(col, row),
    target: null,
    lean: 0,
  };
}

/** Teleport (spawn / respawn) — clears momentum and any walk target. */
export function placePlayer(player: PlayerState, x: number, z: number, yaw = player.yaw) {
  player.x = x;
  player.z = z;
  player.vx = 0;
  player.vz = 0;
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.yaw = yaw;
  player.target = null;
  player.movement = "idle";
  player.animation = "idle";
  syncCell(player);
}

export function syncCell(player: PlayerState) {
  player.col = colAt(player.x);
  player.row = rowAt(player.z);
  player.height = player.row * WORLD_GRID + player.col;
  player.chunk = chunkKey(player.col, player.row);
}

/**
 * Height you must gain before you are clear of everything on the ground: above
 * this, walls and props pass under you and nothing down there can reach you.
 */
export const FLY_CLEARANCE = STRIDE * 5;

/** True once the body is high enough to be over the props and out of reach. */
export const aloft = (player: { y: number } | null | undefined) =>
  Boolean(player && player.y > FLY_CLEARANCE);

/** Ground speed above which the visitor counts as racing past the scenery. */
export const FAST_PACE = MOVE.walkSpeed * 2.2;

/**
 * SIMULATION BUDGET — while the visitor is flying or racing past, the crowd on
 * the ground is out of reach and out of the fight, so their brains only need a
 * handful of ticks a second instead of one per frame. Returns the delta to
 * simulate with, or null when this frame should be skipped entirely.
 */
export function simDelta(
  budget: { current: number },
  rawDelta: number,
  pose: { current: unknown } | null | undefined,
) {
  const step = Math.min(rawDelta, 0.05);
  const player = pose?.current as { vx?: number; vz?: number; y?: number } | null;
  const racing =
    !!player &&
    (aloft(player as { y: number }) ||
      Math.hypot(player.vx ?? 0, player.vz ?? 0) > FAST_PACE);
  if (!racing) {
    budget.current = 0;
    return step;
  }
  budget.current += rawDelta;
  if (budget.current < 0.14) return null;
  const spent = Math.min(budget.current, 0.05);
  budget.current = 0;
  return spent;
}

/**
 * True while the visitor is down. Everything hostile reads this from the shared
 * pose so a killed player is left alone: no stalking, no strikes, no damage
 * until they respawn.
 */
export const poseDown = (pose: { current: unknown } | null | undefined) =>
  (pose?.current as { combat?: string } | null)?.combat === "down";

/**
 * Solid-world test the movement step consults. The world registers one (built
 * structures block their tile); movement stays pure physics otherwise.
 */
let blocker: ((x: number, z: number) => boolean) | null = null;

export function setMoveBlocker(test: ((x: number, z: number) => boolean) | null) {
  blocker = test;
}

export type MoveIntent = {
  /** -1 back … 1 forward, camera-relative */
  forward: number;
  /** -1 right … 1 left, camera-relative */
  strafe: number;
  /** -1 right … 1 left, keyboard turning */
  turn: number;
  sprint: boolean;
  jump: boolean;
  /** multiplier on top speed — a vehicle travels several times a walk */
  speedScale?: number;
  /** multiplier on the keyboard turn rate */
  turnScale?: number;
  /** multiplier on jump height — high ground lifts the body further */
  jumpScale?: number;
  /** multiplier on how hard the body/ride builds speed */
  accelScale?: number;
  /** multiplier on how fast it sheds speed when you let off */
  dragScale?: number;
  /**
   * Flight: -1 sink … 1 climb. When present, gravity is off and altitude is
   * held instead — this is how the flying ride stays in the air.
   */
  fly?: number;
  /** climb rate in world units per second while flying */
  climbRate?: number;
  /** per-intent traversal ceiling override (spacecraft afterburner) */
  speedCap?: number;
  /** altitude held while flying with no climb input */
  cruise?: number;
};


/**
 * Advance one player one frame from an intent plus an optional walk target.
 * Frame-rate independent: accelerates toward the wanted velocity and damps with
 * `exp(-k·dt)` so feel is identical at 30 and 144 fps.
 */
export function stepPlayer(player: PlayerState, intent: MoveIntent, rawDelta: number) {
  const delta = Math.min(Math.max(rawDelta, 0), 0.05);
  if (player.combat === "down") {
    player.vx = 0;
    player.vz = 0;
    player.movement = "idle";
    player.animation = "down";
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
    return player;
  }

  player.yaw += intent.turn * MOVE.turnRate * (intent.turnScale ?? 1) * delta;
  if (intent.fly !== undefined) {
    // Flying: hold altitude, climb or sink on input, never fall.
    const climb = intent.climbRate ?? STRIDE * 9;
    const cruise = intent.cruise ?? STRIDE * 6;
    const goal = intent.fly === 0 ? Math.max(player.y, cruise) : player.y + intent.fly * climb;
    player.y = Math.max(0, damp(player.y, goal, intent.fly === 0 ? 2.2 : 8, delta));
    player.vy = 0;
    player.grounded = false;
  } else {
    if (intent.jump && player.grounded) {
      player.vy = MOVE.jumpSpeed * (intent.jumpScale ?? 1);
      player.grounded = false;
    }
    if (!player.grounded) {
      player.vy -= MOVE.gravity * delta;
      player.y += player.vy * delta;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.grounded = true;
      }
    }
  }


  const top = MOVE.walkSpeed * (intent.sprint ? MOVE.sprint : 1) * (intent.speedScale ?? 1);
  let wantX = 0;
  let wantZ = 0;

  if (intent.forward !== 0 || intent.strafe !== 0) {
    // Camera-relative: forward walks where you look, strafe steps sideways.
    player.target = null;
    const dirX = Math.sin(player.yaw) * intent.forward + Math.cos(player.yaw) * intent.strafe;
    const dirZ = Math.cos(player.yaw) * intent.forward - Math.sin(player.yaw) * intent.strafe;
    const length = Math.hypot(dirX, dirZ) || 1;
    wantX = (dirX / length) * top;
    wantZ = (dirZ / length) * top;
  } else if (player.target) {
    const dx = player.target.x - player.x;
    const dz = player.target.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= MOVE.arrive) {
      player.target = null;
    } else {
      // Ease down on approach so pointer moves land without overshoot.
      const speed = Math.min(top, Math.max(MOVE.idleSpeed, distance * 3.2));
      wantX = (dx / distance) * speed;
      wantZ = (dz / distance) * speed;
      player.yaw = damp(player.yaw, Math.atan2(dx, dz), MOVE.faceRate, delta, true);
    }
  }

  const moving = wantX !== 0 || wantZ !== 0;
  const k = moving
    ? MOVE.accel * (intent.accelScale ?? 1)
    : MOVE.drag * (intent.dragScale ?? 1);
  const blend = 1 - Math.exp(-k * delta);
  player.vx += (wantX - player.vx) * blend;
  player.vz += (wantZ - player.vz) * blend;

  // Cap the resolved velocity rather than only the requested speed. This also
  // catches carried momentum when changing from a fast ride back to walking.
  const resolvedSpeed = Math.hypot(player.vx, player.vz);
  const ceiling = intent.speedCap ?? TRAVERSAL_SPEED_CAP;
  if (resolvedSpeed > ceiling) {
    const cap = ceiling / resolvedSpeed;
    player.vx *= cap;
    player.vz *= cap;
  }

  // Edge margin is half a stride so row 0 / column 0 BITMAPs stay walkable.
  const edge = STRIDE * 0.5;
  const nextX = clamp(
    player.x + player.vx * delta,
    -WORLD_UNITS / 2 + edge,
    WORLD_UNITS / 2 - edge,
  );
  const nextZ = clamp(player.z + player.vz * delta, edge, WORLD_UNITS - edge);
  // Solid things (built structures) stop the body. Each axis is tested on its
  // own, so walking into a wall slides along it instead of sticking.
  if (blocker) {
    if (blocker(nextX, player.z)) player.vx = 0;
    else player.x = nextX;
    if (blocker(player.x, nextZ)) player.vz = 0;
    else player.z = nextZ;
  } else {
    player.x = nextX;
    player.z = nextZ;
  }

  const speed = Math.hypot(player.vx, player.vz);
  if (speed < MOVE.idleSpeed) {
    // Settle to a stop with the same exponential curve as everything else — a
    // flat per-frame multiply here made stopping snap differently at 30 and 144 fps.
    const settle = Math.exp(-MOVE.drag * 2 * delta);
    player.vx *= settle;
    player.vz *= settle;
    if (Math.hypot(player.vx, player.vz) < MOVE.idleSpeed * 0.15) {
      player.vx = 0;
      player.vz = 0;
    }
    player.movement = intent.turn !== 0 ? "turn" : "idle";
  } else {
    // Hysteresis: once running it takes a real slowdown to drop back to a walk,
    // so the stride does not flicker while holding a steady speed.
    const wasRunning = player.movement === "run";
    const threshold = MOVE.walkSpeed * (wasRunning ? 1.05 : 1.3);
    player.movement = speed > threshold ? "run" : "walk";
  }

  if (!player.grounded) player.animation = "jump";
  else if (player.movement === "run" || player.movement === "walk")
    // Taking a bite never freezes the stride: if you are moving, you keep
    // moving — the hit is felt on screen, not by locking the legs.
    player.animation = player.movement === "run" ? "run" : "walk";
  else if (player.combat === "hurt" || player.combat === "attacking")
    player.animation = player.combat === "hurt" ? "hurt" : "attack";
  else player.animation = "idle";


  syncCell(player);
  return player;
}

/** Frame-rate independent damping; `wrap` takes the shortest way round for angles. */
export function damp(current: number, goal: number, rate: number, delta: number, wrap = false) {
  let difference = goal - current;
  if (wrap) {
    difference =
      ((((difference + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  }
  return current + difference * (1 - Math.exp(-rate * delta));
}

/**
 * Peer movement guard. A remote client can claim any position it likes, so a
 * received step is clamped to the world and to the distance the shared top
 * speed allows in the elapsed time. Spawns and respawns are the only teleports,
 * and they must say so.
 */
export function clampPeerStep(
  from: { x: number; z: number } | null,
  to: { x: number; z: number },
  elapsedMs: number,
  teleport = false,
) {
  const x = clamp(Number.isFinite(to.x) ? to.x : 0, -WORLD_UNITS / 2, WORLD_UNITS / 2);
  const z = clamp(Number.isFinite(to.z) ? to.z : 0, 0, WORLD_UNITS);
  if (!from || teleport) return { x, z };
  const dx = x - from.x;
  const dz = z - from.z;
  const distance = Math.hypot(dx, dz);
  // Allow any legitimate capped ride while still rejecting teleport-like peer
  // reports. The fixed margin absorbs network jitter and dropped broadcasts.
  const allowed = (SPACECRAFT_SPEED_CAP * Math.max(elapsedMs, 120)) / 1000 + STRIDE * 6;
  if (distance <= allowed) return { x, z };
  const scale = allowed / distance;
  return { x: from.x + dx * scale, z: from.z + dz * scale };
}
