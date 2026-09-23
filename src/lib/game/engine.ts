import { createCardFromBitmap, emptyFacts, ATLAS_POOL } from "./cardFactory";
import type { CardType, LivingCard, Trait } from "./types";

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
  return {
    uid: `${card.id}#${++uidN}`,
    cardId: card.id,
    name: card.name,
    type: card.type,
    traits: card.traits,
    height: card.bitmap,
    cost: card.energy,
    atk: card.power,
    hp: card.defense,
    maxHp: card.defense,
    ready: false,
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

export function newMatch(playerCards: LivingCard[], seed: number, leaderId?: string | null): MatchState {
  const r = rng(seed);
  const exclude = new Set(playerCards.map((c) => c.bitmap));
  const enemyHeights = enemyHeightsFor(seed, exclude);
  const enemyCards = enemyHeights.map((h) => createCardFromBitmap(emptyFacts(h), 0));
  let pDeck = shuffle(playerCards.slice(0, 12).map(toUnit), r);
  if (leaderId) {
    const i = pDeck.findIndex((u) => u.cardId === leaderId);
    if (i > 0) pDeck = [pDeck[i]!, ...pDeck.slice(0, i), ...pDeck.slice(i + 1)];
  }
  const eDeck = shuffle(enemyCards.map(toUnit), r);
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

  if (u.type === "EVENT") {
    const target = [...foe.board].sort((a, b) => b.atk - a.atk || b.hp - a.hp)[0];
    if (target) {
      target.hp -= u.atk;
      target.fx = "damaged";
      say(s, id, `${u.name} struck ${target.name} for ${u.atk}.`);
      if (target.hp <= 0) {
        foe.board = foe.board.filter((b) => b.uid !== target.uid);
        say(s, id, `${target.name} returned to the land.`);
      }
    } else {
      const dmg = u.atk + (u.traits.includes("PIONEER") ? 1 : 0);
      foe.hp -= dmg;
      foe.hurt = dmg;
      say(s, id, `${u.name} struck the rival for ${dmg}.`);
    }
    checkWin(s);
    return s;
  }

  if (u.traits.includes("NEIGHBOR") && side.board.length > 0) u.atk += 1;
  u.fx = "enter";
  u.ready = u.type === "EXPLORER";
  side.board.push(u);
  say(s, id, `${u.name} entered the field.`);
  if (u.type === "BUILDER") {
    for (const b of side.board) {
      b.hp += 1;
      b.maxHp += 1;
      if (b.uid !== u.uid) b.fx = "evolved";
    }
    say(s, id, "Builders raised the walls: allies +1 defense.");
  }
  if (u.type === "MINER") {
    draw(s, id);
    say(s, id, `${u.name} dug up a new card.`);
  }
  checkWin(s);
  return s;
}

export function legalTargets(s: MatchState, id: SideId): { units: string[]; hero: boolean } {
  const foe = s.sides[other(id)];
  const guards = foe.board.filter((u) => u.type === "GUARDIAN" || u.traits.includes("GUARDIAN"));
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
    const dmg = a.atk + (a.traits.includes("PIONEER") ? 1 : 0);
    foe.hp -= dmg;
    foe.hurt = dmg;
    say(s, id, `${a.name} hit the rival for ${dmg}.`);
  } else {
    const t = foe.board.find((u) => u.uid === target)!;
    t.hp -= a.atk;
    a.hp -= t.atk;
    t.fx = "damaged";
    say(s, id, `${a.name} clashed with ${t.name}.`);
    if (t.hp <= 0) {
      foe.board = foe.board.filter((u) => u.uid !== t.uid);
      say(s, id, `${t.name} returned to the land.`);
    }
    if (a.hp <= 0) {
      side.board = side.board.filter((u) => u.uid !== a.uid);
      say(s, id, `${a.name} returned to the land.`);
    }
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
  const territories = side.board.filter((u) => u.type === "TERRITORY").length;
  side.energy = Math.min(6, BASE_ENERGY + territories);
  for (const u of side.board) u.ready = true;
  draw(s, next);
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
