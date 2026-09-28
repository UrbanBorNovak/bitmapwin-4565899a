/**
 * WORLD CREATURE REGISTRY — every Oasis creature that isn't spawned from the
 * bestiary tables (SPECIES / CREATURE_GROUPS) is declared here once. The world
 * components read their inscription from this file and the Bestiary lists
 * every entry, so a new creature shows up in the codex the moment it's added.
 */
import { COMPANIONS } from "./world-gear";

export const WHALE_INSCRIPTION = "09434427a0f5bddda76416dc60331212cd16312a538ef1b5c475e903ba318ecdi0";
export const BROS_INSCRIPTION = "ae759a6fba1e5bcd02bd74db802cd4c8d8f07d77ba1ce2327c9032072bf9f1b6i0";

export type WorldCreature = {
  id: string;
  name: string;
  hostile: boolean;
  hp: number;
  xp: number;
  bite: number;
  speed: number;
  rarity: string;
  habitat: string;
  inscription: string;
};

export const WORLD_CREATURES: WorldCreature[] = [
  { id: "whale", name: "WHALE", hostile: false, hp: 100, xp: 0, bite: 0, speed: 0.6, rarity: "RARE", habitat: "OPEN SEA", inscription: WHALE_INSCRIPTION },
  { id: "mario-bros", name: "MARIO BROS", hostile: false, hp: 240, xp: 640, bite: 0, speed: 1, rarity: "RARE", habitat: "OASIS", inscription: BROS_INSCRIPTION },
  ...COMPANIONS.filter((c) => c.inscription).map((c): WorldCreature => ({
    id: `pet-${c.id}`,
    name: c.label.replace(" ON A LEASH", ""),
    hostile: false,
    hp: 0,
    xp: 0,
    bite: 0,
    speed: 1,
    rarity: "COMPANION",
    habitat: c.hovers ? "AT YOUR SIDE · AIRBORNE" : "AT YOUR SIDE",
    inscription: c.inscription,
  })),
];
