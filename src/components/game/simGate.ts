/** Creatures farther than this many avatar units from the visitor freeze their brains. */
export const SIM_GATE_UNITS = 110;
/** True when an entity is too far from the visitor to be worth simulating this frame. */
export function farFromPlayer(player: { x: number; z: number } | null | undefined, x: number, z: number, unit: number) {
  if (!player) return false;
  const r = unit * SIM_GATE_UNITS;
  const dx = x - player.x, dz = z - player.z;
  return dx * dx + dz * dz > r * r;
}
