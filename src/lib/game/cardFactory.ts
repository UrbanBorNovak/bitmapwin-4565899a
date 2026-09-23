import { atlasPlace } from "@/lib/atlas-places";
import type { BitmapFacts, CardType, LivingCard, Trait } from "./types";

export function hash(n: number) {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

const TYPES: CardType[] = ["TERRITORY", "BUILDER", "MINER", "EXPLORER", "GUARDIAN", "EVENT"];

const BASE: Record<CardType, { p: number; d: number; c: number }> = {
  TERRITORY: { p: 2, d: 6, c: 2 },
  BUILDER: { p: 3, d: 4, c: 2 },
  MINER: { p: 2, d: 3, c: 1 },
  EXPLORER: { p: 4, d: 2, c: 2 },
  GUARDIAN: { p: 2, d: 5, c: 2 },
  EVENT: { p: 3, d: 0, c: 1 },
};

const SUFFIX: Record<CardType, string> = {
  TERRITORY: "",
  BUILDER: " WRIGHT",
  MINER: " DELVER",
  EXPLORER: " WAYFARER",
  GUARDIAN: " WARDEN",
  EVENT: " OMEN",
};

export const TYPE_RULE: Record<CardType, string> = {
  TERRITORY: "+1 energy each of your turns while on the field.",
  BUILDER: "On play: every ally gains +1 defense.",
  MINER: "On play: draw a card.",
  EXPLORER: "Can attack the turn it arrives.",
  GUARDIAN: "Enemies must attack Guardians first.",
  EVENT: "Instant: strikes the strongest enemy, or the rival.",
};

export const TRAIT_RULE: Record<Trait, string> = {
  BUILDER: "Grows when its BITMAP gets a build.",
  MINER: "Linked to blocks and mining.",
  EXPLORER: "Grows when new cards are discovered.",
  PIONEER: "Early land: +1 damage to the rival.",
  TRADER: "Grows with market activity.",
  GUARDIAN: "Taunt — protects allies.",
  ARCHITECT: "Several builds on its land: +1 defense.",
  ORIGIN: "Deep-history land: heals your side 2 on play.",
  ACTIVIST: "Grows when it is played often.",
  NEIGHBOR: "+1 power when it joins an ally.",
};

const HALVING = 210_000;

/** Objective epithet (only facts derivable from the height itself). */
export function blockEpithet(height: number): string | null {
  if (height === 0) return "GENESIS BLOCK";
  if (height % HALVING === 0) return `HALVING ${height / HALVING}`;
  return null;
}

export function emptyFacts(height: number): BitmapFacts {
  return { height, source: "unavailable", buildCount: null, ownedByPlayer: false, checkedAt: null };
}

/** DERIVED: deterministic type + traits + stats from real facts. */
export function deriveCard(facts: BitmapFacts) {
  const h = facts.height;
  const seed = hash(h);
  const builds = facts.buildCount ?? 0;
  let type: CardType = TYPES[seed % TYPES.length]!;
  if (builds > 0) type = "BUILDER";
  if (facts.ownedByPlayer && type === "EVENT") type = "TERRITORY";

  const traits = new Set<Trait>();
  if (type === "BUILDER") traits.add("BUILDER");
  if (type === "MINER") traits.add("MINER");
  if (type === "EXPLORER") traits.add("EXPLORER");
  if (type === "GUARDIAN") traits.add("GUARDIAN");
  if (h < HALVING) traits.add("PIONEER");
  if (h < 50_000) traits.add("ORIGIN");
  if (builds > 0) traits.add("BUILDER");
  if (builds >= 3) traits.add("ARCHITECT");

  const b = BASE[type];
  const jitter = (seed >>> 8) % 3; // 0..2
  let power = b.p + (jitter === 2 ? 1 : 0);
  let defense = b.d + (jitter === 0 && b.d > 0 ? 1 : 0);
  if (traits.has("PIONEER") && defense > 0) defense += 1;
  if (traits.has("ORIGIN")) power += 1;
  if (traits.has("ARCHITECT")) defense += 1;
  const energy = Math.max(1, Math.min(3, b.c + (power + defense >= 9 ? 1 : 0)));

  const place = atlasPlace(h);
  const epithet = blockEpithet(h);
  const name = epithet && type === "TERRITORY" ? `THE ${epithet}` : `THE ${place.localName}${SUFFIX[type]}`;
  return { type, traits: [...traits], power, defense, energy, name, district: place.name };
}

/** BITMAP → CARD. Pure: the same facts always create the same card. */
export function createCardFromBitmap(facts: BitmapFacts, now = Date.now()): LivingCard {
  const d = deriveCard(facts);
  const h = facts.height;
  return {
    id: `bitmap-${h}`,
    name: d.name,
    origin: { kind: "bitmap", label: `${h}.BITMAP · ${d.district}` },
    bitmap: h,
    blockHeight: h,
    type: d.type,
    traits: d.traits,
    power: d.power,
    defense: d.defense,
    energy: d.energy,
    state: "DORMANT",
    history: [{ at: now, kind: "BORN", note: `Born from block ${h.toLocaleString("en-US")}` }],
    activity: 0,
    experience: 0,
    relationships: [h - 1, h + 1].filter((n) => n >= 0),
    lastEvent: "BORN",
    discoveredAt: now,
    firstPlayAt: null,
    plays: 0,
    matches: 0,
    wins: 0,
    facts,
  };
}

/** The Card Atlas: known places in the Oasis worth finding. Heights only — no invented facts. */
export const ATLAS_POOL: number[] = [
  0, 170, 50_000, 100_000, 145_159, 156_700, 210_000, 250_000, 333_333, 420_000, 481_824, 500_000,
  630_000, 709_632, 715_093, 767_430, 777_777, 800_000, 840_000, 850_000, 870_000, 888_888, 899_995, 900_000,
];

export const STARTER_HEIGHTS = [715_093, 156_700, 145_159, 899_995, 210_000, 420_000, 100_000, 840_000];
