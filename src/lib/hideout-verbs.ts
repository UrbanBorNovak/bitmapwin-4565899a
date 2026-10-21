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
