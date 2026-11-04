/**
 * BW-BARTER-1 — pure protocol core for wallet-to-wallet Ordinal/BITMAP barter.
 * Tickets state what a maker offers and what they accept; a swap layout is the
 * input/output plan both parties sign with SIGHASH_ALL. Nothing here signs,
 * broadcasts or trusts browser claims: asset facts must come from live chain
 * lookups supplied by the caller.
 */

export const BARTER_KIND = 30403;
export const BARTER_TAG = "bw-barter-1";
export const DUST_SATS = 546;

export type AssetType = "bitmap" | "guardian" | "voxel" | "ordinal";

/** Facts about a candidate asset, resolved from chain (never from the taker). */
export type AssetFacts = {
  inscriptionId: string;
  outpoint: string;
  value: number;
  offset: number;
  type: AssetType;
  height?: number;
  txCount?: number;
  patoshi?: boolean;
  parentIds?: string[];
  spent: boolean;
};

export type BarterCriteria = {
  assetType?: AssetType;
  exactInscriptionId?: string;
  exactHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  minTxCount?: number;
  maxTxCount?: number;
  patoshiOnly?: boolean;
  parentInscriptionId?: string;
};

export type BarterTicket = {
  makerAddress: string;
  offeringOutpoint: string;
  offeringInscription: string;
  offeringValue: number;
  sweetenerSats: number;
  sweetenerDir: "give" | "demand";
  criteria: BarterCriteria;
};

const OUTPOINT = /^[0-9a-f]{64}:\d+$/;
const INSCRIPTION = /^[0-9a-f]{64}i\d+$/;

/** Returns a reason the ticket is malformed, or null when it is well-formed. */
export function ticketProblem(t: BarterTicket): string | null {
  if (!OUTPOINT.test(t.offeringOutpoint)) return "bad offering outpoint";
  if (!INSCRIPTION.test(t.offeringInscription)) return "bad offering inscription";
  if (!Number.isInteger(t.offeringValue) || t.offeringValue < DUST_SATS) return "offering value below dust";
  if (!Number.isInteger(t.sweetenerSats) || t.sweetenerSats < 0) return "bad sweetener";
  if (t.sweetenerSats > 0 && t.sweetenerSats < DUST_SATS) return "sweetener below dust";
  const c = t.criteria;
  if (c.exactInscriptionId !== undefined && !INSCRIPTION.test(c.exactInscriptionId)) return "bad wanted inscription";
  if (c.minHeight !== undefined && c.maxHeight !== undefined && c.minHeight > c.maxHeight) return "empty height range";
  if (c.minTxCount !== undefined && c.maxTxCount !== undefined && c.minTxCount > c.maxTxCount) return "empty tx range";
  const hasRule = Object.values(c).some((v) => v !== undefined);
  if (!hasRule) return "criteria must name at least one rule";
  return null;
}

/** Does a chain-verified asset satisfy the ticket's criteria? Missing facts never match. */
export function matchesCriteria(c: BarterCriteria, a: AssetFacts): boolean {
  if (a.spent) return false;
  if (c.assetType && a.type !== c.assetType) return false;
  if (c.exactInscriptionId && a.inscriptionId !== c.exactInscriptionId) return false;
  const needsHeight = c.exactHeight !== undefined || c.minHeight !== undefined || c.maxHeight !== undefined;
  if (needsHeight) {
    if (a.height === undefined) return false;
    if (c.exactHeight !== undefined && a.height !== c.exactHeight) return false;
    if (c.minHeight !== undefined && a.height < c.minHeight) return false;
    if (c.maxHeight !== undefined && a.height > c.maxHeight) return false;
  }
  if (c.minTxCount !== undefined || c.maxTxCount !== undefined) {
    if (a.txCount === undefined) return false;
    if (c.minTxCount !== undefined && a.txCount < c.minTxCount) return false;
    if (c.maxTxCount !== undefined && a.txCount > c.maxTxCount) return false;
  }
  if (c.patoshiOnly && a.patoshi !== true) return false;
  if (c.parentInscriptionId && !(a.parentIds ?? []).includes(c.parentInscriptionId)) return false;
  return true;
}

export type SwapInput = { outpoint: string; value: number; owner: "maker" | "taker" };
export type SwapOutput = { address: string; value: number };
export type SwapLayout = { inputs: SwapInput[]; outputs: SwapOutput[]; feeSats: number };

/**
 * Build the atomic swap layout (taker funds the fee by default).
 * Inputs: [maker asset, taker asset, ...taker funding]
 * Outputs: [taker gets maker asset, maker gets taker asset, sweetener?, taker change?]
 * Both asset inscriptions must sit at offset 0 so postage carries them intact.
 */
export function buildSwapLayout(args: {
  ticket: BarterTicket;
  maker: AssetFacts;
  taker: AssetFacts;
  takerAddress: string;
  takerChange: string;
  funding: { outpoint: string; value: number }[];
  feeSats: number;
}): SwapLayout | { error: string } {
  const { ticket, maker, taker, funding, feeSats } = args;
  const bad = ticketProblem(ticket);
  if (bad) return { error: bad };
  if (maker.outpoint !== ticket.offeringOutpoint || maker.inscriptionId !== ticket.offeringInscription)
    return { error: "maker asset moved since ticket" };
  if (maker.spent) return { error: "maker asset spent" };
  if (!matchesCriteria(ticket.criteria, taker)) return { error: "taker asset does not match criteria" };
  if (maker.offset !== 0 || taker.offset !== 0) return { error: "inscription not at offset 0" };
  if (maker.outpoint === taker.outpoint) return { error: "same UTXO on both sides" };
  if (funding.some((f) => f.outpoint === maker.outpoint || f.outpoint === taker.outpoint))
    return { error: "asset UTXO used as funding" };
  if (!Number.isInteger(feeSats) || feeSats <= 0) return { error: "bad fee" };

  const fundIn = funding.reduce((s, f) => s + f.value, 0);
  const takerPays = feeSats + (ticket.sweetenerDir === "demand" ? ticket.sweetenerSats : 0);
  const makerSweetener = ticket.sweetenerDir === "give" ? ticket.sweetenerSats : 0;
  // A maker-given sweetener would need maker funding; this draft only supports taker-paid sweeteners.
  if (makerSweetener > 0) return { error: "maker sweetener needs maker funding (not supported yet)" };
  const change = fundIn - takerPays;
  if (change < 0) return { error: "funding too small" };

  const outputs: SwapOutput[] = [
    { address: args.takerAddress, value: maker.value },
    { address: ticket.makerAddress, value: taker.value },
  ];
  if (ticket.sweetenerDir === "demand" && ticket.sweetenerSats > 0)
    outputs.push({ address: ticket.makerAddress, value: ticket.sweetenerSats });
  if (change >= DUST_SATS) outputs.push({ address: args.takerChange, value: change });

  const inputs: SwapInput[] = [
    { outpoint: maker.outpoint, value: maker.value, owner: "maker" },
    { outpoint: taker.outpoint, value: taker.value, owner: "taker" },
    ...funding.map((f) => ({ ...f, owner: "taker" as const })),
  ];
  const outSum = outputs.reduce((s, o) => s + o.value, 0);
  const inSum = inputs.reduce((s, i) => s + i.value, 0);
  return { inputs, outputs, feeSats: inSum - outSum };
}

/** Maker-side check before co-signing: each party gets exactly the agreed asset and postage. */
export function verifyLayoutForMaker(l: SwapLayout, ticket: BarterTicket, taker: AssetFacts): string | null {
  const [i0, i1] = l.inputs;
  const [o0, o1] = l.outputs;
  if (!i0 || !i1 || !o0 || !o1) return "layout too short";
  if (i0.outpoint !== ticket.offeringOutpoint || i0.owner !== "maker") return "input 0 is not the offered asset";
  if (i1.outpoint !== taker.outpoint) return "input 1 is not the matched asset";
  if (o0.value !== i0.value) return "offered asset postage changed";
  if (o1.address !== ticket.makerAddress || o1.value !== i1.value) return "maker does not receive matched asset intact";
  if (l.inputs.slice(2).some((i) => i.owner !== "taker")) return "maker funding pulled in";
  if (ticket.sweetenerDir === "demand" && ticket.sweetenerSats > 0) {
    const paid = l.outputs.slice(2).some((o) => o.address === ticket.makerAddress && o.value >= ticket.sweetenerSats);
    if (!paid) return "sweetener missing";
  }
  if (l.feeSats <= 0) return "no miner fee";
  return null;
}

/**
 * Checks a chain-read satpoint ("txid:vout:offset") before an asset may be offered or matched.
 * Supported: the inscription sits at offset 0 of the very UTXO we expect, that UTXO carries
 * no other inscription, and its postage is at least dust. Anything else is refused.
 */
export function satpointProblem(args: {
  outpoint: string;
  value: number;
  satpoint: string | null;
  inscriptionsInUtxo: number;
}): string | null {
  if (!args.satpoint) return "position could not be read from chain";
  const m = /^([0-9a-f]{64}):(\d+):(\d+)$/.exec(args.satpoint);
  if (!m) return "unreadable position";
  if (`${m[1]}:${m[2]}` !== args.outpoint) return "inscription has moved to another output";
  if (Number(m[3]) !== 0) return `inscription sits at sat ${m[3]}, not the first sat`;
  if (args.inscriptionsInUtxo !== 1) return `output holds ${args.inscriptionsInUtxo} inscriptions; trading one would move them all`;
  if (args.value < DUST_SATS) return "output below dust";
  return null;
}

/** Nostr tags for a ticket (kind 30403). The Nostr key is only a messenger. */
export function ticketTags(t: BarterTicket): string[][] {
  return [
    ["d", `barter:${t.offeringOutpoint}`],
    ["t", BARTER_TAG],
    ["maker_address", t.makerAddress],
    ["offering_outpoint", t.offeringOutpoint],
    ["offering_inscription", t.offeringInscription],
    ["offering_value", String(t.offeringValue)],
    ["sweetener_sats", String(t.sweetenerSats)],
    ["sweetener_dir", t.sweetenerDir],
    ["criteria_rules", JSON.stringify(t.criteria)],
  ];
}
