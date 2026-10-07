/**
 * EPIC & RAID BOSSES for Guardians. Pure data + deterministic rolls shared by
 * server (settlement) and browser (display). Boss HP lives in epic_bosses.
 */
export type BossTier = "epic" | "raid";
export type Boss = {
  slug: string;
  name: string;
  tier: BossTier;
  level: number;
  maxHp: number;
  armor: number;
  /** Damage the boss deals back each strike. */
  bite: number;
  respawnHours: number;
  lair: string;
  aura: string;
  jewel: string;
  bit: number;
};

export const BOSSES: Boss[] = [
  { slug: "valakas", name: "Valakas", tier: "epic", level: 85, maxHp: 6000, armor: 40, bite: 60, respawnHours: 24, lair: "Forge of the Gods", aura: "#ff4a1c", jewel: "Necklace of Valakas", bit: 3000 },
  { slug: "antharas", name: "Antharas", tier: "epic", level: 85, maxHp: 5500, armor: 44, bite: 55, respawnHours: 24, lair: "Dragon Valley", aura: "#c9a24a", jewel: "Earring of Antharas", bit: 2800 },
  { slug: "baium", name: "Baium", tier: "epic", level: 75, maxHp: 4500, armor: 36, bite: 50, respawnHours: 18, lair: "Tower of Insolence", aura: "#8fd3ff", jewel: "Ring of Baium", bit: 2200 },
  { slug: "zaken", name: "Zaken", tier: "epic", level: 60, maxHp: 3500, armor: 30, bite: 42, respawnHours: 12, lair: "Devil's Isle", aura: "#7a3cff", jewel: "Earring of Zaken", bit: 1600 },
  { slug: "orfen", name: "Orfen", tier: "epic", level: 50, maxHp: 2800, armor: 24, bite: 34, respawnHours: 8, lair: "Sea of Spores", aura: "#4fe08a", jewel: "Earring of Orfen", bit: 1200 },
  { slug: "core", name: "Core", tier: "epic", level: 50, maxHp: 2600, armor: 28, bite: 30, respawnHours: 8, lair: "Cruma Tower", aura: "#3fe0ff", jewel: "Ring of Core", bit: 1100 },
  { slug: "queen-ant", name: "Queen Ant", tier: "epic", level: 40, maxHp: 2000, armor: 20, bite: 26, respawnHours: 6, lair: "Ant Nest", aura: "#e0c43f", jewel: "Ring of Queen Ant", bit: 900 },
  { slug: "decarbia", name: "Decarbia", tier: "raid", level: 35, maxHp: 1200, armor: 16, bite: 22, respawnHours: 3, lair: "Ruins of Agony", aura: "#ff6a8a", jewel: "Decarbia's Horn", bit: 400 },
  { slug: "golkonda", name: "Golkonda", tier: "raid", level: 30, maxHp: 1000, armor: 14, bite: 20, respawnHours: 2, lair: "Wasteland", aura: "#ffa040", jewel: "Golkonda's Scale", bit: 320 },
  { slug: "ember", name: "Ember", tier: "raid", level: 25, maxHp: 900, armor: 10, bite: 18, respawnHours: 2, lair: "Burning Marsh", aura: "#ff8a3c", jewel: "Ember Shard", bit: 260 },
];

export const bossBySlug = (s: string) => BOSSES.find((b) => b.slug === s);
/** One strike per Guardian per this many minutes. */
export const STRIKE_COOLDOWN_MIN = 10;

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export type GuardianStats = { hp: number; bite: number; armor: number; speed: number };

/** Deterministic 3-hit volley; returns total damage and the boss's counter. */
export function strikeBoss(g: GuardianStats, boss: Boss, seed: string) {
  const roll = rng(seed);
  let damage = 0;
  const hits = 3 + Math.floor(g.speed / 40);
  for (let i = 0; i < hits; i++) {
    const crit = roll() < 0.12 ? 2 : 1;
    damage += Math.max(4, Math.round((g.bite * 3 * (0.85 + roll() * 0.3) - boss.armor * 0.5) * crit));
  }
  const counter = Math.max(1, Math.round(boss.bite * (0.8 + roll() * 0.4) - g.armor * 0.6));
  return { damage, counter, hits };
}

export type LootDrop = { item: string; rarity: "legendary" | "epic" | "rare" | "common"; bit: number };

/** Loot for one contributor after a kill. Top damage dealer always gets the jewel. */
export function rollLoot(boss: Boss, share: number, isTop: boolean, seed: string): LootDrop[] {
  const roll = rng(seed);
  const drops: LootDrop[] = [];
  const bit = Math.max(5, Math.round(boss.bit * share));
  if (isTop) drops.push({ item: boss.jewel, rarity: boss.tier === "epic" ? "legendary" : "epic", bit: 0 });
  else if (roll() < 0.05) drops.push({ item: boss.jewel, rarity: boss.tier === "epic" ? "legendary" : "epic", bit: 0 });
  const r = roll();
  if (r < 0.25) drops.push({ item: "Guardian Enhancement Core", rarity: "epic", bit: 0 });
  else if (r < 0.6) drops.push({ item: `${boss.name} Fragment`, rarity: "rare", bit: 0 });
  drops.push({ item: "BIT Spoils", rarity: "common", bit });
  return drops;
}

export const RARITY_COLOR: Record<string, string> = {
  legendary: "text-bitcoin", epic: "text-signal", rare: "text-foreground", common: "text-muted-foreground",
};

export type SquadRole = "tank" | "striker" | "support";
export const SQUAD_ROLES: { id: SquadRole; label: string; hint: string }[] = [
  { id: "tank", label: "TANK", hint: "High Armor — holds aggro" },
  { id: "striker", label: "STRIKER", hint: "High Bite — main damage" },
  { id: "support", label: "SUPPORT", hint: "High Speed — chips and finishes" },
];
export const SQUAD_MAX = 12;

/** Ready-made raid calls posted into world chat by squad members. */
export const BOSS_TACTICS: Record<string, string[]> = {
  valakas: ["Tanks front — Meteor Storm incoming, spread out!", "Strikers hit the tail cores while he breathes fire", "Burst now — Valakas under 30%!"],
  antharas: ["Earth Tremor — everyone jump on my mark", "Tanks hold the head, strikers flank the crags", "Petrify phase — supports finish him!"],
  "queen-ant": ["Kill the Royal Guards first", "Poison Mist — rotate tanks", "All in on the Queen — no healing larvae left!"],
  baium: ["Tanks absorb Celestial Fist", "Archangels up — strikers focus the guardians", "Burst Baium now!"],
  zaken: ["Night teleport — regroup on the deck", "Watch the life leech — supports chip", "Zaken low — finish!"],
  orfen: ["Spore Web — Speed Guardians lead", "Strikers on Orfen after the blink", "Final push!"],
  core: ["Destroy the Susceptor drones first", "Barrier down — all strikers in", "Core is cracking — burst!"],
};
export const GENERIC_TACTICS = ["Squad assemble — strike on my mark!", "Tanks first, strikers follow", "Boss low — everyone strike now!"];

/** Live bosses fight in shared clock windows so every squad sees the same start. */
export const RAID_WINDOW_MIN = 15;
export function nextFightAt(now: number, respawnAt: string | null) {
  if (respawnAt && Date.parse(respawnAt) > now) return Date.parse(respawnAt);
  const w = RAID_WINDOW_MIN * 60_000;
  return Math.ceil(now / w) * w;
}
export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
