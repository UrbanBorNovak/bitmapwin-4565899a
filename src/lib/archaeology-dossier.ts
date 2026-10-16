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

export type Milestone = { height: number; title: string; note: string };

export const MILESTONES: Milestone[] = [
  { height: 0, title: "GENESIS BLOCK", note: "Satoshi mines the first Bitcoin block. Its coinbase can never be spent." },
  { height: 1, title: "FIRST BLOCK AFTER GENESIS", note: "The first block mined on 9 January 2009, six days after genesis." },
  { height: 9, title: "FIRST SPENDABLE COINBASE", note: "The oldest block whose coinbase reward was spent — it funded the first transaction." },
  { height: 78, title: "HAL FINNEY'S FIRST BLOCK", note: "The first block known to be mined by Hal Finney." },
  { height: 170, title: "FIRST P2P TRANSACTION", note: "Satoshi sends 10 BTC to Hal Finney — the first peer-to-peer transfer." },
  { height: 57_043, title: "THE PIZZA TRANSACTION", note: "10,000 BTC for two pizzas on 22 May 2010." },
  { height: 210_000, title: "FIRST HALVING", note: "Block subsidy drops from 50 to 25 BTC." },
  { height: 420_000, title: "SECOND HALVING", note: "Block subsidy drops from 25 to 12.5 BTC." },
  { height: 481_824, title: "SEGWIT ACTIVATION", note: "Segregated Witness activates on mainnet." },
  { height: 630_000, title: "THIRD HALVING", note: "Block subsidy drops from 12.5 to 6.25 BTC." },
  { height: 709_632, title: "TAPROOT ACTIVATION", note: "Taproot activates — the upgrade that later made inscriptions practical." },
  { height: 767_430, title: "FIRST ORDINALS INSCRIPTION", note: "Inscription 0 is revealed on mainnet." },
  { height: BITMAP_GENESIS_BLOCK, title: "BITMAP PROTOCOL GENESIS", note: "The block in which the first .bitmap claims were inscribed." },
  { height: 840_000, title: "FOURTH HALVING", note: "Block subsidy drops from 6.25 to 3.125 BTC." },
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
