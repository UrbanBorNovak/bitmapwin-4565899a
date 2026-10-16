/** Pure archaeology helpers: inscription era from the claim's genesis block, milestones from block height. */

export const BITMAP_GENESIS_BLOCK = 792_435;

export type InscriptionEra = { id: "vanguard" | "rush" | "consolidation" | "modern"; label: string; range: string };

const ERAS: { id: InscriptionEra["id"]; label: string; lo: number; hi: number }[] = [
  { id: "vanguard", label: "GENESIS VANGUARD", lo: 792_435, hi: 793_499 },
  { id: "rush", label: "THE GREAT RUSH", lo: 793_500, hi: 795_999 },
  { id: "consolidation", label: "CONSOLIDATION", lo: 796_000, hi: 799_999 },
  { id: "modern", label: "MODERN FRONTIER", lo: 800_000, hi: Infinity },
];

/** Era of the block the claim was inscribed in. Null when unknown or before protocol genesis. */
export function inscriptionEra(genesisHeight: number | null | undefined): InscriptionEra | null {
  if (genesisHeight === null || genesisHeight === undefined || !Number.isFinite(genesisHeight)) return null;
  const e = ERAS.find((x) => genesisHeight >= x.lo && genesisHeight <= x.hi);
  if (!e) return null;
  return { id: e.id, label: e.label, range: e.hi === Infinity ? `${e.lo.toLocaleString("en-US")} +` : `${e.lo.toLocaleString("en-US")} – ${e.hi.toLocaleString("en-US")}` };
}

export type Milestone = { height: number; title: string; note: string; source: string; sourceLabel: string };

/** Chain-fact evidence: the block itself on a public explorer. */
export const blockEvidenceUrl = (height: number) => `https://mempool.space/block/${height}`;
export const inscriptionEvidenceUrl = (id: string) => `https://ordinals.com/inscription/${id}`;

export const MILESTONES: Milestone[] = [
  { height: 0, title: "GENESIS BLOCK", note: "Satoshi mines the first Bitcoin block. Its coinbase can never be spent." , source: "https://en.bitcoin.it/wiki/Genesis_block", sourceLabel: "BITCOIN WIKI" },
  { height: 1, title: "FIRST BLOCK AFTER GENESIS", note: "The first block mined on 9 January 2009, six days after genesis." , source: "https://en.bitcoin.it/wiki/Genesis_block", sourceLabel: "BITCOIN WIKI" },
  { height: 9, title: "FIRST SPENDABLE COINBASE", note: "The oldest block whose coinbase reward was spent — it funded the first transaction." , source: "https://en.bitcoin.it/wiki/Block_9", sourceLabel: "BITCOIN WIKI" },
  { height: 78, title: "HAL FINNEY'S FIRST BLOCK", note: "The first block known to be mined by Hal Finney." , source: "https://en.wikipedia.org/wiki/Hal_Finney_(computer_scientist)", sourceLabel: "WIKIPEDIA" },
  { height: 170, title: "FIRST P2P TRANSACTION", note: "Satoshi sends 10 BTC to Hal Finney — the first peer-to-peer transfer." , source: "https://en.bitcoin.it/wiki/Block_170", sourceLabel: "BITCOIN WIKI" },
  { height: 57_043, title: "THE PIZZA TRANSACTION", note: "10,000 BTC for two pizzas on 22 May 2010." , source: "https://en.bitcoin.it/wiki/Laszlo_Hanyecz", sourceLabel: "BITCOIN WIKI" },
  { height: 210_000, title: "FIRST HALVING", note: "Block subsidy drops from 50 to 25 BTC." , source: "https://en.bitcoin.it/wiki/Controlled_supply", sourceLabel: "BITCOIN WIKI" },
  { height: 420_000, title: "SECOND HALVING", note: "Block subsidy drops from 25 to 12.5 BTC." , source: "https://en.bitcoin.it/wiki/Controlled_supply", sourceLabel: "BITCOIN WIKI" },
  { height: 481_824, title: "SEGWIT ACTIVATION", note: "Segregated Witness activates on mainnet." , source: "https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki", sourceLabel: "BIP 141" },
  { height: 630_000, title: "THIRD HALVING", note: "Block subsidy drops from 12.5 to 6.25 BTC." , source: "https://en.bitcoin.it/wiki/Controlled_supply", sourceLabel: "BITCOIN WIKI" },
  { height: 709_632, title: "TAPROOT ACTIVATION", note: "Taproot activates — the upgrade that later made inscriptions practical." , source: "https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki", sourceLabel: "BIP 341" },
  { height: 767_430, title: "FIRST ORDINALS INSCRIPTION", note: "Inscription 0 is revealed on mainnet." , source: "https://ordinals.com/inscription/0", sourceLabel: "ORDINALS.COM" },
  { height: BITMAP_GENESIS_BLOCK, title: "BITMAP PROTOCOL GENESIS", note: "The block in which the first .bitmap claims were inscribed." , source: "https://docs.bitmap.community", sourceLabel: "BITMAP.COMMUNITY" },
  { height: 840_000, title: "FOURTH HALVING", note: "Block subsidy drops from 6.25 to 3.125 BTC." , source: "https://en.bitcoin.it/wiki/Controlled_supply", sourceLabel: "BITCOIN WIKI" },
];

export function milestoneAt(height: number): Milestone | null {
  return MILESTONES.find((m) => m.height === height) ?? null;
}

/** Nearest milestones strictly before and after a height (for context). */
export function nearbyMilestones(height: number): { prev: Milestone | null; next: Milestone | null } {
  let prev: Milestone | null = null;
  let next: Milestone | null = null;
  for (const m of MILESTONES) {
    if (m.height < height) prev = m;
    else if (m.height > height && !next) next = m;
  }
  return { prev, next };
}

/** Blocks between the land's height and the block its claim was inscribed in. */
export function claimLag(height: number, genesisHeight: number | null | undefined): number | null {
  if (genesisHeight === null || genesisHeight === undefined) return null;
  return genesisHeight - height;
}
