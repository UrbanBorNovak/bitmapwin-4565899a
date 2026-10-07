/**
 * Fantasy races for the Oasis avatar. Device-local choice; perks are movement
 * and look only (never economy/combat), because browsers can't be trusted.
 */
import { useSyncExternalStore } from "react";

export type Race = "human" | "elf" | "dwarf" | "orc";

export const RACES: Record<Race, { name: string; perk: string; speed: number; scale: [number, number, number] }> = {
  human: { name: "Human", perk: "Balanced stride", speed: 1, scale: [1, 1, 1] },
  elf: { name: "Elf", perk: "+12% walk speed", speed: 1.12, scale: [0.92, 1.1, 0.92] },
  dwarf: { name: "Dwarf", perk: "Low & sturdy, −4% speed", speed: 0.96, scale: [1.2, 0.8, 1.15] },
  orc: { name: "Orc", perk: "Hulking frame, +4% speed", speed: 1.04, scale: [1.25, 1.12, 1.2] },
};
export const RACE_ORDER: Race[] = ["human", "elf", "dwarf", "orc"];

const KEY = "oasis-race";
const subs = new Set<() => void>();
let current: Race = "human";
if (typeof window !== "undefined") {
  const s = window.localStorage.getItem(KEY) as Race | null;
  if (s && s in RACES) current = s;
}
export const getRace = () => current;
export function setRace(r: Race) {
  current = r;
  try { window.localStorage.setItem(KEY, r); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useRace(): Race {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => current,
    () => "human",
  );
}
