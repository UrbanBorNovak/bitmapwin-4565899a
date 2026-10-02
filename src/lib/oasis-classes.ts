/**
 * Oasis classes: the calling a visitor picks at the threshold, and the three
 * simple skills it grants. Device-local only — nothing here is on chain.
 */
import { useSyncExternalStore } from "react";

export type ClassId = "miner" | "hashrunner" | "archaeologist" | "cypherpunk" | "builder";

export type SkillEffect =
  | { kind: "heal"; amount: number }
  | { kind: "speed"; factor: number; seconds: number }
  | { kind: "strike"; range: number }
  | { kind: "note" };

export type ClassSkill = { name: string; cooldown: number; note: string; effect: SkillEffect };

export type OasisClass = {
  id: ClassId;
  name: string;
  role: string;
  lore: string;
  skills: [ClassSkill, ClassSkill, ClassSkill];
};

export const CLASSES: OasisClass[] = [
  {
    id: "miner",
    name: "MINER",
    role: "HEAVY · SUSTAIN",
    lore: "Forged in the deep shafts beneath the first blocks. Slow to fall, quick to dig.",
    skills: [
      { name: "STOPE STRIKE", cooldown: 4, note: "PICKAXE SLAM", effect: { kind: "note" } },
      { name: "FORTIFY", cooldown: 20, note: "+25 HP", effect: { kind: "heal", amount: 25 } },
      { name: "ORE SENSE", cooldown: 15, note: "VEINS STIR NEARBY", effect: { kind: "note" } },
    ],
  },
  {
    id: "hashrunner",
    name: "HASHRUNNER",
    role: "AGILITY · SCOUT",
    lore: "A nomad of the high block heights who outruns the next difficulty adjustment.",
    skills: [
      { name: "GHOST DASH", cooldown: 6, note: "BURST OF SPEED", effect: { kind: "speed", factor: 2.2, seconds: 1.5 } },
      { name: "VOLLEY", cooldown: 3, note: "DART LOOSED", effect: { kind: "note" } },
      { name: "ELUSION", cooldown: 18, note: "+40% PACE", effect: { kind: "speed", factor: 1.4, seconds: 6 } },
    ],
  },
  {
    id: "archaeologist",
    name: "ARCHAEOLOGIST",
    role: "MYSTIC · PROVENANCE",
    lore: "Reads the ledger like scripture and mends wounds with its oldest verses.",
    skills: [
      { name: "INSCRIPTION PULSE", cooldown: 5, note: "THE LAND REMEMBERS", effect: { kind: "note" } },
      { name: "CHRONO MEND", cooldown: 15, note: "+30 HP", effect: { kind: "heal", amount: 30 } },
      { name: "SANCTUARY WARD", cooldown: 30, note: "+15 HP", effect: { kind: "heal", amount: 15 } },
    ],
  },
  {
    id: "cypherpunk",
    name: "CYPHERPUNK",
    role: "STEALTH · BURST",
    lore: "Speaks only in encrypted channels and leaves nothing but a nullifier behind.",
    skills: [
      { name: "NULLIFIER VEIL", cooldown: 15, note: "SLIPPED INTO SHADOW", effect: { kind: "speed", factor: 1.6, seconds: 3 } },
      { name: "HASH STRIKE", cooldown: 5, note: "PIERCING BLOW", effect: { kind: "note" } },
      { name: "ZK SHIELD", cooldown: 25, note: "+20 HP", effect: { kind: "heal", amount: 20 } },
    ],
  },
  {
    id: "builder",
    name: "BUILDER",
    role: "CRAFT · DEFENSE",
    lore: "Raises walls from raw transactions and lights beacons for lost travellers.",
    skills: [
      { name: "FIELD BARRIER", cooldown: 12, note: "+15 HP", effect: { kind: "heal", amount: 15 } },
      { name: "OVERCLOCK", cooldown: 10, note: "+30% PACE", effect: { kind: "speed", factor: 1.3, seconds: 5 } },
      { name: "BEACON LIGHT", cooldown: 20, note: "BEACON RAISED", effect: { kind: "note" } },
    ],
  },
];

const KEY = "bitmapwin:oasis-class";
const listeners = new Set<() => void>();

export function readClass(): ClassId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return CLASSES.some((c) => c.id === v) ? (v as ClassId) : null;
}

export function saveClass(id: ClassId) {
  window.localStorage.setItem(KEY, id);
  listeners.forEach((l) => l());
}

export function useOasisClass(): ClassId | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readClass,
    () => null,
  );
}

export const classById = (id: ClassId | null) => CLASSES.find((c) => c.id === id) ?? null;

/** Active pace buff the world multiplies into walking speed. */
let boost = { factor: 1, until: 0 };
export function skillSpeed(): number {
  return performance.now() < boost.until ? boost.factor : 1;
}

export const SKILL_EVENT = "oasis-skill";

/** Fire a skill: speed applies here; heals travel to the world as an event. */
export function castSkill(skill: ClassSkill) {
  if (skill.effect.kind === "speed") {
    boost = { factor: skill.effect.factor, until: performance.now() + skill.effect.seconds * 1000 };
  }
  window.dispatchEvent(new CustomEvent(SKILL_EVENT, { detail: skill }));
}
