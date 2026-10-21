import { rng, type Music, type ToonEpisode, type ToonSet } from "@/lib/toon-script";

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
export type ChapterSet = "cafe" | "batcave" | "chinatown" | "vault";
export const CHAPTER_SETS: { v: ChapterSet; label: string }[] = [
  { v: "cafe", label: "Bit-Café" }, { v: "batcave", label: "dev9's Batcave" }, { v: "chinatown", label: "Skyscraper District" }, { v: "vault", label: "Biternam Vault" },
];
const AUTO_SET: Record<ChapterTheme, ChapterSet> = { genesis: "vault", halving: "vault", patoshi: "batcave", crowded: "chinatown", quiet: "batcave", plain: "cafe" };
export function autoSet(f: BlockFacts): ChapterSet { return AUTO_SET[chapterTheme(f)]; }

/** What actually exists on this BITMAP. A Guardian is cast only when one was really awakened for the block. */
export type ChapterCast = { guardian: { species: string } | null; hasBuild: boolean; set?: ChapterSet };
const EXPLORER = { model: "runner", skin: "hoodie" } as const;

export function chapterEpisode(f: BlockFacts, title: string, quote: string, cast: ChapterCast = { guardian: null, hasBuild: false }): ToonEpisode {
  const theme = chapterTheme(f), t = THEME[theme], h = f.height;
  const set = cast.set ?? autoSet(f);
  const txLine = factsLine(f);
  const hero = cast.guardian
    ? { height: h, name: `${h}.bitmap · ${cast.guardian.species}` }
    : { height: h, name: `Explorer of ${h}.bitmap`, avatar: { ...EXPLORER } };
  const reply = cast.guardian ? "Then we read them all." : "No Guardian wakes here yet. I'll read them myself.";
  const landSfx = cast.hasBuild ? "BUILT!" : theme === "halving" ? "HODL!" : "WHOOSH!";
  return {
    title: `CH.${h} · ${title.toUpperCase()}`, aspect: "16:9", music: t.music, voices: true, style: "ghibli",
    scenes: [
      // Scene 1 is the real land: its inscribed build appears only if one is verified on chain.
      { block: h, duration: 7, shot: "crane", sfx: landSfx,
        cast: [{ ...hero, x: 0, z: 3, pose: "walk", to: { x: 0, z: 0 }, moveStart: 0, moveEnd: 3 }],
        lines: [{ at: 1, dur: 5, speaker: 0, text: quote, style: "thought", cam: "establish" }] },
      { block: h, set, duration: 7, shot: "orbit", transition: "iris",
        cast: [{ ...hero, x: -2, z: 0, pose: "talk" }, { height: h, name: "Cindy-9", x: 2, z: 0, pose: "wave", avatar: { model: "bot", skin: "cyber" } }],
        lines: [{ at: 0.5, dur: 3, speaker: 1, text: txLine, style: "speech", cam: "two" }, { at: 3.8, dur: 3, speaker: 0, text: reply, style: "speech", cam: "close" }] },
      { block: h, set, duration: 6, shot: "dolly", transition: "fade",
        cast: [{ ...hero, x: 0, z: 0, pose: "dance", emote: "happy" }],
        lines: [{ at: 1, dur: 4, speaker: 0, text: `Block ${h.toLocaleString("en-US")}. My chapter. On the record.`, style: "shout", cam: "close" }] },
    ],
  } as ToonEpisode;
}
