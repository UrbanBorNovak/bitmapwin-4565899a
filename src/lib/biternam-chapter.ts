import { cameraPlan, pickCoStars, pickExplorer, pickExtras, type CameraPreset } from "@/lib/biternam-cast";
import { rng, type BiternamRoom, type Music, type ToonEpisode, type ToonSet } from "@/lib/toon-script";

/** Community Chronicles: a free, deterministic Biternam chapter built only from a block's own facts.
 * Same (height, txCount, title, quote) → same episode on every device; nothing is rendered server-side. */
export type BlockFacts = { height: number; txCount: number | null; avgFeeRate?: number | null; minedAt?: string | null };
export type ChapterTheme = "genesis" | "halving" | "patoshi" | "crowded" | "quiet" | "plain";

export const HALVING_INTERVAL = 210_000;
export const TITLE_MAX = 60;
export const QUOTE_MAX = 140;

export function chapterTheme({ height, txCount }: BlockFacts): ChapterTheme {
  if (height === 0) return "genesis";
  if (height % HALVING_INTERVAL === 0) return "halving";
  if (height < 10_000) return "patoshi";
  if (txCount != null && txCount >= 3_000) return "crowded";
  if (txCount != null && txCount <= 1) return "quiet";
  return "plain";
}

const THEME: Record<ChapterTheme, { set: ToonSet; music: Music; titles: string[]; quotes: string[] }> = {
  genesis: { set: "studio", music: "tension", titles: ["The First Page"], quotes: ["Chancellor on brink. And so it begins."] },
  halving: { set: "oasis", music: "adventure", titles: ["The Halving Vigil", "Half the Reward, Twice the Nerve"], quotes: ["Every four years the reward halves. Our resolve doesn't."] },
  patoshi: { set: "rift", music: "tension", titles: ["The Patoshi Outpost", "Dust of the Early Miners"], quotes: ["Back then one laptop could mine a whole block."] },
  crowded: { set: "beach", music: "adventure", titles: ["The Mempool Surge", "A Thousand Voices"], quotes: ["So many transactions in one block. Somebody here is hiding something."] },
  quiet: { set: "rift", music: "chill", titles: ["The Lonely Block", "One Coin, No Witnesses"], quotes: ["Only the miner was here. Only the miner knows."] },
  plain: { set: "oasis", music: "chill", titles: ["A Block Like Any Other", "The Quiet Ledger", "Ten Strides Across"], quotes: ["Every block remembers. That's the whole point."] },
};

export function defaultTitle(f: BlockFacts): string {
  const t = THEME[chapterTheme(f)];
  return t.titles[Math.floor(rng(f.height + 7)() * t.titles.length)]!;
}
export function defaultQuote(f: BlockFacts): string {
  const t = THEME[chapterTheme(f)];
  return t.quotes[Math.floor(rng(f.height + 11)() * t.quotes.length)]!;
}

/** Trim and bound user text; collapse whitespace so stored text is one clean line. */
export function cleanText(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Cindy's briefing: states only the facts that are known, and says plainly when they are not. */
export function factsLine(f: BlockFacts): string {
  const parts: string[] = [];
  if (f.minedAt) parts.push(`Mined ${f.minedAt.slice(0, 10)}.`);
  if (f.txCount != null) parts.push(`${f.txCount.toLocaleString("en-US")} transactions.`);
  if (f.avgFeeRate != null) parts.push(`Fees around ${f.avgFeeRate} sat/vB.`);
  return parts.length ? `${parts.join(" ")} Every one is a clue.` : "The ledger for this block is still being read.";
}

/** Biternam voxel rooms a chapter can be staged in. */
export type ChapterSet = "cafe" | "batcave" | "chinatown" | "vault" | `b-${BiternamRoom}`;
export const CHAPTER_SETS: { v: ChapterSet; label: string }[] = [
  { v: "cafe", label: "Bit-Café" }, { v: "batcave", label: "dev9's Batcave" }, { v: "chinatown", label: "Skyscraper District" }, { v: "vault", label: "Biternam Vault" },
  { v: "b-museum", label: "Bit Museum" }, { v: "b-arcade", label: "Mempool Arcade" }, { v: "b-lab", label: "BOP's Lab" }, { v: "b-studio", label: "Bitmap News Studio" },
  { v: "b-outpost", label: "Bitoshi's Outpost" }, { v: "b-safehouse", label: "Wierdamoto's Safehouse" }, { v: "b-island", label: "Urban's Island Hotel" },
  { v: "b-void", label: "Mempool Void" }, { v: "b-lair", label: "The Lair" }, { v: "b-basement", label: "The Basement" }, { v: "b-archive", label: "The Archive" },
  { v: "b-canon", label: "Canon Crypt" }, { v: "b-holders", label: "Holders Lounge" }, { v: "b-receipt", label: "Receipt Office" },
  { v: "b-fortress", label: "The Fortress" }, { v: "b-handshake", label: "Handshake Station" },
];
const AUTO_SET: Record<ChapterTheme, ChapterSet> = { genesis: "vault", halving: "vault", patoshi: "batcave", crowded: "chinatown", quiet: "batcave", plain: "cafe" };
const AUTO_POOL: Record<ChapterTheme, ChapterSet[]> = {
  genesis: ["vault", "b-museum", "b-canon"], halving: ["vault", "b-fortress", "b-holders"], patoshi: ["batcave", "b-archive", "b-basement", "b-lab"],
  crowded: ["chinatown", "b-arcade", "b-studio", "b-receipt", "b-handshake"], quiet: ["batcave", "b-void", "b-outpost", "b-lair"], plain: ["cafe", "b-island", "b-safehouse", "b-museum", "b-studio"],
};
/** Rooms rotate by block height so every Biternam build appears across blocks. */
export function autoSet(f: BlockFacts): ChapterSet { const pool = AUTO_POOL[chapterTheme(f)]; return pool[Math.abs(f.height ?? 0) % pool.length] ?? AUTO_SET[chapterTheme(f)]; }

/** What actually exists on this BITMAP. A Guardian is cast only when one was really awakened for the block.
 * guardianUnknown = the lookup failed or is still running: no Guardian is drawn and none is claimed absent. */
export type ChapterCast = { guardian: { species: string } | null; hasBuild: boolean; set?: ChapterSet; guardianUnknown?: boolean; seed?: number; camera?: CameraPreset };

export function chapterEpisode(f: BlockFacts, title: string, quote: string, cast: ChapterCast = { guardian: null, hasBuild: false }): ToonEpisode {
  const theme = chapterTheme(f), t = THEME[theme], h = f.height, seed = cast.seed ?? 0;
  const set = cast.set ?? autoSet(f);
  const cam = cameraPlan(cast.camera ?? "auto", h, seed);
  const [a, b] = pickCoStars(h, seed);
  const extras = pickExtras(h, seed);
  const hero = cast.guardian
    ? { height: h, name: `${h}.bitmap · ${cast.guardian.species}` }
    : { height: h, ...pickExplorer(h, seed) };
  const reply = cast.guardian ? "Then we read them all."
    : cast.guardianUnknown ? "The Guardian records are out of reach. I'll read them myself."
    : "No Guardian wakes here yet. I'll read them myself.";
  const landSfx = cast.hasBuild ? "BUILT!" : theme === "halving" ? "HODL!" : "WHOOSH!";
  return {
    title: `CH.${h} · ${title.toUpperCase()}`, aspect: "16:9", music: t.music, voices: true, style: "ghibli",
    scenes: [
      // Scene 1 is the real land: its inscribed build appears only if one is verified on chain.
      { block: h, duration: 7, shot: cam.shots[0], sfx: landSfx,
        cast: [{ ...hero, x: 0, z: 3, pose: "walk", to: { x: 0, z: 0 }, moveStart: 0, moveEnd: 3 }],
        lines: [{ at: 1, dur: 5, speaker: 0, text: quote, style: "thought", cam: cam.cams[0] }] },
      { block: h, set, duration: 9, shot: cam.shots[1], transition: cam.transitions[0], extras,
        cast: [{ ...hero, x: -3, z: 0, pose: "talk" }, { height: h, name: a.name, x: 3, z: 0, pose: "wave", avatar: a.avatar }],
        lines: [
          { at: 0.5, dur: 3, speaker: 1, text: factsLine(f), style: "speech", cam: cam.cams[1] },
          { at: 3.6, dur: 2.5, speaker: 1, text: a.quip, style: "speech", cam: cam.cams[2] },
          { at: 6.2, dur: 2.6, speaker: 0, text: reply, style: "speech", cam: cam.cams[3] },
        ] },
      { block: h, set, duration: 7, shot: cam.shots[2], transition: cam.transitions[1], extras,
        cast: [{ ...hero, x: 0, z: 0, pose: "dance", emote: "happy" }, { height: h, name: b.name, x: 5, z: 2, pose: "jump", avatar: b.avatar }],
        lines: [
          { at: 0.8, dur: 3, speaker: 0, text: `Block ${h.toLocaleString("en-US")}. My chapter. On the record.`, style: "shout", cam: "close" },
          { at: 4, dur: 2.6, speaker: 1, text: b.cheer, style: "shout", cam: cam.cams[2] },
        ] },
    ],
  } as ToonEpisode;
}
