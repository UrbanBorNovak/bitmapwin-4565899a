import { hash } from "./cardFactory";
import type { CardType } from "./types";

/**
 * CARD ABILITIES — data-driven. Every card type has a family of abilities;
 * a card's BITMAP height deterministically picks one. Add a new ability by
 * adding an entry here; the engine only calls the hooks.
 */
export type AbilityUnit = { uid: string; name: string; atk: number; hp: number; maxHp: number; ready: boolean; fx: string | null; type: CardType; ability?: string };
export type AbilitySide = { hp: number; energy: number; board: AbilityUnit[]; hurt: number };
export type AbilityCtx = {
  self: AbilityUnit;
  side: AbilitySide;
  foe: AbilitySide;
  say: (text: string) => void;
  draw: () => void;
  damageUnit: (u: AbilityUnit, n: number) => void;
  damageHero: (n: number) => void;
  heal: (n: number) => void;
};
export type Ability = {
  id: string;
  name: string;
  type: CardType;
  text: string;
  /** Enemies must attack this first. */
  taunt?: boolean;
  /** Can attack the turn it arrives. */
  charge?: boolean;
  /** Damage reduction when hit. */
  armor?: number;
  /** Bonus damage when striking the rival directly. */
  heroBonus?: number;
  onPlay?: (c: AbilityCtx) => void;
  onTurnStart?: (c: AbilityCtx) => void;
  /** Extra energy granted at your turn start while on field. */
  energy?: number;
};

const strongest = (b: AbilityUnit[]) => [...b].sort((x, y) => y.atk - x.atk || y.hp - x.hp)[0];

export const ABILITIES: Ability[] = [
  // TERRITORY — land that powers you over time
  { id: "wellspring", type: "TERRITORY", name: "WELLSPRING", text: "Your turn start: +1 energy.", energy: 1 },
  { id: "hearthland", type: "TERRITORY", name: "HEARTHLAND", text: "Your turn start: +1 energy and heal 1.", energy: 1, onTurnStart: (c) => c.heal(1) },
  { id: "frontier", type: "TERRITORY", name: "FRONTIER", text: "Your turn start: +1 energy. On play: allies +1 power.", energy: 1,
    onPlay: (c) => { for (const u of c.side.board) if (u.uid !== c.self.uid) { u.atk += 1; u.fx = "evolved"; } c.say("The frontier opened: allies +1 power."); } },
  // BUILDER — shapes your field
  { id: "mason", type: "BUILDER", name: "MASON", text: "On play: every ally +1 defense.",
    onPlay: (c) => { for (const u of c.side.board) { u.hp += 1; u.maxHp += 1; if (u.uid !== c.self.uid) u.fx = "evolved"; } c.say("Builders raised the walls: allies +1 defense."); } },
  { id: "forge", type: "BUILDER", name: "FORGE", text: "On play: your strongest other ally +2 power.",
    onPlay: (c) => { const t = strongest(c.side.board.filter((u) => u.uid !== c.self.uid)); if (t) { t.atk += 2; t.fx = "evolved"; c.say(`${c.self.name} forged ${t.name}: +2 power.`); } } },
  { id: "scaffold", type: "BUILDER", name: "SCAFFOLD", text: "On play: +1 defense for each other ally.",
    onPlay: (c) => { const n = c.side.board.length - 1; c.self.hp += n; c.self.maxHp += n; if (n) c.say(`${c.self.name} grew +${n} defense.`); } },
  // MINER — cards and energy
  { id: "dig", type: "MINER", name: "DIG", text: "On play: draw a card.", onPlay: (c) => { c.draw(); c.say(`${c.self.name} dug up a new card.`); } },
  { id: "deep-vein", type: "MINER", name: "DEEP VEIN", text: "On play: draw a card and gain 1 energy.",
    onPlay: (c) => { c.draw(); c.side.energy += 1; c.say(`${c.self.name} struck a vein: +1 card, +1 energy.`); } },
  { id: "prospector", type: "MINER", name: "PROSPECTOR", text: "Your turn start: draw a card.", onTurnStart: (c) => c.draw() },
  // EXPLORER — speed and reach
  { id: "scout", type: "EXPLORER", name: "SCOUT", text: "Can attack the turn it arrives.", charge: true },
  { id: "trailblazer", type: "EXPLORER", name: "TRAILBLAZER", text: "Charge. +1 damage when striking the rival.", charge: true, heroBonus: 1 },
  { id: "cartographer", type: "EXPLORER", name: "CARTOGRAPHER", text: "On play: 1 damage to every enemy.",
    onPlay: (c) => { for (const u of [...c.foe.board]) c.damageUnit(u, 1); c.say(`${c.self.name} mapped the field: 1 damage to every enemy.`); } },
  // GUARDIAN — protection
  { id: "bulwark", type: "GUARDIAN", name: "BULWARK", text: "Enemies must attack it first.", taunt: true },
  { id: "sentinel", type: "GUARDIAN", name: "SENTINEL", text: "Taunt. Takes 1 less damage.", taunt: true, armor: 1 },
  { id: "warden", type: "GUARDIAN", name: "WARDEN", text: "Taunt. On play: heal 3.", taunt: true, onPlay: (c) => { c.heal(3); c.say(`${c.self.name} restored the land: +3 HP.`); } },
  // EVENT — instant, then gone
  { id: "strike", type: "EVENT", name: "STRIKE", text: "Instant: power damage to the strongest enemy, or the rival.",
    onPlay: (c) => { const t = strongest(c.foe.board); if (t) { c.say(`${c.self.name} struck ${t.name} for ${c.self.atk}.`); c.damageUnit(t, c.self.atk); } else { c.damageHero(c.self.atk); c.say(`${c.self.name} struck the rival for ${c.self.atk}.`); } } },
  { id: "quake", type: "EVENT", name: "QUAKE", text: "Instant: power−1 damage to every enemy (min 1).",
    onPlay: (c) => { const n = Math.max(1, c.self.atk - 1); for (const u of [...c.foe.board]) c.damageUnit(u, n); c.say(`${c.self.name} shook the land: ${n} to every enemy.`); } },
  { id: "blessing", type: "EVENT", name: "BLESSING", text: "Instant: allies +1/+1 and heal 2.",
    onPlay: (c) => { for (const u of c.side.board) { u.atk += 1; u.hp += 1; u.maxHp += 1; u.fx = "evolved"; } c.heal(2); c.say(`${c.self.name} blessed the field: allies +1/+1, +2 HP.`); } },
];

const BY_ID = new Map(ABILITIES.map((a) => [a.id, a]));
export function abilitiesOf(type: CardType) { return ABILITIES.filter((a) => a.type === type); }
export function abilityFor(type: CardType, bitmap: number): Ability {
  const fam = abilitiesOf(type);
  return fam[hash(bitmap * 31 + 7) % fam.length]!;
}
export function abilityOf(u: { type: CardType; ability?: string; height?: number }): Ability {
  return (u.ability && BY_ID.get(u.ability)) || abilityFor(u.type, u.height ?? 0);
}
