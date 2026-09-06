/**
 * WORLD VEHICLE — the on-chain Cybertruck you can drive around the land.
 *
 * The truck is a single shared ride: pressing the drive control seats you in it
 * (it snaps to where you stand), pressing again parks it where you stepped out.
 * While driving, movement runs at truck speed instead of walking speed.
 */

/** on-chain GLB inscription of the Tesla Cybertruck model */
export const CYBERTRUCK_INSCRIPTION =
  "9bb043b1fa45fc98b15408e023054ba19c658ac23a403c03e73f0829f493055fi0";

/** how much faster the truck travels than a walk, and how much snappier it turns */
export const DRIVE_SPEED = 6.5;
export const DRIVE_SPRINT = 1.6;
export const DRIVE_TURN = 0.75;

export type VehicleState = {
  driving: boolean;
  /** where the truck sits while parked */
  x: number;
  z: number;
  yaw: number;
  placed: boolean;
};

export const vehicle: VehicleState = { driving: false, x: 0, z: 0, yaw: 0, placed: false };

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

function emit() {
  for (const listener of listeners) listener();
}

/** Seat the player in the truck at their own position, or park it where they are. */
export function toggleDriving(x: number, z: number, yaw: number) {
  if (vehicle.driving) {
    vehicle.driving = false;
    vehicle.x = x;
    vehicle.z = z;
    vehicle.yaw = yaw;
    vehicle.placed = true;
  } else {
    vehicle.driving = true;
    vehicle.x = x;
    vehicle.z = z;
    vehicle.yaw = yaw;
    vehicle.placed = true;
  }
  emit();
  return vehicle.driving;
}

export function stopDriving() {
  if (!vehicle.driving) return;
  vehicle.driving = false;
  emit();
}
