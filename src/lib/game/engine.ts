import { createCardFromBitmap, emptyFacts, ATLAS_POOL } from "./cardFactory";
import type { CardType, LivingCard, Trait } from "./types";
import { abilityFor, abilityOf, type AbilityCtx } from "./abilities";
import { combatBase } from "./workshop";

/** GAME STATE — ephemeral per match. Cards are snapshots; living cards change only via world events. */
export type SideId = "player" | "ai";
export type Unit = {
  uid: string;
  cardId: string;
  name: string;
  type: CardType;
  traits: Trait[];
  height: number;
  cost: number;
  atk: number;
  hp: number;
  maxHp: number;
  ready: boolean;
  ability?: string;
  /** Living-card combat perks derived from state, builds, traits and learned adaptations. */
  perks: string[];
  adaptations: string[];
  armor: number;
  resolute: boolean;
  fx: "enter" | "damaged" | "evolved" | "attacking" | null;
};
export type Side = { hp: number; energy: number; deck: Unit[]; hand: Unit[]; board: Unit[]; hurt: number };
export type LogLine = { id: number; side: SideId | "world"; text: string };
export type MatchState = {
  seed: number;
  turn: number;
  active: SideId;
  sides: Record<SideId, Side>;
  log: LogLine[];
  winner: SideId | null;
  usage: Record<string, number>;
  playerDeckIds: string[];
  enemyHeights: number[];
  logId: number;
};

export const START_HP = 20;
export const BASE_ENERGY = 3;
export const MAX_BOARD = 4;
export const MAX_HAND = 7;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], r: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

let uidN = 0;
function toUnit(card: LivingCard): Unit {
  const ad = card.learning?.adaptations ?? [];
  const perks: string[] = [];
  const base = combatBase(card);
  let atk = base.atk, hp = base.hp, cost = base.cost, armor = 0;
  if (base.build.builds > 0) perks.push(`${base.build.builds} OASIS BUILD${base.build.builds === 1 ? "" : "S"} +${base.build.atk}/+${base.build.hp}`);
  const up = base.upgrades;
  if (up.power || up.defense || up.efficiency) perks.push(`FORGED +${up.power}/+${up.defense}${up.efficiency ? " −1 COST" : ""}`);
  if (card.state === "DEVELOPED") { hp += 1; perks.push("DEVELOPED +1 HP"); }
  if (card.state === "LEGENDARY") { atk += 1; hp += 1; perks.push("LEGENDARY +1/+1"); }
  if (card.traits.includes("ARCHITECT") || ad.includes("FORTIFIED")) { armor += 1; perks.push("ARMOR 1"); }
  if (card.traits.includes("TRADER") && cost > 1) { cost -= 1; perks.push("TRADER −1 COST"); }
  if (card.traits.includes("EXPLORER") || ad.includes("PATHFINDER")) perks.push("CHARGE");
  if (ad.includes("RESOLUTE")) perks.push("RESOLUTE · SURVIVES ONCE");
  if (ad.includes("MASTERWORK")) perks.push("MASTERWORK · +1 HP ON ENTRY");
  if (ad.includes("DEEP_MEMORY")) perks.push("DEEP MEMORY · +1 ENERGY");
  if (ad.includes("CATALYST")) perks.push("CATALYST · +1 EVENT DAMAGE");
  if (ad.includes("BATTLE_TESTED")) perks.push("BATTLE TESTED · +1 CLASH");
  if (ad.includes("VETERAN")) perks.push("VETERAN · +1 TO RIVAL");
  return {
    perks, adaptations: [...ad], armor, resolute: ad.includes("RESOLUTE"),
    uid: `${card.id}#${++uidN}`,
    cardId: card.id,
    name: card.name,
    type: card.type,
    traits: card.traits,
    height: card.bitmap,
    cost,
    atk,
    hp,
    maxHp: hp,
    ready: false,
    ability: abilityFor(card.type, card.bitmap).id,
    fx: null,
  };
}

/** Deterministic rival deck for a table seed. */
export function enemyHeightsFor(seed: number, exclude: Set<number>) {
  const r = rng(seed ^ 0xa5a5);
  const pool = shuffle(ATLAS_POOL.filter((h) => !exclude.has(h)), r).slice(0, 5);
  while (pool.length < 10) pool.push(Math.floor(r() * 900_000));
  return pool;
}

/** A real rival: their BITMAPs (first leads) and live Oasis build counts. */
export type RivalDeck = { heights: number[]; builds: Record<number, number> };

export function newMatch(playerCards: LivingCard[], seed: number, leaderId?: string | null, rival?: RivalDeck | null): MatchState {
  const r = rng(seed);
  const exclude = new Set(playerCards.map((c) => c.bitmap));
  const enemyHeights = rival?.heights.length ? rival.heights.slice(0, 10) : enemyHeightsFor(seed, exclude);
  while (rival && enemyHeights.length < 10) enemyHeights.push(enemyHeights[enemyHeights.length % Math.max(1, rival.heights.length)]!);
  const enemyCards = enemyHeights.map((h) => {
    const b = rival?.builds[h];
    return createCardFromBitmap(b !== undefined ? { ...emptyFacts(h), buildCount: b, source: "bitmapwin-world", checkedAt: Date.now() } : emptyFacts(h), 0);
  });
  let pDeck = shuffle(playerCards.slice(0, 12).map(toUnit), r);
  if (leaderId) {
    const i = pDeck.findIndex((u) => u.cardId === leaderId);
    if (i > 0) pDeck = [pDeck[i]!, ...pDeck.slice(0, i), ...pDeck.slice(i + 1)];
  }
  let eDeck = shuffle(enemyCards.map(toUnit), r);
  if (rival?.heights.length) {
    const i = eDeck.findIndex((u) => u.height === rival.heights[0]);
    if (i > 0) eDeck = [eDeck[i]!, ...eDeck.slice(0, i), ...eDeck.slice(i + 1)];
  }
  const s: MatchState = {
    seed,
    turn: 1,
    active: "player",
    sides: {
      player: { hp: START_HP, energy: BASE_ENERGY, deck: pDeck.slice(4), hand: pDeck.slice(0, 4), board: [], hurt: 0 },
      ai: { hp: START_HP, energy: 0, deck: eDeck.slice(4), hand: eDeck.slice(0, 4), board: [], hurt: 0 },
    },
    log: [],
    winner: null,
    usage: {},
    playerDeckIds: playerCards.slice(0, 12).map((c) => c.id),
    enemyHeights,
    logId: 0,
  };
  say(s, "world", "The table is set. The world is the deck.");
  return s;
}

function say(s: MatchState, side: LogLine["side"], text: string) {
  s.log = [{ id: ++s.logId, side, text }, ...s.log].slice(0, 30);
}

const other = (id: SideId): SideId => (id === "player" ? "ai" : "player");
const clone = (s: MatchState): MatchState => structuredClone(s);

function clearFx(s: MatchState) {
  for (const id of ["player", "ai"] as SideId[]) {
    s.sides[id].hurt = 0;
    for (const u of s.sides[id].board) u.fx = null;
  }
}

function checkWin(s: MatchState) {
  if (s.sides.ai.hp <= 0) s.winner = "player";
  else if (s.sides.player.hp <= 0) s.winner = "ai";
}

function draw(s: MatchState, id: SideId) {
  const side = s.sides[id];
  const card = side.deck.shift();
  if (!card) {
    side.hp -= 1;
    side.hurt = 1;
    say(s, id, "Deck is empty — the land grows tired (-1 HP).");
    return;
  }
  if (side.hand.length >= MAX_HAND) {
    say(s, id, `${card.name} slipped back into the world (hand full).`);
    return;
  }
  side.hand.push(card);
}

export function canPlay(s: MatchState, id: SideId, uid: string) {
  const side = s.sides[id];
  const u = side.hand.find((c) => c.uid === uid);
  if (!u || s.winner || s.active !== id || u.cost > side.energy) return false;
  return u.type === "EVENT" || side.board.length < MAX_BOARD;
}

export function playCard(state: MatchState, id: SideId, uid: string): MatchState {
  if (!canPlay(state, id, uid)) return state;
  const s = clone(state);
  clearFx(s);
  const side = s.sides[id];
  const foe = s.sides[other(id)];
  const u = side.hand.find((c) => c.uid === uid)!;
  side.hand = side.hand.filter((c) => c.uid !== uid);
  side.energy -= u.cost;
  if (id === "player") s.usage[u.cardId] = (s.usage[u.cardId] ?? 0) + 1;

  if (u.traits.includes("ORIGIN")) {
    side.hp = Math.min(START_HP, side.hp + 2);
  }
  if (u.adaptations?.includes("MASTERWORK")) side.hp = Math.min(START_HP, side.hp + 1);

  const ab = abilityOf(u);
  if (u.type === "EVENT") {
    say(s, id, `${u.name} · ${ab.name}.`);
    ab.onPlay?.(ctx(s, id, u));
    if (u.adaptations?.includes("CATALYST")) { foe.hp -= 1; foe.hurt = Math.max(foe.hurt, 1); say(s, id, `${u.name} · CATALYST +1.`); }
    checkWin(s);
    return s;
  }

  if (u.traits.includes("NEIGHBOR") && side.board.length > 0) u.atk += 1;
  u.fx = "enter";
  u.ready = !!ab.charge || u.perks?.includes("CHARGE");
  side.board.push(u);
  say(s, id, `${u.name} entered the field · ${ab.name}.`);
  ab.onPlay?.(ctx(s, id, u));
  checkWin(s);
  return s;
}

function removeDead(s: MatchState) {
  for (const k of ["player", "ai"] as SideId[]) {
    const side = s.sides[k];
    for (const u of side.board) if (u.hp <= 0) say(s, k, `${u.name} returned to the land.`);
    side.board = side.board.filter((u) => u.hp > 0);
  }
}

function hitUnit(t: Unit, n: number) {
  const dmg = Math.max(0, n - (abilityOf(t).armor ?? 0) - (t.armor ?? 0));
  t.hp -= dmg;
  if (t.hp <= 0 && t.resolute) { t.hp = 1; t.resolute = false; }
  t.fx = "damaged";
}

function ctx(s: MatchState, id: SideId, self: Unit): AbilityCtx {
  const side = s.sides[id];
  const foe = s.sides[other(id)];
  return {
    self, side, foe,
    say: (t) => say(s, id, t),
    draw: () => draw(s, id),
    damageUnit: (t, n) => { hitUnit(t as Unit, n); removeDead(s); },
    damageHero: (n) => { foe.hp -= n; foe.hurt = n; },
    heal: (n) => { side.hp = Math.min(START_HP, side.hp + n); },
  };
}

export function legalTargets(s: MatchState, id: SideId): { units: string[]; hero: boolean } {
  const foe = s.sides[other(id)];
  const guards = foe.board.filter((u) => abilityOf(u).taunt || u.traits.includes("GUARDIAN"));
  if (guards.length) return { units: guards.map((g) => g.uid), hero: false };
  return { units: foe.board.map((u) => u.uid), hero: true };
}

export function attack(state: MatchState, id: SideId, attackerUid: string, target: string | "hero"): MatchState {
  if (state.winner || state.active !== id) return state;
  const legal = legalTargets(state, id);
  if (target === "hero" ? !legal.hero : !legal.units.includes(target)) return state;
  const s = clone(state);
  clearFx(s);
  const side = s.sides[id];
  const foe = s.sides[other(id)];
  const a = side.board.find((u) => u.uid === attackerUid);
  if (!a || !a.ready) return state;
  a.ready = false;
  a.fx = "attacking";
  if (id === "player") s.usage[a.cardId] = (s.usage[a.cardId] ?? 0) + 1;
  if (target === "hero") {
    const dmg = a.atk + (a.traits.includes("PIONEER") ? 1 : 0) + (abilityOf(a).heroBonus ?? 0) + (a.adaptations?.includes("VETERAN") ? 1 : 0);
    foe.hp -= dmg;
    foe.hurt = dmg;
    say(s, id, `${a.name} hit the rival for ${dmg}.`);
  } else {
    const t = foe.board.find((u) => u.uid === target)!;
    say(s, id, `${a.name} clashed with ${t.name}.`);
    const back = t.atk;
    hitUnit(t, a.atk + (a.adaptations?.includes("BATTLE_TESTED") ? 1 : 0));
    hitUnit(a, back);
    a.fx = "attacking";
    removeDead(s);
  }
  checkWin(s);
  return s;
}

export function endTurn(state: MatchState): MatchState {
  if (state.winner) return state;
  const s = clone(state);
  clearFx(s);
  const next = other(s.active);
  s.active = next;
  if (next === "player") s.turn += 1;
  const side = s.sides[next];
  const bonus = side.board.reduce((n, u) => n + (abilityOf(u).energy ?? 0) + (u.adaptations?.includes("DEEP_MEMORY") ? 1 : 0), 0);
  side.energy = Math.min(6, BASE_ENERGY + bonus);
  for (const u of side.board) u.ready = true;
  draw(s, next);
  for (const u of [...side.board]) abilityOf(u).onTurnStart?.(ctx(s, next, u));
  checkWin(s);
  return s;
}

/** Card that did the most work this match (for XP). */
export function mvpOf(s: MatchState): string | null {
  const e = Object.entries(s.usage).sort((a, b) => b[1] - a[1]);
  return e[0]?.[0] ?? null;
}

/** HEAD-TO-HEAD — host sits in "player", guest in "ai". Decks are rebuilt from BITMAP heights on the server. */
export function newPvpMatch(hostHeights: number[], guestHeights: number[], seed: number): MatchState {
  const r = rng(seed);
  const host = hostHeights.slice(0, 12).map((h) => createCardFromBitmap(emptyFacts(h), 0));
  const guest = guestHeights.slice(0, 12).map((h) => createCardFromBitmap(emptyFacts(h), 0));
  const hDeck = shuffle(host.map(toUnit), r);
  const gDeck = shuffle(guest.map(toUnit), r);
  const s: MatchState = {
    seed,
    turn: 1,
    active: "player",
    sides: {
      player: { hp: START_HP, energy: BASE_ENERGY, deck: hDeck.slice(4), hand: hDeck.slice(0, 4), board: [], hurt: 0 },
      ai: { hp: START_HP, energy: 0, deck: gDeck.slice(4), hand: gDeck.slice(0, 4), board: [], hurt: 0 },
    },
    log: [],
    winner: null,
    usage: {},
    playerDeckIds: host.map((c) => c.id),
    enemyHeights: guest.map((c) => c.bitmap),
    logId: 0,
  };
  say(s, "world", "Two travellers sit at the table. The world is the deck.");
  return s;
}

/** Mirror a match so the other seat sees itself as "player". */
export function flipMatch(s: MatchState): MatchState {
  const sw = (x: SideId | null): SideId | null => (x === null ? null : other(x));
  return {
    ...s,
    active: other(s.active),
    winner: sw(s.winner),
    sides: { player: s.sides.ai, ai: s.sides.player },
    log: s.log.map((l) => ({ ...l, side: l.side === "world" ? "world" : other(l.side) })),
    playerDeckIds: s.enemyHeights.map((h) => `bitmap-${h}`),
    enemyHeights: s.playerDeckIds.map((id) => Number(id.replace("bitmap-", ""))),
  };
}
