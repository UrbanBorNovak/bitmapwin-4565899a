/**
 * BITMAPWIN // PLAY — data layers.
 *
 * BITCOIN / BITMAP DATA  → BitmapFacts   (only what an adapter actually read)
 * DERIVED TRAITS         → derived by cardFactory from facts (deterministic)
 * CARD STATE             → LivingCard (evolves through world events)
 * GAME STATE             → MatchState (engine.ts, ephemeral)
 * WORLD STATE            → WorldEventRecord log (events.ts)
 */

export type CardType = "TERRITORY" | "BUILDER" | "MINER" | "EXPLORER" | "GUARDIAN" | "EVENT";
export type CardState = "DORMANT" | "ACTIVE" | "AWAKENED" | "DEVELOPED" | "LEGENDARY";
export type Trait =
  | "BUILDER"
  | "MINER"
  | "EXPLORER"
  | "PIONEER"
  | "TRADER"
  | "GUARDIAN"
  | "ARCHITECT"
  | "ORIGIN"
  | "ACTIVIST"
  | "NEIGHBOR";

export type OriginKind = "bitmap" | "block" | "territory" | "build" | "player" | "event" | "location" | "object";

export const CARD_STATES: CardState[] = ["DORMANT", "ACTIVE", "AWAKENED", "DEVELOPED", "LEGENDARY"];

/** REAL WORLD DATA — never invented. `null` means the adapter could not read it. */
export type BitmapFacts = {
  height: number;
  /** Where the facts came from. "unavailable" = nothing beyond the block height is known. */
  source: "bitmapwin-world" | "unavailable";
  /** Persistent Oasis builds recorded on this BITMAP (BitmapWin world records). */
  buildCount: number | null;
  /** The connected wallet holds this BITMAP (from the indexed holder lookup). */
  ownedByPlayer: boolean;
  checkedAt: number | null;
};

export type WorldEventKind =
  | "BITMAP_CLAIMED"
  | "BITMAP_BUILT"
  | "BITMAP_LEASED"
  | "NEW_BUILD"
  | "NEW_NEIGHBOR"
  | "PLAYER_WIN"
  | "PLAYER_LOSS"
  | "CARD_PLAYED"
  | "CARD_DISCOVERED"
  | "CARD_EVOLVED"
  | "WORLD_EVENT";

export type CardHistoryEntry = { at: number; kind: WorldEventKind | "BORN"; note: string };

export type LivingCard = {
  id: string;
  name: string;
  origin: { kind: OriginKind; label: string };
  bitmap: number;
  blockHeight: number;
  type: CardType;
  traits: Trait[];
  power: number;
  defense: number;
  /** Energy cost to play. */
  energy: number;
  state: CardState;
  history: CardHistoryEntry[];
  activity: number;
  experience: number;
  /** Related BITMAP heights (neighbours in the grid). */
  relationships: number[];
  lastEvent: WorldEventKind | "BORN";
  discoveredAt: number;
  firstPlayAt: number | null;
  plays: number;
  matches: number;
  wins: number;
  facts: BitmapFacts;
};

export type WorldEventRecord = {
  id: string;
  at: number;
  kind: WorldEventKind;
  text: string;
  cardId?: string | undefined;
  height?: number | undefined;
};

export type CardVisualExtender = {
  id: string;
  name: string;
  collection: string;
  source: "ordinals-html" | "ordinals-image";
  inscriptionId: string;
  enabled: boolean;
  builtIn: boolean;
  addedAt: number;
  /** Optional parent/child import binding: this visual only appears on that BITMAP. */
  bitmap?: number | null;
  parentInscriptionId?: string | null;
  contentType?: string | null;
  childIndex?: number | null;
  childCount?: number | null;
};

export type PlayVisualSettings = {
  /** Optional cosmetic layer: never changes ownership, stats or gameplay. */
  pfpExtendersEnabled: boolean;
  /** Active background pool. ORD TORCHES is a virtual on-chain pool. */
  selectedPfpCollection: string | null;
  /** Legacy selected item; retained so existing saved profiles remain compatible. */
  selectedPfpExtenderId: string | null;
  customPfpExtenders: CardVisualExtender[];
};

export type PlayStats = {
  matches: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
};

export type PlayProfile = {
  version: 1;
  owner: string;
  cards: Record<string, LivingCard>;
  order: string[];
  stats: PlayStats;
  selectedBitmap: number | null;
  events: WorldEventRecord[];
  visuals: PlayVisualSettings;
};

/** Visible outcome of a world event on one card — drives the "this card is alive" moment. */
export type CardChange = {
  cardId: string;
  name: string;
  height: number;
  from: CardState;
  to: CardState;
  activity: number;
  xp: number;
  traitUnlocked: Trait | null;
  statNote: string | null;
};
