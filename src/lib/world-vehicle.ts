/**
 * WORLD RIDES — the on-chain vehicles you can travel the land with.
 *
 * Every ride is a real inscription: a truck, two cars, a ship, a yacht and a
 * flying saucer. One ride is active at a time — pressing the travel control
 * seats you in the selected ride (it snaps to where you stand), pressing again
 * parks it where you stepped out. While riding, movement runs at that ride's
 * speed instead of walking speed; flying rides also gain altitude control.
 */

import type { EngineVoice } from "@/lib/world-audio";

export type RideKind = "ground" | "water" | "air";
export type TrailProfile = "paw" | "truck" | "sport" | "tread" | "wake" | "none";

export type RideSpec = {
  id: string;
  label: string;
  /** on-chain GLB inscription id */
  inscription: string;
  kind: RideKind;
  /** how many avatar heights long the model is fitted to */
  fit: number;
  /** top speed as a multiple of a walk */
  speed: number;
  /** sprint multiplier on top of that */
  sprint: number;
  /** multiplier on the keyboard turn rate */
  turn: number;
  /** how much body roll the ride leans into a turn */
  lean: number;
  /**
   * FEEL — every ride pulls away and settles differently. `accel` scales how
   * hard it builds speed, `brake` how quickly it sheds it when you let off, and
   * `grip` how much the steering tightens up at low speed and washes out flat
   * out. Tune these, never the integrator.
   */
  accel: number;
  brake: number;
  grip: number;
  /** cruise height above the ground in avatar units (air rides) */
  altitude?: number;
  /** climb rate in avatar units per second (air rides) */
  climb?: number;
  /** repaint the shipped materials into the world's brushed-metal palette */
  repaint?: boolean;
  /** worn on the body instead of boarded, like the jetpack */
  worn?: boolean;
  /** which live engine voice runs while you travel it */
  voice?: EngineVoice;
  /** correction from the model's inferred longest-axis forward direction */
  modelYaw?: number;
  /** ground or water mark made by this ride */
  trail: TrailProfile;
};

/** on-chain GLB inscription of the Tesla Cybertruck model */
export const CYBERTRUCK_INSCRIPTION =
  "9bb043b1fa45fc98b15408e023054ba19c658ac23a403c03e73f0829f493055fi0";

/** The jetpack strapped to your back, and the helmet that comes on with it. */
export const JETPACK_INSCRIPTION =
  "911e903f1dfccdda7873f71b684473d5c553038c7ca18f76d69dd120fbd50452i0";
export const JETPACK_HELMET_INSCRIPTION =
  "f8b44754124e832a73964cd7b05a2c2f6a596e295ec35a22ec30e63fa0fa5692i0";

export const RIDES: RideSpec[] = [
  {
    id: "cyberpunk-genesis-dog",
    voice: "ev",
    label: "CYBERPUNK GENESIS DOG",
    inscription: "3eba3eadd0cf32bce7be6a21eccb9b97d9e66e9c0d779a3b1d7463a7a8432d47i0",
    kind: "ground",
    fit: 2.35,
    speed: 4.6,
    sprint: 1.5,
    turn: 1.08,
    lean: 0.7,
    accel: 1.65,
    brake: 1.35,
    grip: 0.82,
    trail: "paw",
  },
  {
    id: "cybertruck",
    voice: "ev",
    label: "CYBERTRUCK",
    inscription: CYBERTRUCK_INSCRIPTION,
    kind: "ground",
    fit: 3.6,
    speed: 4.2,
    sprint: 1.35,
    turn: 0.75,
    lean: 0.6,
    repaint: true,
    accel: 0.5,
    brake: 0.75,
    grip: 0.45,
    trail: "truck",
  },
  {
    id: "ship",
    voice: "boat",
    label: "SHIP",
    inscription: "f052b807840ed3a051a253e43128b0c1a5f75f87221e2e69253a569f8f0d7726i0",
    kind: "water",
    fit: 7,
    speed: 2.8,
    sprint: 1.2,
    turn: 0.5,
    lean: 0.35,
    accel: 0.2,
    brake: 0.16,
    grip: 0.15,
    trail: "wake",
  },
  {
    id: "lambo",
    voice: "v12",
    label: "LAMBO",
    inscription: "f92bab3766aba8b6f9962d4fb7a0a81ce0cc8dc1111bd23ebc3aefe5f01d0ebfi0",
    kind: "ground",
    fit: 3.2,
    speed: 5.6,
    sprint: 1.4,
    turn: 0.68,
    lean: 0.8,
    accel: 1.55,
    brake: 1.7,
    grip: 0.75,
    trail: "sport",
  },
  {
    id: "model-s",
    voice: "ev",
    label: "MODEL S",
    inscription: "53222472c2376e929b42fc85cbe80e22759dcf42d25ac55abde0940294bdd9a3i0",
    kind: "ground",
    fit: 3.4,
    speed: 4.8,
    sprint: 1.35,
    turn: 0.78,
    lean: 0.6,
    accel: 1.95,
    brake: 1.2,
    grip: 0.6,
    trail: "sport",
  },
  {
    id: "testarossa",
    voice: "v12",
    label: "FERRARI TESTAROSSA",
    inscription: "4d3848266f8e4e6bc100b45d7c94245e70c5d593781cd6e1d20c2a2b829e56e3i0",
    kind: "ground",
    fit: 3.3,
    speed: 5.2,
    sprint: 1.45,
    turn: 0.72,
    lean: 0.9,
    // Mid-engine flat twelve: eager off the line, hard on the brakes, and the
    // steering goes light the faster it runs.
    accel: 1.3,
    brake: 1.45,
    grip: 0.8,
    trail: "sport",
  },
  {
    id: "adamantine-yacht",
    voice: "boat",
    label: "ADAMANTINE YACHT",
    inscription: "354c773f197afdb7c78dbef6a77fe6321c73a0ab4ff0e90cb2cdd28f79668c13i0",
    kind: "water",
    fit: 8,
    speed: 3.4,
    sprint: 1.25,
    turn: 0.45,
    lean: 0.3,
    accel: 0.28,
    brake: 0.2,
    grip: 0.12,
    trail: "wake",
  },
  {
    id: "bitsaucer",
    voice: "saucer",
    label: "BITSAUCER",
    inscription: "f6d0118e790bb0d53e8f48eb54ff4d9991cd2065ae4497abf1f5cdec3c3d6870i0",
    kind: "air",
    fit: 5,
    speed: 7.5,
    sprint: 1.5,
    turn: 0.9,
    lean: 0.5,
    altitude: 6,
    climb: 9,
    accel: 0.85,
    brake: 0.5,
    grip: 0.25,
    trail: "none",
  },
  {
    id: "tank",
    voice: "diesel",
    label: "TANK",
    inscription: "d8d6ff362f643a4597a9eb6dbd67c282acba3e682370007e3d6cfdf13ffc1b72i0",
    kind: "ground",
    // Tracked and heavy: slow to wind up, slow to stop, and it turns like a barn.
    fit: 4.2,
    speed: 3.2,
    sprint: 1.15,
    turn: 0.42,
    lean: 0.15,
    accel: 0.32,
    brake: 0.3,
    grip: 0.95,
    modelYaw: Math.PI,
    trail: "tread",
  },
  {
    id: "spacecraft",
    voice: "rocket",
    label: "SPACECRAFT",
    inscription: "454b385ae059767b885127a3c3dc6008da77b926c016924fcee3bfd187c974bdi0",
    kind: "air",
    fit: 6.5,
    speed: 11,
    sprint: 1.7,
    turn: 0.6,
    lean: 0.7,
    altitude: 12,
    climb: 14,
    accel: 0.6,
    brake: 0.35,
    grip: 0.2,
    trail: "none",
  },
  {
    id: "silver-saucer",
    voice: "saucer",
    label: "SILVER FLYING SAUCER",
    inscription: "b76ac607342727beed91a87d17de5715f5f66500b50868b4732ba3f008d58b31i0",
    kind: "air",
    fit: 5.4,
    speed: 8.6,
    sprint: 1.55,
    turn: 1.05,
    lean: 0.4,
    altitude: 8,
    climb: 11,
    accel: 1.1,
    brake: 0.7,
    grip: 0.22,
    trail: "none",
  },
  {
    id: "jetpack",
    voice: "thruster",
    label: "JETPACK",
    // Worn, not boarded: the pack rides on your back and the helmet goes on
    // with it, so the body you fly with is your own avatar.
    inscription: JETPACK_INSCRIPTION,
    kind: "air",
    fit: 0.6,
    speed: 3.4,
    sprint: 1.5,
    turn: 1.3,
    lean: 0.25,
    altitude: 3.5,
    climb: 7,
    accel: 1.4,
    brake: 1.2,
    grip: 0.4,
    worn: true,
    trail: "none",
  },
];

/** True while the active ride is worn on the body rather than boarded. */
export const rideIsWorn = (id: string) => Boolean(rideById(id).worn);

export const rideById = (id: string) => RIDES.find((ride) => ride.id === id) ?? RIDES[0]!;

/** how much faster the default ride travels than a walk, and how it turns */
export const DRIVE_SPEED = RIDES[0]!.speed;
export const DRIVE_SPRINT = RIDES[0]!.sprint;
export const DRIVE_TURN = RIDES[0]!.turn;

export type VehicleState = {
  driving: boolean;
  /** which ride is selected */
  rideId: string;
  /** where the ride sits while parked */
  x: number;
  z: number;
  y: number;
  yaw: number;
  placed: boolean;
  /** 0..1 how hard the ride is pushing, read every frame by the blur overlay */
  rush: number;
};

export const vehicle: VehicleState = {
  driving: false,
  rideId: RIDES[0]!.id,
  x: 0,
  z: 0,
  y: 0,
  yaw: 0,
  placed: false,
  rush: 0,
};

const listeners = new Set<() => void>();

export function subscribeVehicle(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDriving() {
  return vehicle.driving;
}

export function currentRideId() {
  return vehicle.rideId;
}

export function currentRide() {
  return rideById(vehicle.rideId);
}

/** Snapshot both ride flags in one string so React can compare cheaply. */
export function vehicleSnapshot() {
  return `${vehicle.driving ? "1" : "0"}:${vehicle.rideId}:${vehicle.placed ? "1" : "0"}`;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Seat the player in the ride at their own position, or park it where they are. */
export function toggleDriving(x: number, z: number, yaw: number) {
  vehicle.driving = !vehicle.driving;
  vehicle.x = x;
  vehicle.z = z;
  vehicle.yaw = yaw;
  vehicle.placed = true;
  emit();
  return vehicle.driving;
}

/** Pick a ride. Switching while seated swaps the ride under you. */
export function selectRide(id: string) {
  if (vehicle.rideId === id) return;
  vehicle.rideId = id;
  vehicle.rush = 0;
  emit();
}

export function stopDriving() {
  if (!vehicle.driving) return;
  vehicle.driving = false;
  emit();
}
