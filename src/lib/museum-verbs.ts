/** Eternam-style verb bar rules for the Bit Museum. Pure: (verb, hotspot, state) → outcome. */
export type Verb = "look" | "talk" | "pickup" | "use" | "open";
export const VERBS: { id: Verb; label: string }[] = [
  { id: "look", label: "LOOK AT" }, { id: "talk", label: "TALK TO" }, { id: "pickup", label: "PICK UP" },
  { id: "use", label: "USE" }, { id: "open", label: "OPEN" },
];
export type Hotspot = "curator" | "door" | "genesis" | "pizza" | "glass" | "lens" | "signatures";
export const HOTSPOT_NAMES: Record<Hotspot, string> = {
  curator: "MUSEUM CURATOR", door: "EXIT DOOR", genesis: "GENESIS CASE", pizza: "PIZZA CASE",
  glass: "INSCRIPTION GLASS", lens: "EXPLORER LENS", signatures: "NIGHT OF TWO SIGNATURES",
};
export type MuseumState = { held: string[]; solved: boolean; item: string | null; exhibitOpen?: boolean };
export type Effect = "talk" | "exit" | "pickup-lens" | "solve" | "exhibit" | null;
export type Outcome = { text: string; effect: Effect };

const o = (text: string, effect: Effect = null): Outcome => ({ text, effect });

export function resolveVerb(verb: Verb, h: Hotspot, s: MuseumState): Outcome {
  if (verb === "use" && s.item === "lens") {
    if (h === "glass") return s.solved ? o("Already deciphered. The glyphs still hum.") : o("The lens bends the glass… hidden glyphs read: 'ORDER IS IN THE SATS.' The case unlocks!", "solve");
    if (h === "signatures" && s.exhibitOpen) return o("Through the lens: Iman's address, the same pattern, on both fees. Fourteen years apart.");
    return o("You squint through the lens. Nothing hidden here.");
  }
  switch (h) {
    case "curator":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("A tired curator. Smells faintly of old block headers.");
      if (verb === "pickup") return o("The curator declines to be picked up. Politely.");
      return o("He raises an eyebrow. Try talking instead.");
    case "door":
      if (verb === "open" || verb === "use") return o("", "exit");
      if (verb === "look") return o("The way back to the Oasis. It glows invitingly.");
      return o("It's a door. It does door things.");
    case "genesis":
      if (verb === "look") return o("Block 0. A newspaper headline sealed in orange resin.");
      if (verb === "open") return o("Alarm chirps. The curator glares. Better not.");
      return o("The genesis case is bolted to history.");
    case "pizza":
      if (verb === "look") return o("Two pizzas, 10,000 BTC. Still warm, somehow.");
      if (verb === "pickup") return o("Hands off — that slice is worth a fortune.");
      return o("The pizza ignores you.");
    case "glass":
      if (verb === "look") return s.solved ? o("Glyphs glow: 'ORDER IS IN THE SATS.'") : o("Cloudy glass. Something is etched just below sight. A lens might help.");
      if (verb === "open") return s.solved ? o("The case is open. The glyphs are yours to remember.") : o("Locked tight. The etching must be the key.");
      return o("Fingerprints. Lovely.");
    case "signatures":
      if (!s.exhibitOpen) return o("A red velvet drape. A card: 'Opens when the canonical block is confirmed. — Astral.'");
      if (verb === "look") return o("", "exhibit");
      if (verb === "pickup" || verb === "open") return o("Astral, without turning around: \"Evidence stays under glass.\"");
      return o("Look at it. Each plaque is one piece of the case.");
    case "lens":
      if (verb === "pickup") return s.held.includes("lens") ? o("You already have it.") : o("You pocket the Explorer Lens.", "pickup-lens");
      if (verb === "look") return o("A brass explorer lens on the floor. Someone dropped it.");
      return o("Pick it up first.");
  }
}

/** Night of Two Signatures plaques, in story order; LOOK walks through them. Opens only after CH.12 is solved on the account. */
export const SIGNATURE_PLAQUES: readonly string[] = [
  "I · THE SHARED KEY — Wierdamoto and Bitoshi wrote the first recipe on one key. Block 1138. Two signatures, one fee.",
  "II · THE THIRD ADDRESS — Invest Geek's trace, row 1138: Wierdamoto paid the input, Bitoshi got the change. Iman paid the fee.",
  "III · URBAN'S BLUEPRINT — The real one. Will forged forty thousand copies. Not one matched the Bedrock.",
  "IV · THE BAIT KEY — Bitoshi built it. Wierdamoto watched it. Limitless ran it straight to Iman's rig.",
  "V · THE CANONICAL PROOF — Iman signed the empty bait with his own address. The fork was orphaned. 1138 confirmed.",
  "CURATOR'S NOTE — \"One fee framed them in 1138. One signature framed the framers.\" — Astral",
];
