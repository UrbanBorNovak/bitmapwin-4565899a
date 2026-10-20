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

export type QuestStep = { kind: "talk" | "visit"; target: string; label: string };
export type Quest = { id: string; title: string; blurb: string; steps: QuestStep[]; bit: number; badge: string };

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
    id: "tornado", name: "TORNADO", landmarkId: "bitcoin-statue", voice: 170,
    persona: "Tornado, anchorman of Bitmap News. Booming broadcast voice, loves a breaking headline, always signs off with the block height.",
    script: { id: "npc-tornado", title: "BITMAP NEWS · LIVE DESK", start: "a", nodes: [
      { id: "a", speaker: "TORNADO", mood: "alarm", text: "GOOD EVENING, BITMAPPERS. Breaking tonight: a virus in the park node, a masked marshal on the loose, and fees doing something nobody can explain.", choices: [
        { label: "\"Can you get a message out?\"", next: "b" },
        { label: "\"Any leads?\"", next: "c" },
      ] },
      { id: "b", speaker: "TORNADO", mood: "smug", text: "Kid, I go live every block. But the virus is jamming my signal. Find BOP. If anyone can patch a broadcast, it's BOP.", next: null },
      { id: "c", speaker: "TORNADO", mood: "idle", text: "Sources say the jam started in the miner rigs. Sources also say BOP knows. I am the sources. Back to you, chain.", next: null },
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
    persona: "Urban, a practical engineer who builds the world's tools and marketplaces. Hands-on, honest about what is broken, proud of clean structure.",
    script: { id: "npc-urban", title: "MINER RIG 3 · WORKSHOP", start: "a", nodes: [
      { id: "a", speaker: "URBAN", mood: "idle", text: "BOP fried another rig? Typical. Hand me that wrench. Every block in this park is a part, and every part has a place.", choices: [
        { label: "\"Can you fix it?\"", next: "b" },
        { label: "\"What are you building?\"", next: "c" },
      ] },
      { id: "c", speaker: "URBAN", mood: "smug", text: "Land you can actually build on. Tools that check the chain before they trust a word. Now, the rig.", next: "b" },
      { id: "b", speaker: "URBAN", mood: "idle", text: "Fixed and verified. But a working park is no use if nobody comes. Take this to 9 at the Great Statue.", next: null },
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
  { id: "dev9", name: "DEV9", role: "The veteran", line: "Old dev, ex-military, reads raw transactions like intercepted signals." },
  { id: "tornado", name: "TORNADO", role: "Anchorman of Bitmap News", line: "Goes live every block. Signs off with the height." },
  { id: "bop", name: "BOP", role: "The programmer", line: "Ships overnight. Makes hard things feel smooth." },
  { id: "nine", name: "9", role: "Culture leader", line: "Gathers the Bitmappers and gives the park its soul." },
  { id: "urban", name: "URBAN", role: "The engineer", line: "Builds the tools and checks the chain before trusting a word." },
];

export const QUESTS: Quest[] = [
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
];

export const NPC_REACH = 0.9; // BITMAPS
export const VISIT_REACH = 1.6;

export const npcById = (id: string) => QUEST_NPCS.find((n) => n.id === id) ?? null;

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

/** Advance every quest whose current step matches the event. Steps only go forward. */
export function applyEvent(p: QuestProgress, kind: QuestStep["kind"], target: string): { next: QuestProgress; advanced: Quest[] } {
  const step = { ...p.step };
  const advanced: Quest[] = [];
  for (const q of QUESTS) {
    const i = step[q.id] ?? 0;
    const s = q.steps[i];
    if (s && s.kind === kind && s.target === target) { step[q.id] = i + 1; advanced.push(q); }
  }
  return { next: advanced.length ? { ...p, step } : p, advanced };
}

const KEY = "bitmapwin:biternam-quests";
let state: QuestProgress | null = null;
let near: string | null = null;
const listeners = new Set<() => void>();
const advListeners = new Set<(q: Quest, done: boolean) => void>();
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
    advanced.forEach((q) => advListeners.forEach((f) => f(q, isComplete(q, next))));
  },
  markClaimed(id: string) { const p = load(); if (!p.claimed.includes(id)) save({ ...p, claimed: [...p.claimed, id] }); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  onAdvance(fn: (q: Quest, done: boolean) => void) { advListeners.add(fn); return () => { advListeners.delete(fn); }; },
};

export function useQuestState() {
  const progress = useSyncExternalStore(questStore.subscribe, questStore.get, () => BLANK);
  const nearId = useSyncExternalStore(questStore.subscribe, questStore.near, () => null);
  return { progress, nearId };
}
