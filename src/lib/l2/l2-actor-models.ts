/**
 * Picks a character model from the visitor's own .ukx files for players and NPCs in the world view.
 * Players: Interlude base body meshes are named by gender + race (+ Magic/Shaman for human/orc mystics),
 * e.g. MFighter, FMagic, MDarkElf, FShaman. NPCs: the client's npcgrp.dat (encrypted) is not read, so an
 * NPC is matched only by its name against model names, or by the visitor's own pick for that NPC id.
 * Nothing is guessed beyond that: no match means the plain marker stays and the reason is shown.
 */
export interface CatalogEntry { key: string; pkg: string; exportIndex: number; name: string }

const MYSTIC = new Set([10, 11, 12, 13, 14, 15, 16, 17, 25, 26, 27, 28, 29, 30, 38, 39, 40, 41, 42, 43, 49, 50, 51, 52, 94, 95, 96, 97, 98, 103, 104, 105, 110, 111, 112, 115, 116]);
export const isMysticClass = (classId: number) => MYSTIC.has(classId);

const RACE = ["Human", "Elf", "DarkElf", "Orc", "Dwarf"] as const;

/** Model names to look for, best first. race 0–4, sex 0 = male, 1 = female. */
export function playerModelNames(race: number, sex: number, classId: number): string[] {
  const g = sex === 1 ? "F" : "M", r = RACE[race];
  if (!r) return [];
  const mystic = isMysticClass(classId);
  if (r === "Human") return mystic ? [`${g}Magic`, `${g}Mage`, `${g}Fighter`] : [`${g}Fighter`];
  if (r === "Orc") return mystic ? [`${g}Shaman`, `${g}Orc`] : [`${g}Orc`];
  return [`${g}${r}`];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Exact name first, then a model whose name starts with the wanted name followed by a non-letter (MFighter_m000). */
export function findByNames(catalog: CatalogEntry[], names: string[]): CatalogEntry | null {
  for (const want of names) {
    const w = want.toLowerCase();
    const exact = catalog.find((c) => c.name.toLowerCase() === w);
    if (exact) return exact;
    const pre = catalog.find((c) => { const n = c.name.toLowerCase(); return n.startsWith(w) && !/[a-z]/.test(n[w.length] ?? ""); });
    if (pre) return pre;
  }
  return null;
}

/** NPC by its in-game name: the model name must equal the whole name, ignoring spaces and case. */
export function findNpcByName(catalog: CatalogEntry[], npcName: string): CatalogEntry | null {
  const n = norm(npcName);
  if (n.length < 3 || /^npc\d+$/.test(n)) return null;
  return catalog.find((c) => norm(c.name) === n) ?? null;
}
