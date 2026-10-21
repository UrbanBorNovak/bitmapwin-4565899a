/** Unhinged Biternam dialogue for generated chapters. Picked deterministically from (height, seed) so a roll replays identically.
 * Lines riff on lore and block facts but never invent chain facts: numbers only come from BlockFacts. */
import type { BlockFacts, ChapterTheme } from "@/lib/biternam-chapter";

type Pool = string[];
const pick = (p: Pool, n: number) => p[Math.abs(n) % p.length]!;

/** Per co-star: what they blurt when they barge in, and how they lose it at the finale. */
export const BANTER: Record<string, { in: Pool; out: Pool }> = {
  tornado: {
    in: ["BREAKING: local man finds block, refuses to elaborate. More at never.", "This just in: the mempool is screaming again and I am, legally, also screaming.", "I've been live for nine hundred hours. My teleprompter is a ledger. Send help. Or sats."],
    out: ["AND THAT'S THE HEIGHT! BACK TO YOU, ALSO ME!", "TORNADO H. THOMPSON, SIGNING OFF AND ON AND OFF!", "STAY TUNED: NOTHING EVER CONFIRMS FASTER THAN TEN MINUTES!"],
  },
  dev9: {
    in: ["I have twelve CRTs and eleven of them are watching you. The twelfth is watching the eleven.", "Don't touch the cables. The orange ones are load-bearing. The cyan ones are emotional support.", "I ran this block through the cave relay. It came out humming. I don't like when they hum."],
    out: ["Marauder log updated. Nobody tell the bedrock.", "One draw call. ONE. Like a gentleman.", "I'm going back in the cave. Don't follow me. Okay follow me a little."],
  },
  wierdamoto: {
    in: ["Two signatures, or none. I don't even sign birthday cards with one key.", "They said 'not your keys'. I said 'not your business'. Then I ate the seed phrase. Metaphorically.", "Remember the Night of Two Signatures? I do. I was both signatures."],
    out: ["REMEMBER, REMEMBER, THE FIFTH OF NO-CUSTODIAN!", "Multisig is love. Multisig is life. Multisig is legally binding.", "The mask stays on. The keys stay cold. The tea stays hot."],
  },
  bop: {
    in: ["I boptimized this conversation. It's now 40% shorter and 300% louder.", "Zero warnings, zero errors, zero friends. Perfect build.", "I rewrote your shoelaces in Rust. You're welcome."],
    out: ["ZERO WARNINGS! ZERO MERCY!", "Shipped. Don't look at the diff.", "Boptimized. Bop-timised. Bopped."],
  },
  dabber: {
    in: ["I climbed the tallest tile in the district just to dab on the FUD. The FUD left.", "From up here your portfolio looks tiny. Also from down there.", "Elevation is a mindset. And a ladder. Mostly a ladder."],
    out: ["ELEVATED. SEDATED. INSCRIBED.", "DAB ON THE MEMPOOL!", "See you at the summit, peasants. Lovingly."],
  },
  "mr-shiddy": {
    in: ["Everything here is load-bearing. Including my opinions.", "I checked the foundations. They checked me back.", "This floor is one owner per tile. I asked. Politely. With a hammer."],
    out: ["BUILT LIKE BEDROCK, BABY!", "Structurally unhinged!", "If it falls over, it was art."],
  },
  jahbooble: {
    in: ["Bless up, newcomer. Have you hydrated your private keys today?", "Honk. That's goose for 'hold your coins, my brother'.", "I blessed this block personally. It now has a little halo. You can't see it. It's in the merkle root."],
    out: ["HONK HONK, BLESSINGS UPON THE BLOCK!", "Peace, love and cold storage!", "The goose has spoken. The goose is satisfied."],
  },
  mononaut: {
    in: ["I watched this block from orbit. It looked like a little orange sandwich.", "I can tell a sweep from a sale from four hundred kilometres up. I can't tell lunch from dinner though.", "Ground control, the mempool is doing the thing again."],
    out: ["ORBIT ACHIEVED! LUNCH NOT ACHIEVED!", "Houston, we have a block.", "Back to the void. Bring snacks."],
  },
  sunset: {
    in: ["Orange and cyan tonight. The frequency says: 'calm down, it's just money'.", "Every block ends in a sunset. Some blocks end in a weird sunset. This is one of those.", "I painted this sky with fees. Expensive sky."],
    out: ["THE SUNSET NEVER ENDS! MY SHIFT DOES THOUGH!", "Pink, cyan, home.", "Golden hour, forever, on chain."],
  },
  bitoshi: {
    in: ["Pure block matter. Ninety-nine point nine percent sats. Don't ask about the point one.", "HAZMAT SUIT ON. House rule. Visitors, no exceptions, especially you.", "I cook with confirmations. Six is medium rare."],
    out: ["COOKED TO PURITY!", "Say my name. No, the block height. Say THAT.", "Nobody touch the recipe. Not even me."],
  },
  "mr-gold": {
    in: ["I keep the receipts nobody else wanted. I have receipts for my receipts.", "Gold? Me? Darling, I'm just early.", "The ledger collector always collects. Usually at 3 a.m."],
    out: ["ADDED TO THE ARCHIVE. FOREVER. NO REFUNDS.", "Shiny! Provable! Mine-ish!", "Receipt printed. Receipt framed. Receipt worshipped."],
  },
  "john-wick": {
    in: ["Someone touched my BITMAP. They are no longer in the mempool.", "Yeah. I'm thinking I'm holding.", "People keep asking if I'm back. I never sold."],
    out: ["SOVEREIGN CUSTODY. NO MERCY.", "Don't. Touch. The. Seed.", "The dog's on chain now. Leave him alone."],
  },
  curator: {
    in: ["Only chain-proven history hangs in my museum. Your opinions go in the gift shop.", "Please do not lick the inscriptions.", "I dusted this block myself. With a very small sat."],
    out: ["PRESERVED FOREVER! EXIT THROUGH THE GIFT SHOP!", "Catalogued. Curated. Slightly cursed.", "Another masterpiece for the void wing."],
  },
};

/** A loud riff about the block's mood, by theme. */
const THEME_RIFF: Record<ChapterTheme, Pool> = {
  genesis: ["This is THE block. Satoshi's newspaper is still warm. Nobody spill coffee on it.", "Genesis. The very first tile. Everything after this is fan fiction."],
  halving: ["HALVING BLOCK! Miners are crying, holders are dancing, the chart is doing yoga.", "Rewards cut in half. Vibes doubled. Math checks out."],
  patoshi: ["Early-era block. The dust here is older than most of your passwords.", "Patoshi era. Somewhere a single CPU is still humming the theme song."],
  crowded: ["This block is PACKED. It's a nightclub. Everybody's paying cover.", "Busiest block on the strip. The bouncer is a fee estimator."],
  quiet: ["Quiet block. Suspiciously quiet. Like a library full of ninjas.", "Nearly empty. The miner just wanted to feel something."],
  plain: ["Normal block. Totally normal. Nothing weird here. Why are you looking at me like that.", "An honest, hardworking block. Pays its taxes. In sats."],
};

const GUARDIAN_REPLY: Pool = [
  "Silence, mortals. I am the {S} of this tile and I demand snacks.",
  "I have guarded this block since before your wallet had a name. I, {S}, am bored.",
  "A {S} does not 'hang out'. A {S} PATROLS. ...Okay, we can hang out.",
];
const EXPLORER_REPLY: Pool = [
  "No Guardian here yet, so I guess I'm the main character now. Terrifying.",
  "Nobody's guarding this place. I'm wearing a pixel and a dream.",
  "No Guardian has woken up. I tried knocking. The bedrock knocked back.",
];
const UNKNOWN_REPLY: Pool = [
  "The Guardian records are out of reach. Cindy says it's 'complicated'.",
  "The Guardian records are out of reach right now. I'll act brave anyway.",
];
const FINALE: Pool = [
  "Block {H}! MY chapter! Carve it into the chain, I'm not reading it twice!",
  "Block {H}! I'm famous! In a very small, very permanent way!",
  "Block {H}! Roll credits! Roll blocks! Roll everything!",
];

const rnd = (h: number, s: number, k: number) => ((h * 31 + s * 977 + k * 131) >>> 0);

export function coStarIn(id: string, h: number, s: number) { return pick(BANTER[id]?.in ?? ["..."], rnd(h, s, 1)); }
export function coStarOut(id: string, h: number, s: number) { return pick(BANTER[id]?.out ?? ["!"], rnd(h, s, 2)); }
export function themeRiff(theme: ChapterTheme, h: number, s: number) { return pick(THEME_RIFF[theme], rnd(h, s, 3)); }
export function heroReply(c: { guardian: { species: string } | null; guardianUnknown?: boolean }, h: number, s: number) {
  if (c.guardian) return pick(GUARDIAN_REPLY, rnd(h, s, 4)).replaceAll("{S}", c.guardian.species);
  return pick(c.guardianUnknown ? UNKNOWN_REPLY : EXPLORER_REPLY, rnd(h, s, 5));
}
export function finaleLine(h: number, s: number) { return pick(FINALE, rnd(h, s, 6)).replace("{H}", h.toLocaleString("en-US")); }
export type { BlockFacts };

/** Room flavour for titles/quotes (set key → short punchline nouns). Pure jokes, no chain claims. */
const ROOM: Record<string, { place: string; gag: string }> = {
  cafe: { place: "the Bit-Café", gag: "the espresso machine is running a full node" },
  batcave: { place: "dev9's Batcave", gag: "the CRTs are whispering block hashes again" },
  chinatown: { place: "the Skyscraper District", gag: "the neon signs only accept sats" },
  vault: { place: "the Biternam Vault", gag: "the vault door wants two signatures and a compliment" },
  "b-museum": { place: "the Bit Museum", gag: "the exhibits keep asking for royalties" },
  "b-arcade": { place: "the Mempool Arcade", gag: "every cabinet charges a priority fee" },
  "b-lab": { place: "BOP's Lab", gag: "something in a jar just got boptimized" },
  "b-studio": { place: "the Bitmap News Studio", gag: "the teleprompter is reading the mempool live" },
  "b-outpost": { place: "Bitoshi's Outpost", gag: "the RV smells like pure block matter" },
  "b-safehouse": { place: "Wierdamoto's Safehouse", gag: "even the fridge is multisig" },
  "b-island": { place: "Urban's Island Hotel", gag: "room service delivers seed phrases on ice" },
  "b-void": { place: "the Mempool Void", gag: "the unconfirmed are screaming politely" },
  "b-lair": { place: "the Lair", gag: "the villain monologue has a fee estimate" },
  "b-basement": { place: "the Basement", gag: "the boiler is mining something" },
  "b-archive": { place: "the Archive", gag: "the receipts have receipts" },
  "b-canon": { place: "the Canon Crypt", gag: "the ancestors are arguing about lore again" },
  "b-holders": { place: "the Holders Lounge", gag: "nobody has stood up since the last halving" },
  "b-receipt": { place: "the Receipt Office", gag: "the printer only prints regrets" },
  "b-fortress": { place: "the Fortress", gag: "the moat is filled with cold storage" },
  "b-handshake": { place: "Handshake Station", gag: "every handshake needs six confirmations" },
};
const THEME_TITLES: Record<ChapterTheme, Pool> = {
  genesis: ["Chancellor on Brink, Me on Brink Too", "Page One, Coffee Stain Included", "In the Beginning Was the Block"],
  halving: ["Half the Reward, Twice the Screaming", "The Great Halving Meltdown", "Miners Crying, Holders Vibing"],
  patoshi: ["One Laptop to Rule Them All", "Dust Older Than Your Passwords", "The CPU That Hummed Too Hard"],
  crowded: ["Mempool Mosh Pit", "Everybody Paid the Bouncer", "Standing Room Only in the Ledger"],
  quiet: ["The Block Where Nobody Came", "Suspiciously Empty, Suspiciously Mine", "Library Full of Ninjas"],
  plain: ["Totally Normal Block, Nothing to See", "Ten Strides and a Bad Idea", "An Honest Block Gets Weird"],
};
const TITLE_TPL: Pool = ["{T}", "{T}", "{C} Ruins {P}", "{H}.bitmap vs. {P}", "Chaos at {P}", "{C} Was Never Here"];
const QUOTE_TPL: Pool = [
  "I came to {P} for peace and quiet. Turns out {G}.",
  "{C} told me not to touch anything. I touched everything.",
  "{H}.bitmap. One owner per tile, zero chill per tile.",
  "If {C} asks, I was never in {P}.",
  "{G}. This is fine. Everything is load-bearing.",
];
const lead = (c: { guardian?: { species: string } | null }) => c.guardian ? `the ${c.guardian.species}` : "the explorer";
const fill = (t: string, h: number, set: string, coStar: string, c: { guardian?: { species: string } | null }) => {
  const r = ROOM[set] ?? { place: "Biternam", gag: "the bedrock is humming" };
  return t.replaceAll("{P}", r.place).replaceAll("{G}", r.gag).replaceAll("{C}", coStar).replaceAll("{H}", String(h)).replaceAll("{L}", lead(c));
};
const titleCase = (s: string) => s.replace(/(^|\s)\w/g, (m) => m.toUpperCase());

export type TitleCtx = { set: string; coStar: string; guardian?: { species: string } | null; seed?: number };
/** Suggested chapter title: block theme + room + co-star. Uses only the height and derived theme, never invented numbers. */
export function loreTitle(theme: ChapterTheme, h: number, ctx: TitleCtx) {
  const s = ctx.seed ?? 0, base = pick(THEME_TITLES[theme], rnd(h, s, 7));
  const coStar = ctx.coStar.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
  return titleCase(fill(pick(TITLE_TPL, rnd(h, s, 8)).replace("{T}", base), h, ctx.set, coStar, ctx)).slice(0, 60);
}
export function loreQuote(_theme: ChapterTheme, h: number, ctx: TitleCtx) {
  const s = ctx.seed ?? 0;
  const coStar = ctx.coStar.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
  const q = fill(pick(QUOTE_TPL, rnd(h, s, 9)), h, ctx.set, coStar, ctx);
  return (q[0]!.toUpperCase() + q.slice(1)).slice(0, 140);
}
