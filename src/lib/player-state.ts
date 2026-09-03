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
export const WORLD_UNITS = 100;
/** World units per district cell. */
export const WORLD_CELL = WORLD_UNITS / WORLD_GRID;
/** Chunk side in cells — the region label a player reports as their locale. */
export const CHUNK_CELLS = 50;

/**
 * One stride unit — the avatar's own scale. A BITMAP is ten strides across, so
 * districts read as walkable plots rather than single steps.
 */
export const STRIDE = WORLD_CELL / 10;

/** Tuning constants for movement feel. Tune these, never the integrator. */
export const MOVE = {
  /** top walking speed in world units per second */
  walkSpeed: STRIDE * 9,
  /** multiplier while sprinting */
  sprint: 2.2,
  jumpSpeed: STRIDE * 28,
  gravity: STRIDE * 78,
  /** how hard the avatar accelerates toward the wanted velocity */
  accel: 14,
  /** exponential damping applied when no input is held */
  drag: 9,
  /** keyboard turn rate in radians per second */
  turnRate: 2.4,
  /** how fast the body swings toward the direction it is travelling */
  faceRate: 10,
  /** click-to-move stops inside this radius */
  arrive: STRIDE * 1.4,
  /** speed below which the player counts as idle */
  idleSpeed: STRIDE * 0.6,
} as const;

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

function syncCell(player: PlayerState) {
  player.col = colAt(player.x);
  player.row = rowAt(player.z);
  player.height = player.row * WORLD_GRID + player.col;
  player.chunk = chunkKey(player.col, player.row);
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

  player.yaw += intent.turn * MOVE.turnRate * delta;
  if (intent.jump && player.grounded) {
    player.vy = MOVE.jumpSpeed;
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

  const top = MOVE.walkSpeed * (intent.sprint ? MOVE.sprint : 1);
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
  const k = moving ? MOVE.accel : MOVE.drag;
  const blend = 1 - Math.exp(-k * delta);
  player.vx += (wantX - player.vx) * blend;
  player.vz += (wantZ - player.vz) * blend;

  player.x = clamp(
    player.x + player.vx * delta,
    -WORLD_UNITS / 2 + WORLD_CELL,
    WORLD_UNITS / 2 - WORLD_CELL,
  );
  player.z = clamp(player.z + player.vz * delta, WORLD_CELL, WORLD_UNITS - WORLD_CELL);

  const speed = Math.hypot(player.vx, player.vz);
  if (speed < MOVE.idleSpeed) {
    player.vx *= 0.2;
    player.vz *= 0.2;
    player.movement = intent.turn !== 0 ? "turn" : "idle";
  } else {
    player.movement = speed > MOVE.walkSpeed * 1.25 ? "run" : "walk";
  }
  if (!player.grounded) player.animation = "jump";
  else if (player.combat === "hurt" || player.combat === "attacking")
    player.animation = player.combat === "hurt" ? "hurt" : "attack";
  else
    player.animation =
      player.movement === "run" ? "run" : player.movement === "walk" ? "walk" : "idle";

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
  // generous allowance: top sprint speed plus a beat of jitter and lost packets
  const allowed = (MOVE.walkSpeed * MOVE.sprint * Math.max(elapsedMs, 120)) / 1000 + STRIDE * 6;
  if (distance <= allowed) return { x, z };
  const scale = allowed / distance;
  return { x: from.x + dx * scale, z: from.z + dz * scale };
}
