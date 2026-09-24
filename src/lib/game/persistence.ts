import { STARTER_HEIGHTS, createCardFromBitmap, emptyFacts } from "./cardFactory";
import { DEFAULT_PLAY_VISUALS, normalizeVisualSettings } from "./pfpExtenders";
import type { PlayProfile } from "./types";

/** Persistence service. The UI never touches storage directly — swap adapters here. */
export interface PlayPersistence {
  load(owner: string): PlayProfile | null;
  save(profile: PlayProfile): void;
}

const PREFIX = "bitmapwin.play.v1:";
const memory = new Map<string, PlayProfile>();

export function normalizePlayProfile(profile: PlayProfile): PlayProfile {
  const cards = Object.fromEntries(Object.entries(profile.cards).map(([id, card]) => [id, {
    ...card,
    learning: {
      actions: card.learning?.actions ?? card.plays ?? 0,
      attacks: card.learning?.attacks ?? 0,
      abilityUses: card.learning?.abilityUses ?? card.plays ?? 0,
      adaptations: card.learning?.adaptations ?? [],
    },
  }]));
  return { ...profile, cards, visuals: normalizeVisualSettings(profile.visuals) };
}

export const localPlayPersistence: PlayPersistence = {
  load(owner) {
    try {
      const raw = window.localStorage.getItem(PREFIX + owner);
      if (!raw) return memory.get(owner) ?? null;
      const parsed = JSON.parse(raw) as PlayProfile;
       return parsed?.version === 1 ? normalizePlayProfile(parsed) : null;
    } catch {
      return memory.get(owner) ?? null;
    }
  },
  save(profile) {
    memory.set(profile.owner, profile);
    try {
      window.localStorage.setItem(PREFIX + profile.owner, JSON.stringify(profile));
    } catch {
      /* storage full or blocked — memory copy keeps the session playable */
    }
  },
};

export function newProfile(owner: string): PlayProfile {
  const now = Date.now();
  const cards = STARTER_HEIGHTS.map((h) => createCardFromBitmap(emptyFacts(h), now));
  return {
    version: 1,
    owner,
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    order: cards.map((c) => c.id),
    stats: { matches: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 },
    selectedBitmap: null,
    events: [],
    visuals: DEFAULT_PLAY_VISUALS,
  };
}
