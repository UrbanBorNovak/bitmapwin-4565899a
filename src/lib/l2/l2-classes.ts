// Interlude class and race names for character select.
const NAMES: Record<number, string> = {};
"Human Fighter,Warrior,Gladiator,Warlord,Human Knight,Paladin,Dark Avenger,Rogue,Treasure Hunter,Hawkeye,Human Mystic,Human Wizard,Sorcerer,Necromancer,Warlock,Cleric,Bishop,Prophet,Elven Fighter,Elven Knight,Temple Knight,Swordsinger,Elven Scout,Plainswalker,Silver Ranger,Elven Mystic,Elven Wizard,Spellsinger,Elemental Summoner,Elven Oracle,Elven Elder,Dark Fighter,Palus Knight,Shillien Knight,Bladedancer,Assassin,Abyss Walker,Phantom Ranger,Dark Mystic,Dark Wizard,Spellhowler,Phantom Summoner,Shillien Oracle,Shillien Elder,Orc Fighter,Orc Raider,Destroyer,Orc Monk,Tyrant,Orc Mystic,Orc Shaman,Overlord,Warcryer,Dwarven Fighter,Scavenger,Bounty Hunter,Artisan,Warsmith"
  .split(",").forEach((n, i) => { NAMES[i] = n; });
"Duelist,Dreadnought,Phoenix Knight,Hell Knight,Sagittarius,Adventurer,Archmage,Soultaker,Arcana Lord,Cardinal,Hierophant,Eva's Templar,Sword Muse,Wind Rider,Moonlight Sentinel,Mystic Muse,Elemental Master,Eva's Saint,Shillien Templar,Spectral Dancer,Ghost Hunter,Ghost Sentinel,Storm Screamer,Spectral Master,Shillien Saint,Titan,Grand Khavatari,Dominator,Doomcryer,Fortune Seeker,Maestro"
  .split(",").forEach((n, i) => { NAMES[88 + i] = n; });
export const className = (id: number) => NAMES[id] ?? `Class #${id}`;
export const raceName = (id: number) => ["Human", "Elf", "Dark Elf", "Orc", "Dwarf", "Kamael"][id] ?? `Race #${id}`;
