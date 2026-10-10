/** Device state for Shard Raids and Guardian mounts; unlocks themselves are server-held. */
import { STRIDE, type MoveIntent } from "./player-state";
import { MOUNT_SPEED } from "./shard-raid";

export const SADDLE = STRIDE * 2.4;

type S = { shards: number[]; gathered: number[]; mounts: number[]; riding: number | null; standing: number };
const s: S = { shards: [], gathered: [], mounts: [], riding: null, standing: -1 };
const subs = new Set<() => void>();
let rev = 0;
const emit = () => { rev++; for (const f of subs) f(); };
export const subscribeMount = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const mountRev = () => rev;
export const mountState = () => s;

export function setRaid(shards: number[], gathered: number[], mounts: number[]) {
  s.shards = shards;
  s.gathered = gathered;
  s.mounts = mounts;
  if (s.riding !== null && !mounts.includes(s.riding)) s.riding = null;
  emit();
}
export function markGathered(h: number) {
  if (!s.gathered.includes(h)) s.gathered = [...s.gathered, h];
  emit();
}
export function setStanding(h: number) {
  if (h === s.standing) return;
  s.standing = h;
  emit();
}
export function toggleRide(h: number) {
  if (!s.mounts.includes(h)) return;
  s.riding = s.riding === h ? null : h;
  emit();
}

/** Called each frame before movement: seats the rider and quickens the pace. */
export function applyMountIntent(intent: MoveIntent, driving: boolean) {
  if (s.riding === null || driving) return;
  intent.fly = 0;
  intent.cruise = SADDLE;
  intent.climbRate = STRIDE * 6;
  intent.speedScale = (intent.speedScale ?? 1) * MOUNT_SPEED;
  intent.jump = false;
}
