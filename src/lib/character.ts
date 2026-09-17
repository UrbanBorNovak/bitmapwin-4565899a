/**
 * CHARACTER — who you are in the Oasis.
 *
 * Name, look and a written backstory, kept in this browser next to the rest of
 * the map identity. The prose is written by a distilled storyteller: a frozen
 * grammar of phrases picked by a seeded shuffle from the traits you choose.
 * It reads like a model wrote it, but it is plain local text assembly — no
 * model call, no tokens, no AI credits, and it works offline.
 */

import { useEffect, useState } from "react";
import { DEFAULT_AVATAR_MODEL, setMapHandle } from "@/lib/map-identity";

const KEY = "bitmapwin:character";

export type TraitId = "origin" | "calling" | "vice" | "oath";

export type Character = {
  name: string;
  origin: string;
  calling: string;
  vice: string;
  oath: string;
  /** on-chain GLB inscription the figure wears, or null for the default figure */
  avatarModel: string | null;
  /** on-chain BITMAP pixel skin painted on the default figure, or null for the stock skin */
  avatarSkin: string | null;
  /** reroll counter — changes the prose without changing the traits */
  seed: number;
  /** generated, stored so the page and inventory always agree */
  title: string;
  backstory: string;
  savedAt: number;
};

type Option = { id: string; label: string; blurb: string };

export const ORIGINS: Option[] = [
  { id: "genesis", label: "GENESIS SANDS", blurb: "raised on the oldest blocks, where the dunes never moved" },
  { id: "citadel", label: "SATOSHI CITADEL", blurb: "a citadel child who learned to read ledgers before maps" },
  { id: "deepmine", label: "DEEP MINE", blurb: "born down a shaft, lamp-light for a first sunrise" },
  { id: "seawall", label: "SEA WALL", blurb: "washed up on the island shelf with nothing but a hide bag" },
  { id: "nomad", label: "DUNE NOMAD", blurb: "no home height — the caravan was the country" },
  { id: "arena", label: "THE ARENA", blurb: "grew up in the sand pits, counting wins instead of birthdays" },
];

export const CALLINGS: Option[] = [
  { id: "miner", label: "MINER", blurb: "reads ore the way others read weather" },
  { id: "hunter", label: "HUNTER", blurb: "moves quiet, waits longer than the prey does" },
  { id: "builder", label: "BUILDER", blurb: "cannot pass flat ground without measuring it" },
  { id: "trader", label: "TRADER", blurb: "prices everything, twice, and is usually right" },
  { id: "ranger", label: "RANGER", blurb: "rides the far edges nobody bothers to patrol" },
  { id: "scribe", label: "SCRIBE", blurb: "writes down every block that mattered, and some that did not" },
];

export const VICES: Option[] = [
  { id: "gold", label: "GOLD FEVER", blurb: "a pack that is always three bars too heavy" },
  { id: "smoke", label: "SMOKE", blurb: "one cigarette per hard decision, and there are many" },
  { id: "speed", label: "SPEED", blurb: "never met a ride that could not go faster" },
  { id: "relics", label: "RELICS", blurb: "will walk into a storm for a rumour of a chest" },
  { id: "wagers", label: "WAGERS", blurb: "bets on raiders, races and the weather alike" },
  { id: "silence", label: "SILENCE", blurb: "goes days without a word and calls it rest" },
];

export const OATHS: Option[] = [
  { id: "land", label: "HOLD THE LAND", blurb: "what is claimed stays claimed" },
  { id: "clan", label: "THE CLAN FIRST", blurb: "no crest-mate is left in the sand" },
  { id: "chain", label: "ONLY ON-CHAIN", blurb: "if it is not inscribed, it did not happen" },
  { id: "weak", label: "GUARD THE SMALL", blurb: "settlers, strays and geese included" },
  { id: "free", label: "OWE NOBODY", blurb: "no lease, no lord, no leash" },
  { id: "hunt", label: "FINISH THE HUNT", blurb: "a thing started is a thing ended" },
];

export const TRAIT_TABLES: Record<TraitId, Option[]> = {
  origin: ORIGINS,
  calling: CALLINGS,
  vice: VICES,
  oath: OATHS,
};

/* ---------------------------------------------------------------- storyteller */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(list: readonly T[], roll: () => number): T => list[Math.floor(roll() * list.length) % list.length] as T;

const EPITHETS: Record<string, string[]> = {
  miner: ["OF THE DEEP SEAM", "THE SHAFT-WALKER", "STONE-EATER"],
  hunter: ["THE QUIET SHOT", "OF THE LONG WAIT", "TRACK-READER"],
  builder: ["THE STACKER", "OF SQUARE GROUND", "WALL-RAISER"],
  trader: ["THE PRICE-KEEPER", "OF THE FAIR CUT", "SAT-COUNTER"],
  ranger: ["OF THE FAR EDGE", "THE DUST-RIDER", "BORDER-WALKER"],
  scribe: ["THE BLOCK-KEEPER", "OF THE LONG LEDGER", "INK-HAND"],
};

const HOOKS = [
  "There is a story about",
  "Ask anyone on the trail about",
  "The chat still repeats what happened to",
  "Traders at the Bit Cafe remember",
];

const TURNS = [
  "then a night raid took everything but the boots",
  "then a claim went sour three heights from home",
  "then a chest opened and nothing inside was worth the walk",
  "then a companion went missing and came back changed",
  "then a lease was broken by someone with a bigger crew",
];

const NOWS = [
  "Now the pack is packed for a longer trip than admitted.",
  "Now every sunrise starts with a walk to the edge of the claim.",
  "Now the only rule left is the one carried in, unspoken.",
  "Now the map is read backwards: where nobody else is going.",
];

const CLOSERS = [
  "Not a legend yet. Working on it.",
  "The ledger will decide the rest.",
  "It is a long way to a name that lasts.",
  "The sand keeps score better than people do.",
];

const blurb = (table: Option[], id: string) => table.find((o) => o.id === id)?.blurb ?? "";
const label = (table: Option[], id: string) => table.find((o) => o.id === id)?.label ?? id.toUpperCase();

/** A title like "RANGER OF THE FAR EDGE" — deterministic for the same traits and seed. */
export function writeTitle(draft: Pick<Character, "name" | "calling" | "seed">): string {
  const roll = rng(hash(`${draft.name}|${draft.calling}|title|${draft.seed}`));
  const list = EPITHETS[draft.calling] ?? ["THE UNWRITTEN"];
  return `${label(CALLINGS, draft.calling)} ${pick(list, roll)}`;
}

/** Three short paragraphs of backstory, assembled locally from the trait grammar. */
export function writeBackstory(
  draft: Pick<Character, "name" | "origin" | "calling" | "vice" | "oath" | "seed">,
): string {
  const who = draft.name.trim() || "THIS ONE";
  const roll = rng(hash(`${who}|${draft.origin}|${draft.calling}|${draft.vice}|${draft.oath}|${draft.seed}`));
  const one = `${pick(HOOKS, roll)} ${who}: ${blurb(ORIGINS, draft.origin)}. By the time the sand settled, ${who} ${blurb(CALLINGS, draft.calling)}.`;
  const two = `The weakness is plain enough — ${blurb(VICES, draft.vice)} — and it has cost real bars. It worked for a while: ${pick(TURNS, roll)}. ${pick(NOWS, roll)}`;
  const three = `One oath survived all of it: ${label(OATHS, draft.oath)} — ${blurb(OATHS, draft.oath)}. ${pick(CLOSERS, roll)}`;
  return `${one}\n\n${two}\n\n${three}`;
}

/* -------------------------------------------------------------------- storage */

export function blankCharacter(): Character {
  const draft = {
    name: "",
    origin: ORIGINS[0]!.id,
    calling: CALLINGS[0]!.id,
    vice: VICES[0]!.id,
    oath: OATHS[0]!.id,
    avatarModel: null,
    avatarSkin: null,
    seed: 1,
  };
  return {
    ...draft,
    title: writeTitle(draft),
    backstory: writeBackstory(draft),
    savedAt: 0,
  };
}

export function readCharacter(): Character | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Character>;
    if (!parsed || typeof parsed.name !== "string") return null;
    const base = blankCharacter();
    return {
      ...base,
      ...parsed,
      avatarModel: typeof parsed.avatarModel === "string" && parsed.avatarModel.trim() ? parsed.avatarModel.trim() : null,
      seed: Number.isFinite(parsed.seed) ? Number(parsed.seed) : 1,
      savedAt: Number.isFinite(parsed.savedAt) ? Number(parsed.savedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveCharacter(character: Character): Character {
  const stored: Character = {
    ...character,
    name: character.name.trim().slice(0, 24),
    title: writeTitle(character),
    backstory: writeBackstory(character),
    savedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(stored));
    } catch {
      /* storage blocked — the sheet simply is not remembered */
    }
    if (stored.name) setMapHandle(stored.name);
    window.dispatchEvent(new CustomEvent("bitmapwin:character", { detail: stored }));
  }
  return stored;
}

/** The figure this character walks as. */
export function characterModel(character: Character | null): string | null {
  return character?.avatarModel ?? null;
}

export { DEFAULT_AVATAR_MODEL };

/* ------------------------------------------------------- live character hook */
/**
 * The saved character, kept live: it updates when the sheet is saved in another
 * tab or on the character page while the world is open.
 */
export function useCharacter(): Character | null {
  const [character, setCharacter] = useState<Character | null>(null);
  useEffect(() => {
    setCharacter(readCharacter());
    const onSave = (event: Event) => setCharacter((event as CustomEvent<Character>).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setCharacter(readCharacter());
    };
    window.addEventListener("bitmapwin:character", onSave);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bitmapwin:character", onSave);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return character;
}
