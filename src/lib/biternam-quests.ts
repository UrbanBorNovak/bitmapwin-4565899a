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
  /** only completes inside this interior route; in the Oasis the character just points you there */ indoors?: string;
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
  { id: "hazmat-suit", name: "HAZMAT SUIT", icon: "☢", blurb: "Yellow, crinkly, stencilled VISITORS · NO EXCEPTIONS. Bitoshi's one house rule." },
  { id: "blue-sample", name: "BLUE OP_RETURN SAMPLE", icon: "◆", blurb: "Bitoshi's 99.1% pure block matter. No custodial sweep can fake this signature." },
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
  /** -1 stands on the far side of the landmark, so two characters can share one */
  side?: number;
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
    id: "curator", name: "ASTRAL · CURATOR", landmarkId: "bit-museum", voice: 210,
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
  {
    id: "bitoshi", name: "BITOSHI", landmarkId: "miner-rig-4", voice: 150,
    persona: "Bitoshi, the cook who broke bad. A once-revered script engineer cooking pure block matter in an RV out past the western rig. Paranoid, brilliant, obsessed with purity.",
    script: { id: "npc-bitoshi", title: "SALT FLAT RV · THE COOK", start: "a", nodes: [
      { id: "a", speaker: "BITOSHI", mood: "alarm", text: "STAY OUT OF MY MEMPOOL. You smell like a custodial wallet.", choices: [
        { label: "\"What are you cooking?\"", next: "b" },
        { label: "\"dev9 sent me.\"", next: "c" },
      ] },
      { id: "b", speaker: "BITOSHI", mood: "smug", text: "Ninety-nine point one percent pure. Zero dust. Batch-efficient. Tourists get Turdinals. I make Tordinals.", next: null },
      { id: "c", speaker: "BITOSHI", mood: "idle", text: "dev9. Unreasonable man. Respect him. Doesn't mean I trust you.", next: null },
    ] },
  },
  {
    id: "jahbooble", name: "JAHBOOBLE", landmarkId: "torii", voice: 160,
    persona: "jahbooble, a devoted Bitmapper and gatekeeper of good vibes. Knows every newcomer by block and greets them like family.",
    script: { id: "npc-jahbooble", title: "TORII GATE · WELCOME POST", start: "a", nodes: [
      { id: "a", speaker: "JAHBOOBLE", mood: "smug", text: "Bless up, Marshal. Another soul through the gate. Every block you claim is a seat at the table.", choices: [
        { label: "\"What makes a real Bitmapper?\"", next: "b" },
      ] },
      { id: "b", speaker: "JAHBOOBLE", mood: "idle", text: "Hold your own keys, build on your own block, and show up when the crew calls. Unreasonable, every one of us.", next: null },
    ] },
  },
  {
    id: "mr-shiddy", name: "MR SHIDDY", landmarkId: "bit-museum", voice: 125,
    persona: "Mr Shiddy, Bitmapper and engineer. Blunt, hands-on, fixes anything with a soldering iron and a straight face.",
    script: { id: "npc-mr-shiddy", title: "BIT MUSEUM · SERVICE HATCH", start: "a", nodes: [
      { id: "a", speaker: "MR SHIDDY", mood: "idle", text: "Don't touch that panel. It's load-bearing. Everything here is load-bearing if you engineer it right.", choices: [
        { label: "\"What are you fixing?\"", next: "b" },
      ] },
      { id: "b", speaker: "MR SHIDDY", mood: "smug", text: "The parts Blockamoto said couldn't be fixed. Engineering is just refusing to accept 'unreasonable' as an answer.", next: null },
    ] },
  },
  {
    id: "space-monnkey", name: "SPACE MONNKEY", landmarkId: "tower", voice: 240,
    persona: "Space Monnkey, an insane graphic designer. Hyperactive, sees colour palettes in block hashes, turns every surface into art.",
    script: { id: "npc-space-monnkey", title: "METAVOXEL TOWER · ROOFTOP STUDIO", start: "a", nodes: [
      { id: "a", speaker: "SPACE MONNKEY", mood: "glitch", text: "OOK OOK! Don't move. Your silhouette against this hash is PERFECT. Hex 0xF7931A, pure orange chaos.", choices: [
        { label: "\"Are you okay?\"", next: "b" },
      ] },
      { id: "b", speaker: "SPACE MONNKEY", mood: "smug", text: "Never. Okay is grey. Grey is Blockamoto. I paint at escape velocity.", next: null },
    ] },
  },
  {
    id: "dudeamoto", name: "DUDEAMOTO", landmarkId: "arena", voice: 140,
    persona: "Dudeamoto, a laid-back Bitmapper legend. Speaks slowly, abides, and somehow always knows where the best block is.",
    script: { id: "npc-dudeamoto", title: "THE ARENA · BLEACHERS", start: "a", nodes: [
      { id: "a", speaker: "DUDEAMOTO", mood: "idle", text: "Yeah, well, that's just like, your fee estimate, man.", choices: [
        { label: "\"Any advice?\"", next: "b" },
      ] },
      { id: "b", speaker: "DUDEAMOTO", mood: "smug", text: "The block abides. Hold your BITMAP, stay chill, let the halvings come to you.", next: null },
    ] },
  },
  {
    id: "ladybird", name: "LADYBIRD", landmarkId: "bitcoin-statue", voice: 300,
    persona: "Ladybird, a Bitmapper who flits between blocks spotting good luck. Bright, quick, never lands on a fake.",
    script: { id: "npc-ladybird", title: "SATOSHI'S STATUE · LUCKY SPOT", start: "a", nodes: [
      { id: "a", speaker: "LADYBIRD", mood: "smug", text: "Seven spots, seven confirmations. I only land on blocks that are real, Marshal.", choices: [
        { label: "\"How do you tell?\"", next: "b" },
      ] },
      { id: "b", speaker: "LADYBIRD", mood: "idle", text: "Follow the sat, not the noise. Fakes smell like grey. Real BITMAPs feel warm under your feet.", next: null },
    ] },
  },
  {
    // Fictional parody guest — not the real person; no real quotes, views or endorsement implied.
    id: "bukele", name: "PRESIDENTE B.", landmarkId: "great-bitcoin-statue", side: -1, voice: 120,
    persona: "Presidente B., a fictional guest from the Volcano Republic of Biternam. Parody character wearing the BukeleOG pixel skin; not the real person.",
    script: { id: "npc-bukele", title: "GREAT STATUE · STATE VISIT (PARODY)", start: "a", nodes: [
      { id: "a", speaker: "PRESIDENTE B.", mood: "smug", text: "Welcome, Marshal. In my Volcano Republic, every block is legal tender and every lava flow mines a sat.", choices: [
        { label: "\"Are you the real one?\"", next: "b" },
        { label: "\"Volcano mining?\"", next: "c" },
      ] },
      { id: "b", speaker: "PRESIDENTE B.", mood: "idle", text: "Fiction, friend. A guest skin in a parody world. The only thing real here is the chain.", next: null },
      { id: "c", speaker: "PRESIDENTE B.", mood: "smug", text: "Geothermal hash, cooled by sea breeze. Tornado wants an interview. I said: next block.", next: null },
    ] },
  },
  {
    // Fictional parody guest — not the real person; no real quotes, views or endorsement implied.
    id: "putin-x", name: "PUTIN X", landmarkId: "trading-post", side: -1, voice: 85,
    persona: "Putin X, a fictional parody guest wearing the Putin X pixel skin. A stone-faced trader of cold storage; not the real person.",
    script: { id: "npc-putin-x", title: "TRADING POST · COLD STORAGE (PARODY)", start: "a", nodes: [
      { id: "a", speaker: "PUTIN X", mood: "idle", text: "Marshal. In the far north we keep our sats like our winters: deep, cold and very long.", choices: [
        { label: "\"Are you the real one?\"", next: "b" },
        { label: "\"What are you trading?\"", next: "c" },
      ] },
      { id: "b", speaker: "PUTIN X", mood: "smug", text: "Nyet. Fictional guest skin in a parody world. Only the chain is real here.", next: null },
      { id: "c", speaker: "PUTIN X", mood: "smug", text: "Nothing. I only hold. Wierdamoto respects this. Blockamoto does not.", next: null },
    ] },
  },
  {
    // Fictional parody guest — not the real person; no real quotes, views or endorsement implied.
    id: "elon-x", name: "ELON X", landmarkId: "miner-rig-1", side: -1, voice: 210,
    persona: "Elon X, a fictional parody guest wearing the Elon X pixel skin. Wants to launch a BITMAP to orbit; not the real person.",
    script: { id: "npc-elon-x", title: "MINER RIG 1 · LAUNCH PAD (PARODY)", start: "a", nodes: [
      { id: "a", speaker: "ELON X", mood: "glitch", text: "Marshal! What if we put a BITMAP on a rocket? Block height... literally.", choices: [
        { label: "\"Are you the real one?\"", next: "b" },
        { label: "\"Can BOP code it?\"", next: "c" },
      ] },
      { id: "b", speaker: "ELON X", mood: "smug", text: "Parody, friend. A guest skin in a fictional world. Ask the chain what's real.", next: null },
      { id: "c", speaker: "ELON X", mood: "smug", text: "He already boptimized the launch script. Ships next block. Probably.", next: null },
    ] },
  },
  {
    id: "batman", name: "BATMAN", landmarkId: "tower", side: -1, voice: 95,
    persona: "Batman, a guest wearing the Batman pixel skin. Watches the tower at night and respects dev9's cave.",
    script: { id: "npc-batman", title: "TOWER \u00b7 NIGHT WATCH", start: "a", nodes: [
      { id: "a", speaker: "BATMAN", mood: "idle", text: "Marshal. dev9 built a cave. I approve. Every hero needs a basement and a grudge.", next: "b" },
      { id: "b", speaker: "BATMAN", mood: "smug", text: "I don't sign. I don't broadcast. I watch the mempool from rooftops.", next: "c" },
      { id: "c", speaker: "BATMAN", mood: "alarm", text: "Two shadows have been moving through the Void at night. IMAN and WILL. Stay sharp.", next: null },
    ] },
  },
  {
    id: "deadpool", name: "DEADPOOL", landmarkId: "arena", side: -1, voice: 220,
    persona: "Deadpool, a guest wearing the Deadpool pixel skin. Knows he is in a 90s point-and-click game and won't stop saying so.",
    script: { id: "npc-deadpool", title: "ARENA \u00b7 FOURTH WALL", start: "a", nodes: [
      { id: "a", speaker: "DEADPOOL", mood: "idle", text: "Hey! You! Yes, you clicking me. Love the verb bar. Very 1992.", next: "b" },
      { id: "b", speaker: "DEADPOOL", mood: "smug", text: "I tried to buy a BITMAP with chimichangas. The PSBT didn't validate.", next: "c" },
      { id: "c", speaker: "DEADPOOL", mood: "alarm", text: "Pro tip: the villains are IMAN and WILL. The writer hasn't picked their skins yet. Awkward.", next: null },
    ] },
  },
  {
    // Fictional parody guest — not the real person; no real quotes, views or endorsement implied.
    id: "donald-x", name: "DONALD T.", landmarkId: "bitcoin-statue", side: -1, voice: 130,
    persona: "Donald T., a fictional parody guest wearing the Donald Trump pixel skin. Not the real person.",
    script: { id: "npc-donald-x", title: "STATUE \u00b7 PARODY PRESSER", start: "a", nodes: [
      { id: "a", speaker: "DONALD T.", mood: "idle", text: "Tremendous statue. The best statue. Many people are saying it's the biggest block.", next: "b" },
      { id: "b", speaker: "DONALD T.", mood: "smug", text: "Parody, folks. Fictional guest skin in a fictional world. Only the chain is real.", next: "c" },
      { id: "c", speaker: "DONALD T.", mood: "alarm", text: "We're going to build a wall... of confirmed blocks. And the Void is going to pay for it.", next: null },
    ] },
  },
  {
    id: "kane-mayfield", name: "KANE MAYFIELD", landmarkId: "bit-museum", side: -1, voice: 145,
    persona: "Kane Mayfield, a Bitmapper wearing his own pixel skin. Lyricist of the district; writes verses on block heights.",
    script: { id: "npc-kane-mayfield", title: "MUSEUM STEPS \u00b7 SPOKEN WORD", start: "a", nodes: [
      { id: "a", speaker: "KANE MAYFIELD", mood: "idle", text: "Every block has a rhythm. Eight-forty thousand had a bassline.", next: "b" },
      { id: "b", speaker: "KANE MAYFIELD", mood: "smug", text: "I write bars on BITMAPs. Nobody can edit them. That's real permanence.", next: "c" },
      { id: "c", speaker: "KANE MAYFIELD", mood: "alarm", text: "The ghost of 1138 hums the same four notes. Someone taught him. Find out who.", next: null },
    ] },
  },
  {
    // Fictional parody guest — not the real person; no real quotes, views or endorsement implied.
    id: "snoop-x", name: "SNOOP D.", landmarkId: "bit-cafe", side: -1, voice: 105,
    persona: "Snoop D., a fictional parody guest wearing the Snoop Dogg pixel skin, chilling outside the Bit-Caf\u00e9 with Dabber. Not the real person.",
    script: { id: "npc-snoop-x", title: "BIT-CAF\u00c9 PATIO \u00b7 PARODY", start: "a", nodes: [
      { id: "a", speaker: "SNOOP D.", mood: "idle", text: "Fo shizzle, Marshal. Dabber got the booth, I got the patio. Everybody eatin'.", next: "b" },
      { id: "b", speaker: "SNOOP D.", mood: "smug", text: "Parody, nephew. Fictional guest in a fictional world. The chain keeps it real.", next: "c" },
      { id: "c", speaker: "SNOOP D.", mood: "alarm", text: "Low fees, slow blocks, smooth vibes. Stay off them unconfirmed streets at night.", next: null },
    ] },
  },
  {
    id: "kodro", name: "KODRO", landmarkId: "miner-rig-3", side: -1, voice: 160,
    persona: "Kodro, a Bitmapper wearing his own pixel skin. Keeps Urban's decoy blueprint rig running and never asks why.",
    script: { id: "npc-kodro", title: "RIG 3 \u00b7 NIGHT SHIFT", start: "a", nodes: [
      { id: "a", speaker: "KODRO", mood: "idle", text: "Kodro. I keep Rig 3 warm while Urban sleeps on his island.", next: "b" },
      { id: "b", speaker: "KODRO", mood: "smug", text: "Blueprint behind this rig? Decoy. Urban told me. I still dust it every block.", next: "c" },
      { id: "c", speaker: "KODRO", mood: "alarm", text: "IMAN tried to buy the rig last night. Paid in unconfirmed sats. I said no.", next: null },
    ] },
  },
  {
    // Villain of the Void arc.
    id: "iman", name: "IMAN", landmarkId: "miner-rig-2", side: -1, voice: 70,
    persona: "IMAN, a villain of the Void arc. Tries to re-route orphaned blocks for profit. Wears the DeWayn NextHustle pixel skin.",
    script: { id: "npc-iman", title: "RIG 2 \u00b7 SHADOW (VILLAIN)", start: "a", nodes: [
      { id: "a", speaker: "IMAN", mood: "idle", text: "You again. The Marshal who opens doors that should stay shut.", next: "b" },
      { id: "b", speaker: "IMAN", mood: "smug", text: "1138 wasn't an accident. Orphans are inventory. I re-route them.", next: "c" },
      { id: "c", speaker: "IMAN", mood: "alarm", text: "Tell dev9 his log is incomplete. WILL and I wrote the missing pages.", next: null },
    ] },
  },
  {
    // Villain of the Void arc.
    id: "will", name: "WILL", landmarkId: "mayor-pepe", side: -1, voice: 60,
    persona: "WILL, a villain of the Void arc and IMAN's partner. Forges fake confirmations. Wears the Bitcoin Dude pixel skin.",
    script: { id: "npc-will", title: "MAYOR'S STEPS \u00b7 SHADOW (VILLAIN)", start: "a", nodes: [
      { id: "a", speaker: "WILL", mood: "idle", text: "Shh. The mayor thinks I'm his accountant.", next: "b" },
      { id: "b", speaker: "WILL", mood: "smug", text: "Six confirmations? I can print six confirmations. I can print sixty.", next: "c" },
      { id: "c", speaker: "WILL", mood: "alarm", text: "The Void is ours, Marshal. You only visited. We live there.", next: null },
    ] },
  },
  {
    // Villain: the third partner, who wants the holders' keys.
    id: "limitless", name: "LIMITLESS", landmarkId: "torii", side: -1, voice: 85,
    persona: "LIMITLESS, a villain wearing the Limitless pixel skin. Believes there should be no cap on anything, especially supply.",
    script: { id: "npc-limitless", title: "TORII \u00b7 NO CAP (VILLAIN)", start: "a", nodes: [
      { id: "a", speaker: "LIMITLESS", mood: "smug", text: "Twenty-one million? Cute. I don't do limits, Marshal.", next: "b" },
      { id: "b", speaker: "LIMITLESS", mood: "idle", text: "IMAN copies blocks, WILL copies names. I'm here for the keys. Where do people keep them?", next: "c" },
      { id: "c", speaker: "LIMITLESS", mood: "alarm", text: "Don't answer. The answer is always: somewhere careless.", next: null },
    ] },
  },
  {
    // Villain: chaos agent who just wants to watch the mempool burn.
    id: "joker", name: "THE JOKER", landmarkId: "miner-rig-4", side: -1, voice: 260,
    persona: "THE JOKER, a villain wearing The Joker pixel skin. Spams the mempool for laughs.",
    script: { id: "npc-joker", title: "RIG 4 \u00b7 MEMPOOL CLOWN (VILLAIN)", start: "a", nodes: [
      { id: "a", speaker: "THE JOKER", mood: "glitch", text: "Why so confirmed? Let's put a smile on that block!", next: "b" },
      { id: "b", speaker: "THE JOKER", mood: "smug", text: "I broadcast forty thousand dust outputs. Not for money. For the fee chart.", next: "c" },
      { id: "c", speaker: "THE JOKER", mood: "alarm", text: "IMAN pays me in unconfirmed sats. It's the funniest deal I ever took.", next: null },
    ] },
  },
  {
    id: "mr-gold", name: "MR. GOLD", landmarkId: "trading-post", voice: 110,
    persona: "Mr. Gold, wearing the Mr Gold pixel skin. Old-money gold bug slowly converting to Bitcoin.",
    script: { id: "npc-mr-gold", title: "TRADING POST \u00b7 OLD MONEY", start: "a", nodes: [
      { id: "a", speaker: "MR. GOLD", mood: "idle", text: "Forty years I kept gold in a vault. Nobody could audit it but me.", next: "b" },
      { id: "b", speaker: "MR. GOLD", mood: "smug", text: "Now I check my BITMAP from my phone, every block. The vault never let me do that.", next: "c" },
      { id: "c", speaker: "MR. GOLD", mood: "alarm", text: "WILL offered me 'gold-backed confirmations'. I know a fake when I bite one.", next: null },
    ] },
  },
  {
    id: "john-wick", name: "JOHN WICK", landmarkId: "arena", voice: 95,
    persona: "John Wick, a guest wearing the Jhon Wick pixel skin. Quiet professional who guards keys.",
    script: { id: "npc-john-wick", title: "ARENA \u00b7 KEY KEEPER", start: "a", nodes: [
      { id: "a", speaker: "JOHN WICK", mood: "idle", text: "They took a seed phrase. And they hurt a Guardian.", next: "b" },
      { id: "b", speaker: "JOHN WICK", mood: "smug", text: "People keep asking if I'm back. Yeah. I'm back. Self-custody.", next: "c" },
      { id: "c", speaker: "JOHN WICK", mood: "alarm", text: "LIMITLESS is hunting for keys. Tell your friends: never type them into anything.", next: null },
    ] },
  },
] as QuestNpc[]).filter((n) => LANDMARKS.some((l) => l.id === n.landmarkId));

/**
 * On-chain BITMAP Pixels avatars (block 881,133 collection) worn by crew members.
 * Shown on the cast list and in each hero's dialogue portrait; members without one keep their voxel palette.
 */
export const CREW_PIXEL_AVATAR: Record<string, string> = {
  "mr-shiddy": "6302c7eb37f47ba6c205f7b3f3346e1b40ce02b6616c779107da020bc31a5af0i0",
  dudeamoto: "ee028483cf27c3ccd98b22df265dc32579fa7c3aec763a96c54b6a7d01625b2di0",
  tornado: "75e3588e2fad36befc0fbbf7a21354340dee290f2839d19c35db68a79648d5aei0",
  wierdamoto: "02a42a16913bfcdb1d48323850c1a2fab1633e4c1e151bc64c2bd8a5a5cdfacfi0",
  // Ladybird and Dabber were given as BRC-420 HTML avatars (51eb…i0 "Kitty", 61af…i0 "Ninja Dabber");
  // these are the PNG textures those inscriptions declare, so they paint the rig like every other pixel.
  ladybird: "d377e9e47e39e679d7d9fcac811285327ec1f4b4277ee543a0f46a5462809df5i0",
  dabber: "f9fd5d3fb47643f961feeabc512cab62e4c5f6fed70fd0740c3029a144eff1dfi0",
  // Urban was given as a BRC-420 HTML avatar (f601…i0); this is its declared texture.
  urban: "0701ed49ac70544e4d0909c94a5c910a0bf6bc948c20330732ac910206a08388i0",
  dev9: "f9f64471e1fed505e31f90ec445c576219b9cba5b2646effd05d5e36c5e1b788i0", // MM-9
  bop: "80367c008deb077805e247ce722911cf706e9df70cdfba01988c57eaa50caab6i0", // DG-9
  // Fictional guest Presidente B. (HTML f07e…i0 → its declared BukeleOG texture).
  bukele: "cddf8dbb1bdd828cd6cad3e16006ef638ee477d3967042c53fa66c7adaa15937i0",
  // Bitlodo was given as a BRC-420 HTML avatar (d905…i0 "Roaring Bitty - 9"); this is its declared texture.
  bitlodo: "cc06642fa13f760151e53804792c724fe3ffe38858b91f189f8d3439b282248bi0",
  nine: "63474e8b8484268c645fe119de1efd5049ebc8644daf28b6f81b9b654e4cf986i0", // 9nie
  mononaut: "908d426faa34c13c77a7036c1137e67a5e2ea7bb968955ccd25bfdffca72dcfbi0", // PUBG
  // Fictional parody guests wearing their namesake pixels.
  "putin-x": "3446711e0296cf21d531ad02ea4fc37a9f55f7085e335644742db2364bc525a7i0",
  "elon-x": "40ce5b75f4fb19bfdc114fefcf9a57859a55377801356a9b65c989ff4a62dcf6i0",
  jahbooble: "788458663e02868ee6160eea95e61129c480764c78e72103ec453422286c2873i0", // Goose Avatar
  sunset: "e2e5708c647b3eed9ff4efca71769458a00837dda1a130976a9d6b6a5e28aa26i0", // Green Eyed King
  bitoshi: "7b32e098b565c79f217ce2dac18d8e621add81ce3c5fbae1e221c4a0f0679705i0", // Thanos
  curator: "67d87f13c5636287189129463b1741320fdbf3e9963efe22baab5807eb522560i0", // Astral
  batman: "c8e4ee1230f6c1124d39d5bf4016e7c150563ded58bdbe98062b2e48e41499cai0", // Batman
  deadpool: "267d81eee89617db80a25ef0aa2b556381fa28a26bb54e1e97457af43dc9e607i0", // Deadpool
  "donald-x": "5d3ce17b7f3fc8e4b81e652b30eb42550e6dbc97fba348bea715b488da15a266i0", // Donald Trump (parody guest)
  "kane-mayfield": "cab9edf662a551d1de8993e04d5564197c0eb9575fd88dd28f4496b9d273d4f3i0", // Kane Mayfield
  "snoop-x": "ceb2a80ce16750eab3189439f1fb99d53f1e746c04e92a7a2687feddf1a0c9a6i0", // Snoop Dogg (parody guest)
  kodro: "f97b7d7fcdbebda65ed055bcb65e8e5a7bf4a67f6515153eb0c686bb4924b25ai0", // Kodro
  iman: "3918421e4441652767b1c8e646356e499fe4efe4ddd86278012f0f4cc0669785i0", // DeWayn NextHustle
  will: "70472bc48846407bb64879971ccfd2789b9a1c60f9c13ee3b6f0559038378f44i0", // Bitcoin Dude
  limitless: "49ea8ac408ec46c2da4a79d7855f7985dfa8f69d2eb738879b4a057c62dc48dfi0", // Limitless
  joker: "cdb42f9158c04f2a4f2af8ce00b400fc16d47f8db4c2337af9a7201393da097ci0", // The Joker
  "mr-gold": "b15f657c1c8a354cb94b4d429c94e1b4e18612ec66d9441bb22106dcd29d0a3bi0", // Mr Gold
  "john-wick": "2b8fb38ad194a8cff192534bfba594ed679f8c35bdf418c6f68f3d20c55acb95i0", // Jhon Wick
  "space-monnkey": "0d12b9eb94bb4ad7c0a06803c1d9e1fe59a945f718bb3e296f554d0271f12f27i0", // Monkey King Pin Army
};

/** THE UNREASONABLES — the crew, shown as a cast list on /biternam. */
export const BITERNAM_CREW = [
  { id: "wierdamoto", name: "WIERDAMOTO", role: "Masked rebel leader", line: "Theatrical keeper of self-custody. Every sat belongs to its holder." },
  { id: "dev9", name: "DEV9", role: "The veteran · Marauder", line: "Left the café booth to Dabber and moved into a Batcave under the bedrock. Twelve CRTs, one MARAUDER LOG." },
  { id: "bop", name: "BOP", role: "God-tier programmer · the Boptimization standard", line: "Writes code the compiler learns from. If it isn't boptimized, it isn't finished." },
  { id: "nine", name: "9", role: "Culture leader", line: "Gathers the Bitmappers and gives the park its soul." },
  { id: "tornado", name: "TORNADO H. THOMPSON", role: "Gonzo anchor of Bitmap News", line: "Goes live every block. Signs off with the height." },
  { id: "dabber", name: "ELEVATED DABBER", role: "Summit visionary", line: "Holds dev9's old Bit-Café booth now. Sees every BITMAP from above and blows the FUD away like smoke." },
  { id: "bitlodo", name: "BITLODO", role: "Cinema maestro", line: "Directs every raid like a movie. Frame by frame, forever." },
  { id: "mononaut", name: "MONONAUT", role: "Mempool cartographer", line: "Remembers every record block. Tells a sale from a sweep at a glance." },
  { id: "sunset", name: "BITMAP SUNSET", role: "Atmosphere architect", line: "Paints the sky over every block and keeps the frequencies calm." },
  { id: "bitoshi", name: "BITOSHI", role: "The cook who broke bad", line: "Cooks pure block matter in an RV past the western rig. Stay out of his mempool." },
  { id: "jahbooble", name: "JAHBOOBLE", role: "Bitmapper · keeper of the gate", line: "Greets every newcomer like family. Bless up, hold your keys." },
  { id: "mr-shiddy", name: "MR SHIDDY", role: "Bitmapper & engineer", line: "Fixes what Blockamoto called unfixable. Everything is load-bearing." },
  { id: "space-monnkey", name: "SPACE MONNKEY", role: "Insane graphic designer", line: "Sees palettes in block hashes. Paints at escape velocity." },
  { id: "dudeamoto", name: "DUDEAMOTO", role: "Bitmapper legend", line: "The block abides. Somehow always knows where the best BITMAP is." },
  { id: "ladybird", name: "LADYBIRD", role: "Bitmapper · lucky-spot scout", line: "Lands only on real blocks. Seven spots, seven confirmations." },
  { id: "urban", name: "URBAN", role: "Master architect", line: "Laid the bedrock tile by tile in one night, then sailed to his island hotel to sleep it off. The real blueprint is not behind his rig." },
  { id: "bukele", name: "PRESIDENTE B.", role: "Guest · fictional parody", line: "Visiting head of the Volcano Republic. Mines sats with lava. Fictional character, not the real person." },
  { id: "putin-x", name: "PUTIN X", role: "Guest · fictional parody", line: "Stone-faced visitor from the far north who only ever holds. Fictional character, not the real person." },
  { id: "elon-x", name: "ELON X", role: "Guest · fictional parody", line: "Wants to launch a BITMAP into orbit. Block height, literally. Fictional character, not the real person." },
  { id: "batman", name: "BATMAN", role: "Guest · night watch", line: "Watches the tower from the rooftops. Approves of dev9's cave." },
  { id: "deadpool", name: "DEADPOOL", role: "Guest · fourth-wall breaker", line: "Knows he's in a point-and-click game. Will tell you about it." },
  { id: "donald-x", name: "DONALD T.", role: "Guest · fictional parody", line: "Holds tremendous pressers at the statue. Fictional character, not the real person." },
  { id: "kane-mayfield", name: "KANE MAYFIELD", role: "Bitmapper · district lyricist", line: "Writes bars on block heights. Nobody can edit them." },
  { id: "snoop-x", name: "SNOOP D.", role: "Guest · fictional parody", line: "Runs the Bit-Café patio while Dabber holds the booth. Fictional character, not the real person." },
  { id: "kodro", name: "KODRO", role: "Bitmapper · night-shift rigger", line: "Keeps Urban's decoy rig warm. Turned IMAN away at the door." },
  { id: "iman", name: "IMAN", role: "Villain · orphan re-router", line: "Treats orphaned blocks as inventory. Re-routed the ghost of 1138." },
  { id: "will", name: "WILL", role: "Villain · confirmation forger", line: "IMAN's partner. Prints fake confirmations like flyers." },
  { id: "limitless", name: "LIMITLESS", role: "Villain · key hunter", line: "The third partner. No cap on anything, least of all greed. Wants the holders' keys." },
  { id: "joker", name: "THE JOKER", role: "Villain · mempool clown", line: "Spams dust for the fee chart. Paid by IMAN in unconfirmed sats." },
  { id: "mr-gold", name: "MR. GOLD", role: "Guest · old-money convert", line: "Kept gold in a vault for forty years. Now checks his BITMAP every block." },
  { id: "john-wick", name: "JOHN WICK", role: "Guest · key keeper", line: "Quiet professional. Back for self-custody." },
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
    id: "ch3", title: "CH.3 · BREAKING BLOCK", bit: 50, badge: "VOID RUNNER",
    blurb: "A ghost sweep keeps drifting through the void. Find the cook past the western rig and prove it was never a sale.",
    steps: [
      { kind: "talk", target: "dev9", label: "Ask dev9 about the ghost sweep at the Bit-Café",
        say: ["1138.bitmap. Swooshing around lost in some large UTXO. Somebody called it a sale. Unreasonable.", "There's a cook past the western rig. Bitoshi. He knows what real block matter looks like. Suits not welcome."],
        cindy: "dev9 says look for the smoke past the western rig. And don't call it a sale." },
      { kind: "visit", target: "miner-rig-4", label: "Find the smoke past the western rig", cindy: "There it is. An RV that survived three halvings. Smells like solder and unconfirmed inputs." },
      { kind: "pickup", target: "hazmat-suit", indoors: "/biternam/outpost", label: "Suit up inside Bitoshi's RV", cindy: "Very fetching. Now he might actually talk to you." },
      { kind: "talk", target: "bitoshi", gives: "blue-sample", indoors: "/biternam/outpost", label: "Win over Bitoshi inside his RV",
        say: ["You wore the suit. Fine. You're not a tourist.", "Here. Blue OP_RETURN, ninety-nine point one. Show it to the mask. A sweep has no recipe. A sale has a buyer."],
        cindy: "Crystal pure. Now take it to Wierdamoto at the Trading Post." },
      { kind: "give", target: "wierdamoto", item: "blue-sample", label: "Prove it to the mask at the Trading Post",
        say: ["The ghost of 1138. One input, change back to the sender. Show me your proof."], wrong: "That proves nothing about a sweep.",
        cindy: "Case closed. No sale, just one more BITMAP in the void. Welcome to the Void Runners, Marshal." },
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

/** Overworld call for a step that only completes indoors: the character sends you inside, nothing is recorded. */
export function indoorRedirectScript(npc: QuestNpc): TracyScript {
  return { id: `indoors-${npc.id}`, title: `${npc.name} · NOT OUT HERE`, start: "s0", nodes: [
    { id: "s0", speaker: npc.name, mood: "alarm", text: "NOT OUT HERE. Every buzzard in the Oasis is listening. Get inside the RV.", next: "s1" },
    { id: "s1", speaker: npc.name, mood: "idle", text: "And put the suit on. No suit, no sample. Door's right behind me.", next: null },
  ] };
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
  const off = spec.span * WORLD_CELL * 0.62 * (npc.side ?? 1);
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
