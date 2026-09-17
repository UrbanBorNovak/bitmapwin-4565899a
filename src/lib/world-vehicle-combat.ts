import { STRIDE } from "@/lib/player-state";
import { currentRide, isDriving, rideById, stopDriving } from "@/lib/world-vehicle";
import { TILE, tileFlags } from "@/lib/world-grid";

export type VehicleCombatSnapshot = {
  rideId: string;
  hp: number;
  maxHp: number;
  hitAt: number;
  lastDamage: number;
  hullDown: boolean;
  destroyedUntil: number;
  explosion: number;
};

const REPAIR_MS = 12_000;
const hullByRide = new Map<string, number>();
const listeners = new Set<() => void>();
let hitAt = 0;
let lastDamage = 0;
let hullDown = false;
let destroyedUntil = 0;
let explosion = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeVehicleCombat(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function vehicleCombatSnapshot(): VehicleCombatSnapshot {
  const ride = currentRide();
  return {
    rideId: ride.id,
    hp: hullByRide.get(ride.id) ?? ride.maxHull,
    maxHp: ride.maxHull,
    hitAt,
    lastDamage,
    hullDown,
    destroyedUntil,
    explosion,
  };
}

/** A hard tile directly between the attacker and lower hull grants defilade. */
export function detectHullDown(
  target: { x: number; z: number; y?: number },
  attacker: { x: number; z: number },
) {
  const ride = currentRide();
  if (!isDriving() || ride.kind !== "ground" || (target.y ?? 0) > STRIDE * 1.5) return false;
  const dx = attacker.x - target.x;
  const dz = attacker.z - target.z;
  const length = Math.hypot(dx, dz);
  if (length < STRIDE * 3) return false;
  const probeX = target.x + (dx / length) * STRIDE * 1.8;
  const probeZ = target.z + (dz / length) * STRIDE * 1.8;
  const col = Math.floor((probeX + 50) / 0.1);
  const row = Math.floor(probeZ / 0.1);
  return (tileFlags(col, row) & (TILE.BLOCKED | TILE.OCCUPIED)) !== 0;
}

export function damageActiveVehicle(
  rawDamage: number,
  attacker: { x: number; z: number },
  target: { x: number; z: number; y?: number },
) {
  if (!isDriving() || rawDamage <= 0) return { absorbed: false, hullDamage: 0, occupantDamage: rawDamage, destroyed: false, hullDown: false };
  const ride = currentRide();
  const current = hullByRide.get(ride.id) ?? ride.maxHull;
  const covered = detectHullDown(target, attacker);
  const coverReduction = covered ? 0.55 : 0;
  const dealt = Math.max(1, Math.round(rawDamage * (1 - ride.armor) * (1 - coverReduction)));
  const next = Math.max(0, current - dealt);
  hullByRide.set(ride.id, next);
  hitAt = Date.now();
  lastDamage = dealt;
  hullDown = covered;
  const destroyed = next === 0;
  if (destroyed) {
    destroyedUntil = Date.now() + REPAIR_MS;
    explosion++;
    stopDriving();
    window.setTimeout(() => {
      hullByRide.set(ride.id, ride.maxHull);
      destroyedUntil = 0;
      hullDown = false;
      emit();
    }, REPAIR_MS);
  }
  emit();
  return {
    absorbed: true,
    hullDamage: dealt,
    occupantDamage: Math.max(0, Math.round(rawDamage * ride.occupantExposure * (covered ? 0.45 : 1))),
    destroyed,
    hullDown: covered,
  };
}

export function repairSelectedVehicle() {
  const ride = currentRide();
  hullByRide.set(ride.id, ride.maxHull);
  destroyedUntil = 0;
  hullDown = false;
  emit();
}