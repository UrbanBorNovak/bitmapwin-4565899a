/**
 * WORLD RIDES — the on-chain vehicles you can travel the land with.
 *
 * Every ride is a real inscription: a truck, two cars, a ship, a yacht and a
 * flying saucer. One ride is active at a time — pressing the travel control
 * seats you in the selected ride (it snaps to where you stand), pressing again
 * parks it where you stepped out. While riding, movement runs at that ride's
 * speed instead of walking speed; flying rides also gain altitude control.
 */

export type RideKind = "ground" | "water" | "air";

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
  /** cruise height above the ground in avatar units (air rides) */
  altitude?: number;
  /** climb rate in avatar units per second (air rides) */
  climb?: number;
  /** repaint the shipped materials into the world's brushed-metal palette */
  repaint?: boolean;
};

/** on-chain GLB inscription of the Tesla Cybertruck model */
export const CYBERTRUCK_INSCRIPTION =
  "9bb043b1fa45fc98b15408e023054ba19c658ac23a403c03e73f0829f493055fi0";

export const RIDES: RideSpec[] = [
  {
    id: "cybertruck",
    label: "CYBERTRUCK",
    inscription: CYBERTRUCK_INSCRIPTION,
    kind: "ground",
    fit: 3.6,
    speed: 4.2,
    sprint: 1.35,
    turn: 0.75,
    lean: 0.6,
    repaint: true,
  },
  {
    id: "ship",
    label: "SHIP",
    inscription: "f052b807840ed3a051a253e43128b0c1a5f75f87221e2e69253a569f8f0d7726i0",
    kind: "water",
    fit: 7,
    speed: 2.8,
    sprint: 1.2,
    turn: 0.5,
    lean: 0.35,
  },
  {
    id: "lambo",
    label: "LAMBO",
    inscription: "f92bab3766aba8b6f9962d4fb7a0a81ce0cc8dc1111bd23ebc3aefe5f01d0ebfi0",
    kind: "ground",
    fit: 3.2,
    speed: 5.6,
    sprint: 1.4,
    turn: 0.68,
    lean: 0.8,
  },
  {
    id: "model-s",
    label: "MODEL S",
    inscription: "53222472c2376e929b42fc85cbe80e22759dcf42d25ac55abde0940294bdd9a3i0",
    kind: "ground",
    fit: 3.4,
    speed: 4.8,
    sprint: 1.35,
    turn: 0.78,
    lean: 0.6,
  },
  {
    id: "adamantine-yacht",
    label: "ADAMANTINE YACHT",
    inscription: "354c773f197afdb7c78dbef6a77fe6321c73a0ab4ff0e90cb2cdd28f79668c13i0",
    kind: "water",
    fit: 8,
    speed: 3.4,
    sprint: 1.25,
    turn: 0.45,
    lean: 0.3,
  },
  {
    id: "bitsaucer",
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
  },
];

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
