/**
 * BITERNAM QUESTS — a playable loop on top of the Oasis landmarks.
 * Characters stand at existing landmarks; quests are ordered steps of
 * "talk to" / "visit". Progress is device-local; BIT for a finished quest is
 * paid once per account by the server (claimQuestRewardFn), fixed amounts only.
 */
import { useSyncExternalStore } from "react";
import { LANDMARKS, landmarkSpot } from "./world-landmarks";
import { WORLD_CELL } from "./player-state";
import type { TracyScript } from "./tracy-com";

export type QuestStep = {
  kind: "talk" | "visit" | "pickup" | "give"; target: string; label: string;
  /** Cindy-9 calls in when this step is done */ cindy?: string;
  /** give: the item this character needs handed over (removed from the wrist) */ item?: string;
  /** talk/give: item this character hands you when the step completes */ gives?: string;
  /** the character's own lines for this step (replaces their idle chat while the step is current) */ say?: string[];
  /** give: line when you hand over the wrong thing */ wrong?: string;
};
export type Quest = { id: string; title: string; blurb: string; steps: QuestStep[]; bit: number; badge: string };

/** Wrist inventory items: each floats at a landmark until its pickup step is reached and done. */
export type QuestItem = { id: string; name: string; icon: string; /** where it floats in the world; omitted for items a character hands you */ landmarkId?: string; blurb: string };
export const QUEST_ITEMS: QuestItem[] = [
  { id: "skiff-key", name: "HOVER-SKIFF KEY", icon: "⚿", landmarkId: "trading-post", blurb: "Wierdamoto's skiff. Two years of dust trails on the odometer." },
  { id: "dust-sample", name: "DUST SAMPLE", icon: "✧", landmarkId: "arena", blurb: "Forty thousand tiny outputs in a jar. Blockamoto's calling card." },
  { id: "explorer-lens", name: "EXPLORER LENS", icon: "◉", landmarkId: "tower", blurb: "Shows where a sat really went. The block explorer never lies." },
  { id: "architect-blueprint", name: "MASTER BLUEPRINT", icon: "⌗", landmarkId: "miner-rig-3", blurb: "PROJECT_BITERNAM // REVISION: ∞ // ARCHITECT: URBAN. The coordinate maths for the ground under your boots." },
  // CH.2 · THE GREY PROTOCOL — handed between the heroes
  { id: "press-pass", name: "BITMAP NEWS PRESS PASS", icon: "▣", blurb: "Laminated. Signed by Tornado H. Thompson. Smells faintly of coffee and adrenaline." },
  { id: "cipher-note", name: "DEV9'S CIPHER NOTE", icon: "✉", blurb: "Three txids, one written backwards. 'Find the one who remembers every record.'" },
  { id: "utxo-map", name: "UTXO MAP", icon: "⌖", blurb: "Mononaut's chart. Every arrow ends at the Arena, where the camera never stops rolling." },
  { id: "fork-key", name: "BLOCKAMOTO'S FORK KEY", icon: "⚷", landmarkId: "mayor-pepe", blurb: "Cold, grey, and very centralised. Locked by a shader nobody here wrote." },
  { id: "sky-coords", name: "SKY COORDINATES", icon: "✦", blurb: "Dabber's sketch from the high ground: the grey cloud starts over the western rig." },
  { id: "dusk-frequency", name: "DUSK FREQUENCY", icon: "◐", blurb: "A pink-to-cyan tone in a glass vial. The sound of the Bitmappers coming home." },
  { id: "patched-key", name: "PATCHED FORK KEY", icon: "⚿", blurb: "BOP rewrote it in ten seconds. It now opens the bedrock instead of forking it." },
  { id: "bedrock-seal", name: "BEDROCK SEAL", icon: "⬢", blurb: "Urban's master seal. One-owner ground, stamped into every tile." },
];
export const itemById = (id: string) => QUEST_ITEMS.find((i) => i.id === id) ?? null;

/** Where an item floats: the side of its landmark opposite the character spot. */
export function itemSpot(item: QuestItem) {
  if (!item.landmarkId) return null;
  const spec = LANDMARKS.find((l) => l.id === item.landmarkId);
  if (!spec) return null;
  const s = landmarkSpot(spec);
  const off = spec.span * WORLD_CELL * 0.62;
  return { x: s.x - Math.cos(spec.yaw + Math.PI * 0.5) * off, z: s.z - Math.sin(spec.yaw + Math.PI * 0.5) * off };
}
export const PICKUP_REACH = 0.7; // BITMAPS

/** Items you hold: picked up or handed over in passed steps, minus anything you gave away. */
export function heldItems(p: QuestProgress): QuestItem[] {
  const ids: string[] = [];
  for (const q of QUESTS) q.steps.forEach((s, i) => {
    if (i >= (p.step[q.id] ?? 0)) return;
    if (s.kind === "pickup") ids.push(s.target);
    if (s.kind === "give" && s.item) { const k = ids.lastIndexOf(s.item); if (k >= 0) ids.splice(k, 1); }
    if (s.gives) ids.push(s.gives);
  });
  return [...new Set(ids)].map(itemById).filter((x): x is QuestItem => !!x);
}
/** Items waiting in the world right now (current step of some quest). */
export function pendingItems(p: QuestProgress): QuestItem[] {
  const out: QuestItem[] = [];
  for (const q of QUESTS) { const s = q.steps[p.step[q.id] ?? 0]; if (s?.kind === "pickup") { const it = itemById(s.target); if (it) out.push(it); } }
  return out;
}

export type QuestNpc = {
  id: string;
  name: string;
  landmarkId: string;
  /** retro voice pitch in Hz */
  voice: number;
  /** short persona for the free-question channel */
  persona: string;
  script: TracyScript;
};

export const QUEST_NPCS: QuestNpc[] = ([
  {
    id: "droid", name: "MAINTENANCE DROID", landmarkId: "torii", voice: 140,
    persona: "A rusty maintenance droid who believes it is still November 2012 and guards the Halving gate. Speaks in clipped service-log sentences.",
    script: { id: "npc-droid", title: "TORII GATE · SERVICE LOG", start: "a", nodes: [
      { id: "a", speaker: "MAINTENANCE DROID", mood: "glitch", text: "HALT. DATE CHECK: 28 NOVEMBER 2012. SUBSIDY: 25 BTC. GATE STATUS: SEALED.", choices: [
        { label: "\"It's 2026. There have been more halvings.\"", next: "b" },
        { label: "\"Where is the Genesis Keycard?\"", next: "c" },
      ] },
      { id: "b", speaker: "MAINTENANCE DROID", mood: "alarm", text: "ERROR. CLOCK DRIFT DETECTED. RECOMMEND: CONSULT MUSEUM ARCHIVE FOR PROOF.", next: "c" },
      { id: "c", speaker: "MAINTENANCE DROID", mood: "idle", text: "KEYCARD LOGGED AS 'BORROWED' BY A MASKED VISITOR. LAST SEEN: TRADING POST.", next: null },
    ] },
  },
  {
    id: "curator", name: "MUSEUM CURATOR", landmarkId: "bit-museum", voice: 210,
    persona: "The prim, precise curator of the Bit Museum. Only accepts chain-proven history and politely corrects myths.",
    script: { id: "npc-curator", title: "BIT MUSEUM · ARCHIVE DESK", start: "a", nodes: [
      { id: "a", speaker: "MUSEUM CURATOR", mood: "smug", text: "Welcome. Every exhibit here is a block you can check yourself. Rumours stay outside.", choices: [
        { label: "Ask about the 2015 dust storm", next: "b" },
        { label: "Ask about the Halving gate", next: "c" },
      ] },
      { id: "b", speaker: "MUSEUM CURATOR", mood: "alarm", text: "Block 367,853. Over twelve thousand transactions sweeping dust. The record still stands. Some of it blew out to the Arena.", next: null },
      { id: "c", speaker: "MUSEUM CURATOR", mood: "idle", text: "Block 210,000, the first halving. The droid's clock stopped there. Show it the chain, not your opinions.", next: null },
    ] },
  },
  {
    id: "wierdamoto", name: "WIERDAMOTO", landmarkId: "trading-post", voice: 120,
    persona: "Wierdamoto, a masked theatrical rebel leading The Bitmappers. Dramatic, poetic, distrustful of custodians, loves self-custody.",
    script: { id: "npc-wierdamoto", title: "TRADING POST · BACK ROOM", start: "a", nodes: [
      { id: "a", speaker: "WIERDAMOTO", mood: "smug", text: "Ah. You found the mask before the mask found you. Yes, I have the Genesis Keycard.", choices: [
        { label: "\"Give it back to the droid.\"", next: "b" },
        { label: "\"Who are The Bitmappers?\"", next: "c" },
      ] },
      { id: "c", speaker: "WIERDAMOTO", mood: "idle", text: "Holders who keep their own keys and build on their own blocks. Blockamoto hates us for it.", next: "b" },
      { id: "b", speaker: "WIERDAMOTO", mood: "smug", text: "Take it. A gate that opens for everyone is a gate worth keeping. Remember who handed you the key.", next: null },
    ] },
  },
  {
    id: "sentry", name: "BLOCKAMOTO SENTRY", landmarkId: "tower", voice: 90,
    persona: "A holographic sentry projected by Blockamoto, the villain who wants to centralise the Oasis. Menacing, bureaucratic, secretly insecure.",
    script: { id: "npc-sentry", title: "METAVOXEL TOWER · SENTRY", start: "a", nodes: [
      { id: "a", speaker: "BLOCKAMOTO SENTRY", mood: "alarm", text: "Dust collectors are not permitted in the Tower. Blockamoto has filed you under 'spam'.", choices: [
        { label: "\"The dust is history. It belongs to the museum.\"", next: "b" },
        { label: "\"Tell Blockamoto I said hi.\"", next: "c" },
      ] },
      { id: "c", speaker: "BLOCKAMOTO SENTRY", mood: "glitch", text: "Message queued. Priority: low. Fee: excessive.", next: "b" },
      { id: "b", speaker: "BLOCKAMOTO SENTRY", mood: "glitch", text: "Fine. Fine! Take your dust. This conversation will not be recorded. It is already on chain, isn't it.", next: null },
    ] },
  },
  {
    id: "dev9", name: "DEV9", landmarkId: "bit-cafe", voice: 100,
    persona: "dev9, a veteran developer and former military man. Calm, dry, Bond-like. Trusts only what he can verify on chain; reads raw transactions like intercepted signals.",
    script: { id: "npc-dev9", title: "BIT CAFÉ · CORNER TABLE", start: "a", nodes: [
      { id: "a", speaker: "DEV9", mood: "idle", text: "Sit. Don't order the espresso, it's been in the mempool since 2017. I hear Blockamoto is moving dust again.", choices: [
        { label: "\"How do you know?\"", next: "b" },
        { label: "\"I need a team.\"", next: "c" },
      ] },
      { id: "b", speaker: "DEV9", mood: "smug", text: "Three taproot addresses, big UTXOs, nothing that looks like a sale. Old habit. I read the outputs, not the press release.", next: "c" },
      { id: "c", speaker: "DEV9", mood: "idle", text: "Then go see Tornado at the Tower plaza. If it's news, he's already broadcasting it. Shaken, not double-spent.", next: null },
    ] },
  },
  {
    id: "tornado", name: "TORNADO H. THOMPSON", landmarkId: "bitcoin-statue", voice: 170,
    persona: "Tornado H. Thompson, gonzo anchorman of Bitmap News. Aviator shades, booming broadcast voice, loves a breaking headline, always signs off with the block height.",
    script: { id: "npc-tornado", title: "BITMAP NEWS · LIVE DESK", start: "a", nodes: [
      { id: "a", speaker: "TORNADO H. THOMPSON", mood: "alarm", text: "GOOD EVENING, BITMAPPERS. Breaking tonight: a virus in the park node, a masked marshal on the loose, and fees doing something nobody can explain.", choices: [
        { label: "\"Can you get a message out?\"", next: "b" },
        { label: "\"Any leads?\"", next: "c" },
      ] },
      { id: "b", speaker: "TORNADO H. THOMPSON", mood: "smug", text: "Kid, I go live every block. But the virus is jamming my signal. Find BOP. If anyone can patch a broadcast, it's BOP.", next: null },
      { id: "c", speaker: "TORNADO H. THOMPSON", mood: "idle", text: "Sources say the jam started in the miner rigs. Sources also say BOP knows. I am the sources. Back to you, chain.", next: null },
    ] },
  },
  {
    id: "bop", name: "BOP", landmarkId: "miner-rig-1", voice: 230,
    persona: "BOP, a brilliant, fast-talking programmer. Ships tools overnight, speaks in short bursts of code jargon, makes hard things feel smooth.",
    script: { id: "npc-bop", title: "MINER RIG 1 · TERMINAL", start: "a", nodes: [
      { id: "a", speaker: "BOP", mood: "smug", text: "oh hey. yeah, the virus. it's hooked into the render loop. cute. give me ten seconds.", choices: [
        { label: "\"Ten seconds?\"", next: "b" },
        { label: "\"Can you unjam Bitmap News?\"", next: "b" },
      ] },
      { id: "b", speaker: "BOP", mood: "glitch", text: "done. smooth again. broadcast is up. but the rig it lived on is cooked. you need Urban to rebuild the hardware.", next: null },
    ] },
  },
  {
    id: "urban", name: "URBAN", landmarkId: "miner-rig-3", voice: 150,
    persona: "Urban, the Master Architect who laid the bedrock of the Oasis tile by tile. Pragmatic, dry-witted, ships reality instead of theorising. Knows the world is code and is quietly proud of it.",
    script: { id: "npc-urban", title: "MINER RIG 3 · ARCHITECT'S WORKSHOP", start: "a", nodes: [
      { id: "a", speaker: "URBAN", mood: "idle", text: "BOP fried another rig? Typical. Hand me that wrench. Every block in this park is a part, and every part has a place. I should know. I placed them.", choices: [
        { label: "\"Can you fix it?\"", next: "b" },
        { label: "\"What are you building?\"", next: "c" },
        { label: "\"Is this all just a simulation?\"", next: "egg" },
      ] },
      { id: "c", speaker: "URBAN", mood: "smug", text: "Land you can actually build on. Tools that check the chain before they trust a word. Code keeps the lights on, art gives it a pulse. Someone had to lay the bedrock so none of you fell into the void.", next: "b" },
      { id: "egg", speaker: "URBAN", mood: "glitch", text: "...You noticed the seams. Kid, you have no idea how much maths went into stopping the page zoom from blowing up three-dimensional space. Look behind this rig. Don't tell dev9 I left the master blueprint lying around.", next: "b" },
      { id: "b", speaker: "URBAN", mood: "idle", text: "Fixed and verified. But a working park is no use if nobody comes. Take this to 9 at the Great Statue.", next: null },
    ] },
  },
  {
    id: "dabber", name: "ELEVATED DABBER", landmarkId: "mayor-pepe", voice: 135,
    persona: "Elevated Dabber, the summit visionary of the Bitmappers. Laid-back, endlessly positive, sees every BITMAP from above and blows the FUD away like smoke.",
    script: { id: "npc-dabber", title: "MAYOR PEPE · HIGH GROUND", start: "a", nodes: [
      { id: "a", speaker: "ELEVATED DABBER", mood: "smug", text: "Ayyy, Marshal. Up here you see it all. Every block a tile, every tile a home. Blockamoto only sees spreadsheets.", choices: [
        { label: "\"How do we beat him?\"", next: "b" },
        { label: "\"Nice view.\"", next: "c" },
      ] },
      { id: "c", speaker: "ELEVATED DABBER", mood: "idle", text: "Best view on the chain, friend. Stay elevated. Zoom out far enough and the FUD just turns into weather.", next: "b" },
      { id: "b", speaker: "ELEVATED DABBER", mood: "smug", text: "Easy. We keep building higher than he can tax. Good vibes compound, man. Like blocks.", next: null },
    ] },
  },
  {
    id: "bitlodo", name: "BITLODO", landmarkId: "arena", voice: 200,
    persona: "Bitlodo, the cinema maestro of the Oasis and maker of the Clips studio. Thinks in shots and frames, directs every fight like a movie, talks like a film director on set.",
    script: { id: "npc-bitlodo", title: "THE ARENA · DIRECTOR'S CHAIR", start: "a", nodes: [
      { id: "a", speaker: "BITLODO", mood: "smug", text: "Cut! You walked straight through my shot. No, wait, keep walking. That's good. That's the story.", choices: [
        { label: "\"What are you filming?\"", next: "b" },
        { label: "\"Can you film Blockamoto?\"", next: "c" },
      ] },
      { id: "b", speaker: "BITLODO", mood: "idle", text: "Everything that happens on chain deserves a trailer. Raids, landings, first builds. Frame by frame, forever.", next: null },
      { id: "c", speaker: "BITLODO", mood: "alarm", text: "Already rolling. Villains always forget the camera. That's the third act, Marshal. Action!", next: null },
    ] },
  },
  {
    id: "mononaut", name: "MONONAUT", landmarkId: "miner-rig-2", voice: 115,
    persona: "Mononaut, the mempool cartographer. A quiet forensic detective who remembers every record block and can tell a real sale from a custodial sweep at a glance.",
    script: { id: "npc-mononaut", title: "MINER RIG 2 · MEMPOOL CHARTS", start: "a", nodes: [
      { id: "a", speaker: "MONONAUT", mood: "idle", text: "Block 972,161. Seven thousand nine hundred twenty-nine transactions. Still not the record. Block 367,853 holds that: twelve thousand two hundred thirty-nine.", choices: [
        { label: "\"Who made that record?\"", next: "b" },
        { label: "\"Is Blockamoto faking sales?\"", next: "c" },
      ] },
      { id: "b", speaker: "MONONAUT", mood: "smug", text: "2015 dust cleanup. Someone swept the floor of the whole chain. The curator calls it a storm. I call it a Tuesday.", next: null },
      { id: "c", speaker: "MONONAUT", mood: "alarm", text: "One input, change back to the sender. That's not a sale, that's a sweep. Charts don't lie. People do.", next: null },
    ] },
  },
  {
    id: "sunset", name: "BITMAP SUNSET", landmarkId: "miner-rig-4", voice: 180,
    persona: "Bitmap Sunset, the atmosphere architect. A dreamy synthwave poet who paints the sky over every block and keeps the frequencies calm.",
    script: { id: "npc-sunset", title: "WESTERN LOOKOUT · GOLDEN HOUR", start: "a", nodes: [
      { id: "a", speaker: "BITMAP SUNSET", mood: "idle", text: "Shh. Watch the horizon. Every ten minutes the sky gets a new block, and every block gets a new colour.", choices: [
        { label: "\"Why paint the sky?\"", next: "b" },
        { label: "\"Blockamoto wants it grey.\"", next: "c" },
      ] },
      { id: "b", speaker: "BITMAP SUNSET", mood: "smug", text: "Because land without light is just a ledger. Pink at dusk, cyan at dawn. That's how the Bitmappers know they're home.", next: null },
      { id: "c", speaker: "BITMAP SUNSET", mood: "alarm", text: "He can't. The sun sets on its own schedule. Like difficulty adjustments. Nobody votes on it.", next: null },
    ] },
  },
  {
    id: "nine", name: "9", landmarkId: "great-bitcoin-statue", voice: 190,
    persona: "9, the culture leader of the Bitmappers. Warm, visionary, speaks about community and art. Gathers people and gives the park its soul.",
    script: { id: "npc-nine", title: "GREAT STATUE · GATHERING", start: "a", nodes: [
      { id: "a", speaker: "9", mood: "idle", text: "You came. Good. Code keeps the park running, but people keep it alive. The Bitmappers are scattered and scared.", choices: [
        { label: "\"What do they need?\"", next: "b" },
        { label: "\"Blockamoto wants them divided.\"", next: "b" },
      ] },
      { id: "b", speaker: "9", mood: "smug", text: "A reason to gather. Tornado broadcasts, we light the statue, everyone comes home. Tell dev9 the crew is ready.", next: null },
    ] },
  },
] as QuestNpc[]).filter((n) => LANDMARKS.some((l) => l.id === n.landmarkId));

/** The Biternam crew — shown as a cast list on /biternam. */
export const BITERNAM_CREW = [
  { id: "wierdamoto", name: "WIERDAMOTO", role: "Masked rebel leader", line: "Theatrical keeper of self-custody. Every sat belongs to its holder." },
  { id: "dev9", name: "DEV9", role: "The veteran", line: "Old dev, ex-military, reads raw transactions like intercepted signals." },
  { id: "bop", name: "BOP", role: "The programmer", line: "Ships overnight. Makes hard things feel smooth." },
  { id: "nine", name: "9", role: "Culture leader", line: "Gathers the Bitmappers and gives the park its soul." },
  { id: "tornado", name: "TORNADO H. THOMPSON", role: "Gonzo anchor of Bitmap News", line: "Goes live every block. Signs off with the height." },
  { id: "dabber", name: "ELEVATED DABBER", role: "Summit visionary", line: "Sees every BITMAP from above and blows the FUD away like smoke." },
  { id: "bitlodo", name: "BITLODO", role: "Cinema maestro", line: "Directs every raid like a movie. Frame by frame, forever." },
  { id: "mononaut", name: "MONONAUT", role: "Mempool cartographer", line: "Remembers every record block. Tells a sale from a sweep at a glance." },
  { id: "sunset", name: "BITMAP SUNSET", role: "Atmosphere architect", line: "Paints the sky over every block and keeps the frequencies calm." },
  { id: "urban", name: "URBAN", role: "Master architect", line: "Laid the bedrock tile by tile. Rumour says there is a blueprint behind his rig." },
] as { id: string; name: string; role: string; line: string; mission?: string }[];
/** What each hero does in CH.2 · THE GREY PROTOCOL. */
export const CREW_MISSION_ROLE: Record<string, string> = {
  tornado: "Breaks the story and makes you press.",
  dev9: "Checks your credentials, hands over a cipher.",
  mononaut: "Decodes the cipher into a UTXO map.",
  bitlodo: "Finds on camera where Blockamoto buried the key.",
  dabber: "Spots from the high ground where the grey begins.",
  sunset: "Turns the sky reading into the Dusk Frequency.",
  bop: "Cracks the Fork Key in ten seconds.",
  urban: "Forges the Bedrock Seal from the patched key.",
  nine: "Rings the Dusk Frequency to gather everyone.",
  wierdamoto: "Takes the seal and ends the Grey Protocol.",
};


export const QUESTS: Quest[] = [
  {
    id: "ch1", title: "CH.1 · THE LAW AROUND HERE", bit: 40, badge: "MARSHAL",
    blurb: "Blockamoto is dusting the park again. Get your skiff, collect the evidence and report at the gate.",
    steps: [
      { kind: "pickup", target: "skiff-key", label: "Find your hover-skiff key at the Trading Post", cindy: "Key's in your pocket, Marshal. Try not to park the skiff on a monument this time." },
      { kind: "talk", target: "curator", label: "Ask the curator about the dust storm", cindy: "Block 367,853. Twelve thousand transactions. That's not weather, that's a signature." },
      { kind: "pickup", target: "dust-sample", label: "Collect a dust sample in the Arena", cindy: "Bagged it. Don't sneeze. That jar is worth more in fees than it is in sats." },
      { kind: "pickup", target: "explorer-lens", label: "Recover the explorer lens at the Metavoxel Tower", cindy: "The lens! Now we can follow the sat instead of the rumours." },
      { kind: "visit", target: "torii", label: "Report at the Torii Gate", cindy: "Evidence logged. Blockamoto knows you're here now. Welcome to BITERNAM, Inspector." },
    ],
  },
  {
    id: "q1", title: "THE FIRST HALVING LOCKOUT", bit: 30, badge: "GATEKEEPER",
    blurb: "The Torii gate thinks it is 2012. Find the Genesis Keycard and wake it up.",
    steps: [
      { kind: "talk", target: "droid", label: "Talk to the droid at the Torii Gate" },
      { kind: "talk", target: "curator", label: "Ask the curator in the Bit Museum" },
      { kind: "talk", target: "wierdamoto", label: "Find the masked visitor at the Trading Post" },
      { kind: "talk", target: "droid", label: "Return the keycard to the droid" },
    ],
  },
  {
    id: "q2", title: "DUST IN THE WIND", bit: 40, badge: "DUST SWEEPER",
    blurb: "Recover the 2015 dust storm record before Blockamoto deletes it.",
    steps: [
      { kind: "talk", target: "curator", label: "Hear the story at the Bit Museum" },
      { kind: "visit", target: "arena", label: "Search the Arena for blown dust" },
      { kind: "talk", target: "sentry", label: "Face the sentry at the Metavoxel Tower" },
      { kind: "visit", target: "bit-museum", label: "Bring the record home to the Museum" },
    ],
  },
  {
    id: "q3", title: "ASSEMBLE THE CREW", bit: 50, badge: "CREW CALL",
    blurb: "dev9 needs a team. Gather the Bitmap News anchor, the programmer, the engineer and the culture leader.",
    steps: [
      { kind: "talk", target: "dev9", label: "Meet dev9 at the Bit Café" },
      { kind: "talk", target: "tornado", label: "Find Tornado at the Bitcoin Statue" },
      { kind: "talk", target: "bop", label: "Ask BOP to unjam the broadcast at Miner Rig 1" },
      { kind: "talk", target: "urban", label: "Get Urban to rebuild the rig at Miner Rig 3" },
      { kind: "talk", target: "nine", label: "Rally the Bitmappers with 9 at the Great Statue" },
      { kind: "talk", target: "dev9", label: "Report back to dev9" },
    ],
  },
  {
    id: "ch2", title: "CH.2 · THE GREY PROTOCOL", bit: 100, badge: "BITMAPPER",
    blurb: "Blockamoto plans to fork the bedrock and grey out the sky. It takes all ten Bitmappers to stop him.",
    steps: [
      { kind: "talk", target: "tornado", gives: "press-pass", label: "Catch the breaking story at Satoshi's Statue",
        say: ["BREAKING, MARSHAL. Blockamoto just bought every billboard in the Oasis. They all say the same thing: GREY IS THE NEW ORANGE.", "My sources won't talk to strangers. The best source in this park drinks bad espresso and trusts nobody without credentials. Here. You're press now."],
        cindy: "A press pass. dev9 at the Bit Café checks credentials before he even says hello." },
      { kind: "give", target: "dev9", item: "press-pass", gives: "cipher-note", label: "Show the right credentials to the man in the café",
        say: ["You again. I don't talk to tourists. Show me why I should."], wrong: "That's not credentials, that's clutter. Try again, Marshal.",
        cindy: "A cipher with one txid written backwards. Someone who remembers every record could read it. Mononaut charts the mempool at the mining yard." },
      { kind: "give", target: "mononaut", item: "cipher-note", gives: "utxo-map", label: "Find someone who reads txids like weather",
        say: ["Charts don't lie. Hand me whatever you're holding that has numbers on it."], wrong: "No numbers on that. I need the txids.",
        cindy: "Every arrow on Mononaut's map ends at the Arena. A camera there never stops rolling." },
      { kind: "give", target: "bitlodo", item: "utxo-map", label: "Ask the director what his camera saw",
        say: ["Quiet on set! You've got something for my storyboard?"], wrong: "Lovely prop, wrong scene. I need to know where to point the lens.",
        cindy: "Bitlodo's footage: Blockamoto buried something at the feet of the tallest statue on the map. That's Mayor Pepe." },
      { kind: "pickup", target: "fork-key", label: "Dig at the feet of the tallest statue",
        cindy: "The Fork Key. It's locked with a shader nobody here wrote. Before you go anywhere, get a view from higher ground." },
      { kind: "talk", target: "dabber", gives: "sky-coords", label: "Get the view from the high ground",
        say: ["Whoa, you dug that up right under my feet? Respect.", "From up here I can see where the grey starts. Way out west, over the lonely rig. Wrote it down for you, friend."],
        cindy: "Out west, at the lonely rig. Bitmap Sunset watches the horizon there." },
      { kind: "give", target: "sunset", item: "sky-coords", gives: "dusk-frequency", label: "Bring the sky reading to the one who paints it",
        say: ["The horizon feels wrong tonight. Do you have a reading? Something from up high?"], wrong: "That doesn't come from the sky, darling.",
        cindy: "The Dusk Frequency. Hold on to it, someone will need it to call everyone home. Now get that key cracked. BOP is at Miner Rig 1." },
      { kind: "give", target: "bop", item: "fork-key", gives: "patched-key", label: "Have the programmer crack the locked thing",
        say: ["ok what've you got. something locked? hand it over."], wrong: "nice, but that's not locked. give me the locked thing.",
        cindy: "Patched. The key opens the bedrock now. Urban at Miner Rig 3 is the only one who can seal it." },
      { kind: "give", target: "urban", item: "patched-key", gives: "bedrock-seal", label: "Seal the ground with the one who laid it",
        say: ["Blockamoto tried to fork my bedrock? With what, a grey crayon? Give me the key."], wrong: "That's not a key. I build with keys, kid.",
        cindy: "The Bedrock Seal. One owner per tile, forever. Now the people need to hear it. 9 is at the Great Statue." },
      { kind: "give", target: "nine", item: "dusk-frequency", label: "Give the culture leader a sound to gather everyone",
        say: ["The Bitmappers are scattered. I need something they'll all recognise. A sound. A colour."], wrong: "Beautiful, but nobody gathers for that.",
        cindy: "The statue is ringing pink and cyan. Everyone is coming home. Take the seal to Wierdamoto at the Trading Post." },
      { kind: "give", target: "wierdamoto", item: "bedrock-seal", label: "Hand the seal to the mask at the Trading Post",
        say: ["So. The grey protocol. Ten of us against one man with billboards. Show me what we built."], wrong: "A fine trinket. Not a revolution.",
        cindy: "The billboards are going orange again. Blockamoto's fork failed. Ten heroes, one ground. Welcome to the Bitmappers, Marshal." },
    ],
  },
  {
    id: "egg-architect", title: "THE ARCHITECT'S SEAL", bit: 77, badge: "ARCHITECT'S SEAL",
    blurb: "Some say the world was drawn by hand. Ask the engineer the question nobody asks.",
    steps: [
      { kind: "talk", target: "urban", label: "Ask Urban an uncomfortable question at Miner Rig 3" },
      { kind: "pickup", target: "architect-blueprint", label: "Find what he left behind the rig", cindy: "Marshal... that's the master blueprint. Revision infinity. Don't drop it, he's the only one who can rewrite the collision matrix." },
    ],
  },
];

/** The current mission step a character is waiting on, if any (talk/give with their own lines). */
export function missionStepFor(npcId: string, p: QuestProgress): { quest: Quest; step: QuestStep } | null {
  for (const quest of QUESTS) {
    const step = quest.steps[p.step[quest.id] ?? 0];
    if (step && step.target === npcId && step.say?.length && (step.kind === "talk" || step.kind === "give")) return { quest, step };
  }
  return null;
}

/** Builds the call for a mission step; for a give step the last line offers every held item. "ok" = right item. */
export function missionScript(npc: QuestNpc, step: QuestStep, held: QuestItem[]): TracyScript {
  const say = step.say ?? [];
  const nodes: TracyScript["nodes"] = say.map((text, i) => ({ id: `s${i}`, speaker: npc.name, mood: "idle" as const, text, next: i < say.length - 1 ? `s${i + 1}` : null }));
  if (step.kind === "give") {
    const last = nodes[nodes.length - 1]!;
    delete last.next;
    last.choices = [
      ...held.map((it) => ({ label: `Hand over: ${it.name}`, next: it.id === step.item ? "ok" : "no" })),
      { label: "\"I don't have it yet.\"", next: "later" },
    ];
    nodes.push(
      { id: "ok", speaker: npc.name, mood: "smug", text: "That's the one. Good work, Marshal.", next: null },
      { id: "no", speaker: npc.name, mood: "alarm", text: step.wrong ?? "Not that.", next: null },
      { id: "later", speaker: npc.name, mood: "idle", text: "Then come back when you do.", next: null },
    );
  }
  return { id: `mission-${npc.id}`, title: `${npc.name} · MISSION`, start: "s0", nodes };
}

export const NPC_REACH = 0.9; // BITMAPS
export const VISIT_REACH = 1.6;

export const npcById = (id: string) => QUEST_NPCS.find((n) => n.id === id) ?? null;

/** Canonical key for a step, checked by the server against the quest definition. */
export const stepKey = (s: QuestStep) => `${s.kind}:${s.kind === "give" ? `${s.target}>${s.item}` : s.target}`;

/** Where a character stands: just in front of its landmark, facing the plaza. */
export function npcSpot(npc: QuestNpc) {
  const spec = LANDMARKS.find((l) => l.id === npc.landmarkId)!;
  const s = landmarkSpot(spec);
  const off = spec.span * WORLD_CELL * 0.62;
  return { x: s.x + Math.cos(spec.yaw + Math.PI * 0.5) * off, z: s.z + Math.sin(spec.yaw + Math.PI * 0.5) * off, yaw: spec.yaw };
}

export function nearestNpc(x: number, z: number): QuestNpc | null {
  let best: QuestNpc | null = null;
  let bd = NPC_REACH * WORLD_CELL;
  for (const n of QUEST_NPCS) {
    const p = npcSpot(n);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= bd) { bd = d; best = n; }
  }
  return best;
}

export function landmarkInReach(x: number, z: number): string | null {
  for (const l of LANDMARKS) {
    const p = landmarkSpot(l);
    if (Math.hypot(p.x - x, p.z - z) <= VISIT_REACH * WORLD_CELL) return l.id;
  }
  return null;
}

/* ---------- progress: pure reducer + device store ---------- */

export type QuestProgress = { step: Record<string, number>; claimed: string[] };
export const blankProgress = (): QuestProgress => ({ step: {}, claimed: [] });

export const isComplete = (q: Quest, p: QuestProgress) => (p.step[q.id] ?? 0) >= q.steps.length;

/** Pure: reset one quest to step 0, keeping every claim and every other quest's progress. */
export function replayQuest(p: QuestProgress, id: string): QuestProgress {
  const step = { ...p.step };
  delete step[id];
  return { ...p, step };
}

/** Advance every quest whose current step matches the event. Steps only go forward. */
export function applyEvent(p: QuestProgress, kind: QuestStep["kind"], target: string): { next: QuestProgress; advanced: Quest[] } {
  const step = { ...p.step };
  const advanced: Quest[] = [];
  for (const q of QUESTS) {
    const i = step[q.id] ?? 0;
    const s = q.steps[i];
    const key = s?.kind === "give" ? `${s.target}>${s.item}` : s?.target;
    if (s && s.kind === kind && key === target) { step[q.id] = i + 1; advanced.push(q); }
  }
  return { next: advanced.length ? { ...p, step } : p, advanced };
}

const KEY = "bitmapwin:biternam-quests";
let state: QuestProgress | null = null;
let near: string | null = null;
const listeners = new Set<() => void>();
const advListeners = new Set<(q: Quest, done: boolean, step: QuestStep) => void>();
const emit = () => listeners.forEach((f) => f());

function load(): QuestProgress {
  if (state) return state;
  try { state = { ...blankProgress(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { state = blankProgress(); }
  return state!;
}
function save(p: QuestProgress) {
  state = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full — progress stays for the session */ }
  emit();
}

const BLANK = blankProgress();
export const questStore = {
  get: () => (typeof window === "undefined" ? BLANK : load()),
  near: () => near,
  setNear(id: string | null) { if (id !== near) { near = id; emit(); } },
  record(kind: QuestStep["kind"], target: string) {
    const { next, advanced } = applyEvent(load(), kind, target);
    if (!advanced.length) return;
    save(next);
    advanced.forEach((q) => { const st = q.steps[(next.step[q.id] ?? 1) - 1]!; advListeners.forEach((f) => f(q, isComplete(q, next), st)); });
  },
  markClaimed(id: string) { const p = load(); if (!p.claimed.includes(id)) save({ ...p, claimed: [...p.claimed, id] }); },
  /** Restart one quest's steps so they can be re-recorded while signed in; claimed rewards and other quests stay. */
  replay(id: string) { save(replayQuest(load(), id)); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  onAdvance(fn: (q: Quest, done: boolean, step: QuestStep) => void) { advListeners.add(fn); return () => { advListeners.delete(fn); }; },
};

export function useQuestState() {
  const progress = useSyncExternalStore(questStore.subscribe, questStore.get, () => BLANK);
  const nearId = useSyncExternalStore(questStore.subscribe, questStore.near, () => null);
  return { progress, nearId };
}
