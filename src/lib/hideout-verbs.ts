/** Verb rules for dev9's Batcave and Urban's Island Hotel. Pure functions, device-local puzzles. */
import type { Verb } from "@/lib/museum-verbs";

export type HideoutEffect = "talk" | "exit" | "gain" | "solve" | "hazard" | null;
export type HideoutOutcome = { text: string; effect: HideoutEffect };
const o = (text: string, effect: HideoutEffect = null): HideoutOutcome => ({ text, effect });
/** got = item picked up, solved = room puzzle finished. */
export type HideoutState = { got: boolean; solved: boolean };

// ---------- dev9's Batcave: pull the cold fuse from the ASIC rack, slot it into the Bat-computer. ----------
export type BatcaveHotspot = "dev9" | "computer" | "rack" | "bats" | "pool" | "lift";
export const BATCAVE_NAMES: Record<BatcaveHotspot, string> = {
  dev9: "DEV9", computer: "BAT-COMPUTER", rack: "ASIC RACK", bats: "SAT BATS", pool: "CAVE POOL", lift: "HYDRAULIC LIFT",
};
export function resolveBatcaveVerb(verb: Verb, h: BatcaveHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "dev9":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("dev9, the Marauder. He left the café booth to Dabber and moved underground. Never sits. Never blinks.");
      return o("dev9 doesn't turn around. 'Hands where the mempool can see them.'");
    case "computer":
      if (s.solved) return o("The Bat-computer scrolls the MARAUDER LOG: every block since 1138, every sweep, every ghost.");
      if (act && s.got) return o("You slot the cold fuse. Twelve CRTs flare green. The MARAUDER LOG unlocks.", "solve");
      if (act) return o("Dead screens. A fuse socket is empty. Label: COLD FUSE ONLY · SEE RACK.");
      return o("Twelve CRTs wired into one console. Dark. Something's missing from the fuse socket.");
    case "rack":
      if (s.got || s.solved) return o("The rack hums along without its spare fuse. dev9 runs lean.");
      if (verb === "pickup" || act) return o("You pull a frost-rimmed COLD FUSE from the ASIC rack. It's freezing.", "gain");
      return o("Liquid-cooled ASIC blades in a cave wall. A spare fuse glints between them.");
    case "bats":
      if (verb === "pickup" || act || verb === "talk") return o("You poke the roost. A hundred sat-bats explode out of the dark. SCREEECH!", "hazard");
      return o("Bats hanging upside down, each holding exactly one sat. Don't disturb them.");
    case "pool":
      if (verb === "pickup" || act) return o("Ice-cold water. Cooling loop for the whole cave. Your hand is now a validator.");
      return o("A black pool that reflects twelve CRT screens. Something orange glows at the bottom. Probably a Guardian.");
    case "lift":
      if (act) return o("", "exit");
      return o("A hydraulic lift up to the Oasis. Scratched on the rail: 'THE MARAUDER NEVER LEAVES. HE RE-ROUTES.'");
  }
}

// ---------- Urban's Island Hotel: knock a coconut from the palm, cure Urban's hangover with it. ----------
export type IslandHotspot = "urban" | "bed" | "palm" | "bar" | "sea" | "dock";
export const ISLAND_NAMES: Record<IslandHotspot, string> = {
  urban: "URBAN", bed: "HANGOVER BED", palm: "TWIN PALMS", bar: "TIKI MINI-BAR", sea: "SHALLOWS", dock: "SPEEDBOAT DOCK",
};
export function resolveIslandVerb(verb: Verb, h: IslandHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "urban":
      if (verb === "talk") return o("", "talk");
      if (s.solved) return o("Urban is awake, shades on, sketching a new district on a napkin.");
      if (act && s.got) return o("You hand Urban the coconut. One sip. He sits bolt upright: 'I remember where I hid the blueprint.'", "solve");
      if (verb === "look") return o("Urban, master architect, face-down on the hotel bed after laying the whole bedrock. Groaning in Hilbert curves.");
      return o("'Five more blocks...' he mumbles.");
    case "bed":
      if (verb === "look") return o("The HANGOVER BED: canopy, crushed linen, rolled-up blueprints on the headboard. Room service sign: DO NOT RE-ORG.");
      return o("It's occupied. Very occupied.");
    case "palm":
      if (s.got || s.solved) return o("Two palms sway, one coconut lighter.");
      if (verb === "pickup" || act) return o("You shake the palm. A coconut thuds into the sand. Hangover cure acquired.", "gain");
      return o("Two leaning palm trees, heavy with coconuts. Hammock strung between them.");
    case "bar":
      if (verb === "pickup" || act) return o("You pour a cocktail. It's 90% orange. Urban groans louder. Wrong cure.");
      return o("A tiki mini-bar. Every drink has a tiny pixel umbrella.");
    case "sea":
      if (verb === "pickup" || act) return o("You wade in. A jellyfish shaped like a UTXO stings you. OUCH!", "hazard");
      return o("Turquoise shallows. No fees out here. No mempool. Just waves.");
    case "dock":
      if (act) return o("", "exit");
      return o("A speedboat back to the Oasis. Name painted on the hull: GENESIS TIDE.");
  }
}

// ---------- CH.5 Beneath 1138: lift WILL's forged ledger, use it on the vault to expose the real blueprint. ----------
export type VaultHotspot = "ghost" | "ledger" | "vault" | "printer" | "villains" | "ladder";
export const VAULT_NAMES: Record<VaultHotspot, string> = {
  ghost: "GHOST OF 1138", ledger: "FORGED LEDGER", vault: "BLUEPRINT VAULT", printer: "CONFIRMATION PRINTER", villains: "TWO SHADOWS", ladder: "LADDER UP",
};
export function resolveVaultVerb(verb: Verb, h: VaultHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "ghost":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "The ghost of 1138 is calm now, humming four notes in the right order." : "The ghost of 1138 stands guard over a vault, flickering. Its hands are chained with printed receipts.");
      return o("Your hand passes straight through. Cold. Unconfirmed cold.");
    case "ledger":
      if (s.got || s.solved) return o("The ledger is in your hand. Every page signed 'W.' in fake ink.");
      if (verb === "pickup" || act) return o("You lift WILL's FORGED LEDGER from the crate. Sixty 'confirmations' for blocks that never existed.", "gain");
      return o("A thick ledger left on a crate. Embossed: PROPERTY OF WILL · DO NOT AUDIT.");
    case "vault":
      if (s.solved) return o("The vault stands open. Urban's real blueprint glows inside, every tile in the right place.");
      if (act && s.got) return o("You slam the forged ledger onto the vault's audit plate. It counts every fake. The lock rejects them all — and opens.", "solve");
      if (act) return o("The vault wants proof. Plate reads: AUDIT TO OPEN. Show me what's fake.");
      return o("A steel vault set into the bedrock under 1138. Urban's hilbert-curve sigil is carved on the door.");
    case "printer":
      if (verb === "pickup" || act) return o("You poke the printer. It spits sixty confirmations straight in your face. INK BLAST!", "hazard");
      return o("A humming printer stamping 'CONFIRMED' on blank receipts. This is how WILL forges blocks.");
    case "villains":
      if (verb === "talk") return o(s.solved ? "IMAN: 'You audited us. Fine. The Void has more doors than you have keys.' WILL: 'We'll print new ones.'" : "IMAN, from the dark: 'Turn back, Marshal. Orphans are inventory.' WILL laughs and keeps stamping.");
      if (verb === "look") return o("Two shadows in the back: IMAN, red-eyed, counting orphans; WILL, violet, feeding the printer.");
      return o("They step back into the dark. Not yet, they say. Not yet.");
    case "ladder":
      if (act) return o("", "exit");
      return o("A rusted ladder back up to the Void catwalk.");
  }
}

// ---------- CH.6 The Re-Org Lair: retarget the rogue rig with Urban's blueprint, then pull the breaker. ----------
export type LairHotspot = "iman" | "will" | "console" | "breaker" | "rack" | "ghost" | "hatch";
export const LAIR_NAMES: Record<LairHotspot, string> = {
  iman: "IMAN", will: "WILL", console: "ROGUE CONSOLE", breaker: "SIPHON BREAKER", rack: "OVERCLOCKED ASICS", ghost: "GHOST OF 1138", hatch: "ESCAPE HATCH",
};
export function resolveLairVerb(verb: Verb, h: LairHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "iman":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "IMAN stares at a dead screen. 'Orphans were inventory,' he mutters. 'Now they're just history.'" : "IMAN, red-eyed, guarding the console. Hands hovering over a key marked FAKE TIP.");
      return o("IMAN slaps your hand away. 'Touch the rig and you touch the Void, Marshal.'");
    case "will":
      if (verb === "talk") return o(s.solved ? "WILL, covered in ash: 'Sixty confirmations. Gone. Do you know how much ink that was?'" : "WILL: 'Six confirmations? I can print sixty. Want one? Free. Fake, but free.'");
      if (verb === "look") return o("WILL, violet-eyed, feeding forged receipts into the siphon like coal into a furnace.");
      return o("WILL hands you a receipt that says CONFIRMED. It dissolves. 'Oops. Wrong batch.'");
    case "console":
      if (s.solved) return o("The console reads: TARGET = REAL L1 TIP. CHAIN HONEST. SIPHON OFFLINE.");
      if (s.got) return o("The console already mines against the real tip. The BREAKER HANDLE is in your hand.");
      if (act) return o("You press Urban's real blueprint on the screen. The fake hash target melts. A drawer pops: the BREAKER HANDLE.", "gain");
      return o("The rogue console. Hardcoded target: 1138-FAKE. It's mining a heavier lie.");
    case "breaker":
      if (s.solved) return o("The breaker is down. The siphon is cold. Block 1138 is free.");
      if (act && s.got) return o("You slot the handle. The ghost of 1138 grips it with you. You both PULL. The siphon screams, the fake chain burns.", "solve");
      if (act) return o("A big breaker with no handle. Someone took it. Something on the console looks wired to it.");
      return o("SIPHON BREAKER · DO NOT PULL · signed I. & W.");
    case "rack":
      if (verb === "pickup" || act) return o("You touch the overclocked rack. It's 400 degrees of stolen hash. ZAP!", "hazard");
      return o("ASICs glowing cherry-red, running far past safe limits. Stolen hash, all of it.");
    case "ghost":
      if (verb === "look") return o(s.solved ? "The ghost of 1138 is solid for the first time. Confirmed." : "The ghost of 1138 hovers by the breaker, waiting for someone with a handle.");
      if (verb === "talk") return o(s.solved ? "GHOST: 'Four notes, in the right order. Thank you, Marshal.'" : "GHOST: 'Bring me the handle. I'll pull with you. I've waited 1138 blocks.'");
      return o("Your hand passes through. He nods at the breaker.");
    case "hatch":
      if (act) return o("", "exit");
      return o("An escape hatch up to the Oasis rigs.");
  }
}

// ---------- CH.7 The Void Basement: steal WILL's printed map, hold it to the Bedrock Monument to expose the counterfeit mint. ----------
export type BasementHotspot = "map" | "monument" | "mint" | "dust" | "ghost" | "ladder";
export const BASEMENT_NAMES: Record<BasementHotspot, string> = {
  map: "WILL'S PRINTED MAP", monument: "BEDROCK MONUMENT", mint: "COUNTERFEIT MINT", dust: "DUST POOL", ghost: "GHOST OF 1138", ladder: "LADDER UP",
};
export function resolveBasementVerb(verb: Verb, h: BasementHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "map":
      if (s.got || s.solved) return o("The map is in your hand. Every tile is a copy of a real BITMAP, a few pixels off.");
      if (verb === "pickup" || act) return o("You roll up WILL'S PRINTED MAP. Title: THE OASIS (IMPROVED). Every district, duplicated.", "gain");
      return o("A huge map pinned to a drafting table. It shows the Oasis... twice.");
    case "monument":
      if (s.solved) return o("The monument glows steady. Only one bedrock. Only one map. The real one.");
      if (act && s.got) return o("You hold the printed map against the Bedrock Monument. The real grid shines through. Every fake tile lights up red. The mint behind you starts to crack.", "solve");
      if (act) return o("The monument hums. Carved on it: ONE BLOCK · ONE BITMAP · COMPARE ANYTHING TO ME.");
      return o("A slab of bedrock carved with the true block grid. It was here before the basement was dug.");
    case "mint":
      if (s.solved) return o("The counterfeit mint is cold and cracked. A last copy of 1138.bitmap curls up and burns.");
      if (verb === "look") return o("A press stamping fake BITMAP plates: 1138.bitmap, 1138.bitmap, 1138.bitmap... all slightly wrong.");
      return o("The press slams an inch from your fingers. Copies shouldn't be touched. Compare them.");
    case "dust":
      if (verb === "pickup" || act) return o("You reach into the pool. It's dust from blocks that were never mined. WHOOSH! You're covered.", "hazard");
      return o("A pool of grey dust. It moves like water and smells like old mempool.");
    case "ghost":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "The ghost of 1138 stands taller. No copies of him left." : "The ghost of 1138 stares at the mint printing copies of himself.");
      return o("Cold. He points at the drafting table.");
    case "ladder":
      if (act) return o("", "exit");
      return o("A ladder back up through the Void to the Oasis.");
  }
}

// ---------- CH.8 The Missing Pages: fish page two out of IMAN's shredder, decode it on the honest chain reader. ----------
export type ArchiveHotspot = "shredder" | "reader" | "iman" | "fan" | "ghost" | "ladder";
export const ARCHIVE_NAMES: Record<ArchiveHotspot, string> = {
  shredder: "IMAN'S SHREDDER", reader: "CHAIN READER", iman: "IMAN", fan: "PAPER FAN", ghost: "GHOST OF 1138", ladder: "LADDER UP",
};
export function resolveArchiveVerb(verb: Verb, h: ArchiveHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "shredder":
      if (s.got || s.solved) return o("The shredder chews on nothing. Page two is safe in your hand.");
      if (verb === "pickup" || act) return o("You jam the shredder with your boot and pull out a half-eaten sheet: PAGE TWO of WILL's map.", "gain");
      return o("A shredder the size of a car. Labelled: ARCHIVE. IMAN's idea of filing.");
    case "reader":
      if (s.solved) return o("The reader shows page two plainly: a list of BITMAPs IMAN and WILL wanted to copy next. Every one still verified on chain.");
      if (act && s.got) return o("You feed page two into the chain reader. It checks every height against real blocks. Fake list, real targets. The plan is exposed.", "solve");
      if (act) return o("CHAIN READER · INSERT DOCUMENT TO VERIFY. It reads only blocks, never promises.");
      return o("An old CRT that only shows what the chain can prove. The one honest machine down here.");
    case "iman":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "IMAN, shadow-eyed, watching his list scroll on an honest screen." : "IMAN feeding pages into the shredder, one by one. He hasn't seen you yet.");
      return o("IMAN steps back. 'Don't touch the filing, Marshal.'");
    case "fan":
      if (verb === "pickup" || act) return o("You switch the fan to MAX. A blizzard of shredded receipts. FLUTTER!", "hazard");
      return o("A big industrial fan. It keeps the shreds moving so nobody can read them.");
    case "ghost":
      if (verb === "look") return o(s.solved ? "The ghost reads the list over your shoulder and nods." : "The ghost of 1138 hovers by the shredder, pointing at the slot.");
      if (verb === "talk") return o(s.solved ? "GHOST: 'Not just me. They wanted the whole district. Warn the others.'" : "GHOST: 'Page two never made it into the bin. Grab it before it does.'");
      return o("Cold. He points at the shredder.");
    case "ladder":
      if (act) return o("", "exit");
      return o("A ladder back up to the Oasis.");
  }
}

// ---------- CH.9 Page Three: take WILL's forged holder list, hold it to the Ownership Mirror that only shows what keys can move. ----------
export type HoldersHotspot = "plotter" | "mirror" | "will" | "wallets" | "ghost" | "ladder";
export const HOLDERS_NAMES: Record<HoldersHotspot, string> = {
  plotter: "SIGNATURE PLOTTER", mirror: "OWNERSHIP MIRROR", will: "WILL", wallets: "WALL OF FAKE WALLETS", ghost: "GHOST OF 1138", ladder: "LADDER UP",
};
export function resolveHoldersVerb(verb: Verb, h: HoldersHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "plotter":
      if (s.got || s.solved) return o("The plotter scratches at an empty tray. PAGE THREE is in your hand.");
      if (verb === "pickup" || act) return o("You snatch PAGE THREE from the plotter tray: a list of BITMAP holders, each with a 'signature' drawn in pen.", "gain");
      return o("A pen plotter drawing signatures, one holder after another. Very neat. Very fake.");
    case "mirror":
      if (s.solved) return o("The mirror shows every BITMAP still with its real holder. A pen can draw a name. Only a key can move a sat.");
      if (act && s.got) return o("You hold PAGE THREE to the Ownership Mirror. It checks each BITMAP against the chain. Not one drawn signature moves a single sat. The page goes blank.", "solve");
      if (act) return o("The mirror shows only what the chain shows. Bring it a claim to check.");
      return o("A tall mirror framed in old block headers. It reflects holders, not faces.");
    case "will":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "WILL stares at his blank page. 'It was such nice handwriting.'" : "WILL, violet-eyed, practising signatures with a quill. Hundreds of them.");
      return o("WILL swats your hand with the quill. 'Ink's wet, Marshal.'");
    case "wallets":
      if (verb === "pickup" || act) return o("You poke a fake wallet. It's just paper and air. POP! Confetti everywhere.", "hazard");
      return o("Paper wallets pinned to the wall, each labelled with a real holder's name. None of them hold anything.");
    case "ghost":
      if (verb === "look") return o(s.solved ? "The ghost of 1138 is laughing. First time anyone's heard it." : "The ghost of 1138 hovers by the mirror, tapping the frame.");
      if (verb === "talk") return o(s.solved ? "GHOST: 'They can't fake a key. That's the whole trick of Bitcoin.'" : "GHOST: 'Names on paper. Show them to the mirror. It only trusts keys.'");
      return o("Cold. He nods at the plotter.");
    case "ladder":
      if (act) return o("", "exit");
      return o("A ladder back up to the Oasis.");
  }
}

// ======================= CH.10 · THE HANDSHAKE =======================
export type HandshakeHotspot = "geek" | "printer" | "table" | "wierdamoto" | "bitoshi" | "flask" | "ghost" | "door";
export const HANDSHAKE_NAMES: Record<HandshakeHotspot, string> = {
  geek: "INVEST GEEK", printer: "TRACE PRINTER", table: "NEUTRAL TABLE", wierdamoto: "WIERDAMOTO", bitoshi: "BITOSHI", flask: "BITOSHI'S FLASK", ghost: "GHOST OF 1138", door: "BACK-ROOM DOOR",
};
export function resolveHandshakeVerb(verb: Verb, h: HandshakeHotspot, s: HideoutState): HideoutOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "geek":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o(s.solved ? "INVEST GEEK is adding a new column: FRIENDS AGAIN. It has two rows." : "INVEST GEEK, three monitors, one spreadsheet, row 1138 highlighted in orange.");
      return o("'Don't touch the keyboard. Use the printer.'");
    case "printer":
      if (s.got || s.solved) return o("The printer is empty. The trace is in your hand.");
      if (verb === "pickup" || act) return o("The printer spits out THE TRACE: row 1138, the input Wierdamoto paid, the change Bitoshi got, and a fee paid from a third, fresh address. Same pattern as IMAN.", "gain");
      return o("A dot-matrix printer hooked to Invest Geek's spreadsheet. It's warm and ready.");
    case "table":
      if (s.solved) return o("Two empty mugs, one printout, and a handshake still echoing off the walls.");
      if (act && s.got) return o("You slap THE TRACE on the neutral table. The mask reads it. The cook reads it. A long silence. Then: one gloved hand, one hazmat glove. HANDSHAKE.", "solve");
      if (act) return o("Nobody sits down for an opinion. Bring them proof.");
      return o("A small round table. Wierdamoto on one side, Bitoshi on the other, and a lot of glaring in between.");
    case "wierdamoto":
      if (verb === "talk") return o(s.solved ? "WIERDAMOTO: 'Framed. Both of us. By someone who knew we'd never check together.'" : "WIERDAMOTO: 'I'm not sitting until he admits he kept the key.'");
      if (verb === "look") return o("The mask, arms crossed, cape pooled on the chair.");
      return o("'Nobody takes custody of me.'");
    case "bitoshi":
      if (verb === "talk") return o(s.solved ? "BITOSHI: 'Fine. Ninety-nine point one percent friends.'" : "BITOSHI: 'I'm not sitting until he admits he left me a 1-of-2.'");
      if (verb === "look") return o("Bitoshi, hazmat hood down for once, gripping a spatula like a gavel.");
      return o("He raises the spatula. You reconsider.");
    case "flask":
      if (verb === "pickup" || act) return o("You shake Bitoshi's flask. FIZZ! Blue foam everywhere. Both of them yell at you. In unison. Progress?", "hazard");
      return o("Blue matter, bubbling. Bitoshi never goes anywhere without it.");
    case "ghost":
      if (verb === "talk") return o(s.solved ? "GHOST: 'The third address is IMAN's. Now three of us know it.'" : "GHOST: 'Row 1138 is about me too. Print it.'");
      return o(s.solved ? "The ghost of 1138 is glowing warm orange." : "The ghost of 1138 hovers by the printer.");
    case "door":
      if (act) return o("", "exit");
      return o("The back-room door to the Trading Post.");
  }
}
