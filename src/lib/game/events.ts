import { createCardFromBitmap } from "./cardFactory";
import type {
  CardChange,
  CardState,
  LivingCard,
  PlayProfile,
  Trait,
  LearnedAdaptation,
  WorldEventKind,
  WorldEventRecord,
  BitmapFacts,
} from "./types";

/** Shared world-event model. Every change to a card flows through applyWorldEvent. */
export type WorldEvent =
  | { kind: "CARD_PLAYED"; cardId: string; actor: string }
  | { kind: "CARD_ATTACKED"; cardId: string; actor: string }
  | { kind: "PLAYER_WIN"; mvpId: string | null; deckIds: string[]; actor: string }
  | { kind: "PLAYER_LOSS"; mvpId: string | null; deckIds: string[]; actor: string }
  | { kind: "CARD_DISCOVERED"; facts: BitmapFacts; actor: string }
  | { kind: "NEW_BUILD"; height: number; buildCount: number }
  | { kind: "NEW_NEIGHBOR"; height: number }
  | { kind: "WORLD_EVENT"; text: string };

const UNLOCK: Record<LivingCard["type"], Trait> = {
  TERRITORY: "BUILDER",
  BUILDER: "ARCHITECT",
  MINER: "TRADER",
  EXPLORER: "NEIGHBOR",
  GUARDIAN: "NEIGHBOR",
  EVENT: "ACTIVIST",
};

const rank = (s: CardState) => ["DORMANT", "ACTIVE", "AWAKENED", "DEVELOPED", "LEGENDARY"].indexOf(s);
const raise = (card: LivingCard, to: CardState) => (rank(to) > rank(card.state) ? to : card.state);

function rid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function note(card: LivingCard, kind: WorldEventKind, text: string, at: number) {
  card.history = [...card.history, { at, kind, note: text }].slice(-40);
  card.lastEvent = kind;
}

function change(card: LivingCard, from: CardState, xp: number, act: number, trait: Trait | null, adaptation: LearnedAdaptation | null, stat: string | null): CardChange {
  return { cardId: card.id, name: card.name, height: card.bitmap, from, to: card.state, activity: act, xp, traitUnlocked: trait, adaptationUnlocked: adaptation, statNote: stat };
}

const TYPE_ADAPTATION: Record<LivingCard["type"], LearnedAdaptation> = {
  TERRITORY: "FORTIFIED", BUILDER: "MASTERWORK", MINER: "DEEP_MEMORY",
  EXPLORER: "PATHFINDER", GUARDIAN: "RESOLUTE", EVENT: "CATALYST",
};

function learn(card: LivingCard, adaptation: LearnedAdaptation, at: number): boolean {
  if (card.learning.adaptations.includes(adaptation)) return false;
  card.learning.adaptations.push(adaptation);
  if (adaptation === "FORTIFIED" || adaptation === "MASTERWORK" || adaptation === "RESOLUTE") card.defense += 1;
  else card.power += 1;
  note(card, "CARD_EVOLVED", `Learned ${adaptation.replace(/_/g, " ")}`, at);
  return true;
}

function evolve(card: LivingCard, at: number) {
  const before = card.state;
  if (card.state === "ACTIVE" && (card.experience >= 12 || card.learning.actions >= 8)) card.state = "AWAKENED";
  if (rank(card.state) >= rank("AWAKENED") && (card.experience >= 36 || (card.facts.buildCount ?? 0) >= 3)) card.state = raise(card, "DEVELOPED");
  if (card.state === "DEVELOPED" && card.wins >= 5 && card.experience >= 60) card.state = "LEGENDARY";
  if (card.state !== before) note(card, "CARD_EVOLVED", `Became ${card.state}`, at);
}

export function applyWorldEvent(
  profile: PlayProfile,
  event: WorldEvent,
  at = Date.now(),
): { profile: PlayProfile; changes: CardChange[] } {
  const p: PlayProfile = { ...profile, cards: { ...profile.cards }, stats: { ...profile.stats }, order: [...profile.order], visuals: { ...profile.visuals, customPfpExtenders: [...profile.visuals.customPfpExtenders] } };
  const changes: CardChange[] = [];
  const log: WorldEventRecord[] = [];
  const edit = (id: string) => {
    const c = p.cards[id];
    if (!c) return null;
    const copy = { ...c, traits: [...c.traits], history: [...c.history], learning: { ...c.learning, adaptations: [...c.learning.adaptations] } };
    p.cards[id] = copy;
    return copy;
  };

  switch (event.kind) {
    case "CARD_PLAYED": {
      const c = edit(event.cardId);
      if (!c) break;
      const from = c.state;
      c.activity += 1;
      c.plays += 1;
      c.learning.actions += 1;
      c.learning.abilityUses += 1;
      let unlocked: Trait | null = null;
      let adaptation: LearnedAdaptation | null = null;
      if (c.firstPlayAt === null) {
        c.firstPlayAt = at;
        c.state = raise(c, "ACTIVE");
        const t = UNLOCK[c.type];
        if (!c.traits.includes(t)) {
          c.traits.push(t);
          unlocked = t;
        }
        note(c, "CARD_PLAYED", "First play — the card woke up", at);
        log.push({ id: rid(), at, kind: "CARD_PLAYED", cardId: c.id, height: c.bitmap, text: `${c.bitmap}.BITMAP responded — ${c.name} became ${c.state}` });
      } else {
        note(c, "CARD_PLAYED", "Played in a match", at);
      }
      if (c.plays >= 3 && learn(c, TYPE_ADAPTATION[c.type], at)) adaptation = TYPE_ADAPTATION[c.type];
      if (c.learning.actions >= 8 && learn(c, "BATTLE_TESTED", at)) adaptation = "BATTLE_TESTED";
      if (c.traits.includes("ACTIVIST") && c.plays % 5 === 0) c.power += 1;
      evolve(c, at);
      changes.push(change(c, from, 0, 1, unlocked, adaptation, adaptation ? `LEARNED ${adaptation.replace(/_/g, " ")}` : null));
      break;
    }
    case "CARD_ATTACKED": {
      const c = edit(event.cardId);
      if (!c) break;
      const from = c.state;
      c.learning.actions += 1;
      c.learning.attacks += 1;
      c.activity += 1;
      let adaptation: LearnedAdaptation | null = null;
      if (c.learning.actions >= 8 && learn(c, "BATTLE_TESTED", at)) adaptation = "BATTLE_TESTED";
      else note(c, "CARD_ATTACKED", `Attacked in a match · ${c.learning.attacks} total`, at);
      evolve(c, at);
      changes.push(change(c, from, 0, 1, null, adaptation, adaptation ? "LEARNED BATTLE TESTED" : null));
      break;
    }
    case "PLAYER_WIN":
    case "PLAYER_LOSS": {
      const win = event.kind === "PLAYER_WIN";
      p.stats.matches += 1;
      if (win) {
        p.stats.wins += 1;
        p.stats.streak = Math.max(0, p.stats.streak) + 1;
        p.stats.bestStreak = Math.max(p.stats.bestStreak, p.stats.streak);
      } else {
        p.stats.losses += 1;
        p.stats.streak = 0;
      }
      for (const id of event.deckIds) {
        const c = edit(id);
        if (c) c.matches += 1;
      }
      if (event.mvpId) {
        const c = edit(event.mvpId);
        if (c) {
          const from = c.state;
          const xp = win ? 12 : 4;
          c.experience += xp;
          c.activity += 1;
          if (win) {
            c.wins += 1;
            c.state = raise(c, "AWAKENED");
          }
          note(c, event.kind, win ? `Won a match (+${xp} XP)` : `Fought and fell (+${xp} XP)`, at);
          const adaptation = c.wins >= 3 && learn(c, "VETERAN", at) ? "VETERAN" : null;
          evolve(c, at);
          changes.push(change(c, from, xp, 1, null, adaptation, adaptation ? "LEARNED VETERAN" : null));
        }
      }
      log.push({ id: rid(), at, kind: event.kind, cardId: event.mvpId ?? undefined, text: `${event.actor} ${win ? "won" : "lost"} a match${event.mvpId && p.cards[event.mvpId] ? ` with ${p.cards[event.mvpId]!.name}` : ""}` });
      break;
    }
    case "CARD_DISCOVERED": {
      const id = `bitmap-${event.facts.height}`;
      if (p.cards[id]) break;
      const card = createCardFromBitmap(event.facts, at);
      p.cards[id] = card;
      p.order.push(id);
      // Explorer cards grow when the world opens up.
      for (const other of Object.values(p.cards)) {
        if (other.id !== id && other.traits.includes("EXPLORER")) {
          const c = edit(other.id)!;
          c.activity += 1;
        }
      }
      changes.push(change(card, "DORMANT", 0, 0, null, null, "NEW CARD"));
      log.push({ id: rid(), at, kind: "CARD_DISCOVERED", cardId: id, height: card.bitmap, text: `${event.actor} discovered ${card.name} at ${card.bitmap}.BITMAP` });
      break;
    }
    case "NEW_BUILD": {
      for (const card of Object.values(p.cards)) {
        const own = card.bitmap === event.height;
        if (!own && !card.traits.includes("BUILDER")) continue;
        const c = edit(card.id)!;
        const from = c.state;
        if (own) {
          c.facts = { ...c.facts, buildCount: event.buildCount, source: "bitmapwin-world", checkedAt: at };
          c.defense += 1;
          if (!c.traits.includes("BUILDER")) c.traits.push("BUILDER");
          if (event.buildCount >= 3 && !c.traits.includes("ARCHITECT")) c.traits.push("ARCHITECT");
          if (rank(c.state) >= rank("ACTIVE")) c.state = raise(c, "DEVELOPED");
          note(c, "NEW_BUILD", `Its land now holds ${event.buildCount} Oasis build${event.buildCount === 1 ? "" : "s"}`, at);
          evolve(c, at);
          changes.push(change(c, from, 0, 0, null, null, "+1 DEFENSE"));
        } else {
          c.activity += 1;
        }
      }
      log.push({ id: rid(), at, kind: "NEW_BUILD", height: event.height, text: `A build rose on ${event.height}.BITMAP — Builder cards stirred` });
      break;
    }
    case "NEW_NEIGHBOR": {
      for (const card of Object.values(p.cards)) {
        if (card.traits.includes("NEIGHBOR") && Math.abs(card.bitmap - event.height) <= 1) edit(card.id)!.activity += 1;
      }
      log.push({ id: rid(), at, kind: "NEW_NEIGHBOR", height: event.height, text: `A new neighbour arrived near ${event.height}.BITMAP` });
      break;
    }
    case "WORLD_EVENT":
      log.push({ id: rid(), at, kind: "WORLD_EVENT", text: event.text });
      break;
  }

  p.events = [...log.reverse(), ...profile.events].slice(0, 80);
  return { profile: p, changes };
}
