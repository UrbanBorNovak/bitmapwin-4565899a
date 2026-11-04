/**
 * BW-BARTER-1 swap checks and assembly (server only). Every fact about either
 * asset is re-read live from ordinals.com / mempool.space; nothing a browser
 * sends about ownership, position, postage or height is trusted.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  matchesCriteria, satpointProblem, verifyLayoutForMaker,
  type AssetFacts, type BarterTicket, type SwapLayout,
} from "@/lib/barter-protocol";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { buildSwapPsbt, byteArrayToHex, type FundingUtxo } from "@/lib/psbt-buyer";
import { decodePsbt } from "@/lib/psbt";

const ORD = "https://ordinals.com";
const MEMPOOL = "https://mempool.space/api";
const UA = "bitmap-marketplace/1.0";
/** Refuse swaps whose fee rate looks like a mistake. */
export const SWAP_MAX_FEE_RATE = 500;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type LiveAsset = AssetFacts & { address: string };

/** Reads one inscription's live position and holder; returns a refusal reason or the facts. */
export async function liveAsset(inscriptionId: string, outpoint: string): Promise<LiveAsset | { error: string }> {
  const [ins, out] = await Promise.all([
    getJson<{ satpoint?: string; address?: string }>(`${ORD}/r/inscription/${inscriptionId}`),
    getJson<{ inscriptions?: string[]; spent?: boolean; value?: number; address?: string }>(`${ORD}/output/${outpoint}`),
  ]);
  if (!ins || !out) return { error: "chain could not be read" };
  if (out.spent) return { error: "output is spent" };
  const address = ins.address ?? out.address;
  if (!address) return { error: "holder could not be read" };
  const pos = satpointProblem({ outpoint, value: out.value ?? 0, satpoint: ins.satpoint ?? null, inscriptionsInUtxo: out.inscriptions?.length ?? 0 });
  if (pos) return { error: pos };
  const { data: row } = await supabaseAdmin
    .from("bitmap_index").select("block_height").eq("inscription_id", inscriptionId).eq("is_valid", true).maybeSingle();
  const facts: LiveAsset = {
    inscriptionId, outpoint, value: out.value ?? 0, offset: 0, spent: false, address,
    type: row ? "bitmap" : "ordinal",
  };
  if (row) facts.height = row.block_height;
  return facts;
}

async function feeRate(): Promise<number> {
  const j = await getJson<{ halfHourFee?: number }>(`${MEMPOOL}/v1/fees/recommended`);
  return Math.max(1, Math.min(SWAP_MAX_FEE_RATE, Math.ceil(j?.halfHourFee ?? 2)));
}

type EsploraUtxo = { txid: string; vout: number; value: number; status?: { confirmed?: boolean } };

async function carriesInscription(outpoint: string): Promise<boolean> {
  const j = await getJson<{ inscriptions?: string[]; runes?: unknown }>(`${ORD}/output/${outpoint}`);
  if (!j) return true; // unknown = do not spend
  const runes = j.runes && typeof j.runes === "object" ? Object.keys(j.runes as object).length : 0;
  return (j.inscriptions?.length ?? 0) > 0 || runes > 0;
}

export type SwapBuild = {
  psbtBase64: string; feeSats: number; feeRate: number; changeSats: number;
  takerAssetIndex: number; fundingIndices: number[];
};

/** Assembles the swap for a taker after live checks on both assets. */
export async function buildSwap(args: {
  ticket: BarterTicket;
  takerInscription: string; takerOutpoint: string;
  takerOrdinalsAddress: string; takerPaymentAddress: string;
  takerPublicKey?: string | undefined; takerPaymentPublicKey?: string | undefined;
}): Promise<SwapBuild> {
  const t = args.ticket;
  if (t.sweetenerDir === "give" && t.sweetenerSats > 0) throw new Error("Offers where the maker adds sats are not supported yet");
  const [maker, taker] = await Promise.all([liveAsset(t.offeringInscription, t.offeringOutpoint), liveAsset(args.takerInscription, args.takerOutpoint)]);
  if ("error" in maker) throw new Error(`Offered item: ${maker.error}`);
  if ("error" in taker) throw new Error(`Your item: ${taker.error}`);
  if (maker.address !== t.makerAddress) throw new Error("The maker no longer holds the offered item");
  if (maker.value !== t.offeringValue) throw new Error("Offered item postage changed since the offer");
  if (taker.address !== args.takerOrdinalsAddress) throw new Error("Your connected wallet does not hold that item");
  if (!matchesCriteria(t.criteria, taker)) throw new Error("Your item does not meet the offer's rules");
  if (maker.outpoint === taker.outpoint) throw new Error("Same output on both sides");

  const utxos = await getJson<EsploraUtxo[]>(`${MEMPOOL}/address/${args.takerPaymentAddress}/utxo`);
  if (!utxos) throw new Error("Could not read your payment UTXOs");
  const payScript = byteArrayToHex(addressToScriptPubKey(args.takerPaymentAddress));
  const funding: FundingUtxo[] = [];
  for (const u of utxos.filter((u) => u.status?.confirmed !== false && u.value > 546).sort((a, b) => b.value - a.value).slice(0, 10)) {
    const op = `${u.txid}:${u.vout}`;
    if (op === maker.outpoint || op === taker.outpoint) continue;
    if (await carriesInscription(op)) continue;
    funding.push({ txid: u.txid, vout: u.vout, valueSats: u.value, scriptPubKeyHex: payScript });
  }
  if (funding.length === 0) throw new Error("No plain confirmed sats in your payment address to pay the fee");

  const rate = await feeRate();
  const [mt, mv] = maker.outpoint.split(":");
  const [tt, tv] = taker.outpoint.split(":");
  const built = buildSwapPsbt({
    maker: { txid: mt!, vout: Number(mv), valueSats: maker.value, scriptPubKeyHex: byteArrayToHex(addressToScriptPubKey(maker.address)) },
    taker: { txid: tt!, vout: Number(tv), valueSats: taker.value, scriptPubKeyHex: byteArrayToHex(addressToScriptPubKey(taker.address)) },
    makerReceiveScriptHex: byteArrayToHex(addressToScriptPubKey(t.makerAddress)),
    takerReceiveScriptHex: byteArrayToHex(addressToScriptPubKey(args.takerOrdinalsAddress)),
    takerChangeScriptHex: payScript,
    funding, feeRate: rate,
    sweetenerSats: t.sweetenerDir === "demand" ? t.sweetenerSats : 0,
    takerTapKeyHex: args.takerPublicKey,
    takerPaymentTapKeyHex: /^bc1p/i.test(args.takerPaymentAddress) ? args.takerPaymentPublicKey ?? args.takerPublicKey : undefined,
    takerPublicKeyHex: [args.takerPaymentPublicKey, args.takerPublicKey].filter((k): k is string => !!k),
  });
  const verdict = await reviewSwap(built.psbtBase64, t);
  if (!verdict.ok) throw new Error(`Swap failed its own check: ${verdict.reason}`);
  return { ...built, feeRate: rate };
}

export type SwapReview =
  | { ok: true; layout: SwapLayout; taker: LiveAsset; feeSats: number; vsizeEstimate: number }
  | { ok: false; reason: string };

/**
 * The maker's (and broadcaster's) check of a swap PSBT: the layout gives each side
 * exactly the agreed asset, both assets are still where the PSBT says, the
 * taker's asset meets the criteria, and the fee is sane.
 */
export async function reviewSwap(psbtBase64: string, t: BarterTicket): Promise<SwapReview> {
  let d: ReturnType<typeof decodePsbt>;
  try { d = decodePsbt(psbtBase64); } catch { return { ok: false, reason: "not a valid PSBT" }; }
  if (d.inputs.some((i) => i.witnessValueSats === null)) return { ok: false, reason: "an input lacks its value" };
  if (d.outputs.some((o) => !o.address)) return { ok: false, reason: "an output has an unsupported script" };
  const i1 = d.inputs[1];
  if (!i1) return { ok: false, reason: "layout too short" };
  const takerIns = await getJson<{ id?: string; inscriptions?: string[] }>(`${ORD}/output/${i1.outpoint}`);
  const takerId = takerIns?.inscriptions?.[0];
  if (!takerId) return { ok: false, reason: "matched item could not be read" };
  const [maker, taker] = await Promise.all([liveAsset(t.offeringInscription, t.offeringOutpoint), liveAsset(takerId, i1.outpoint)]);
  if ("error" in maker) return { ok: false, reason: `offered item: ${maker.error}` };
  if ("error" in taker) return { ok: false, reason: `matched item: ${taker.error}` };
  if (maker.address !== t.makerAddress) return { ok: false, reason: "maker no longer holds the offered item" };
  if (!matchesCriteria(t.criteria, taker)) return { ok: false, reason: "matched item does not meet the rules" };

  const layout: SwapLayout = {
    inputs: d.inputs.map((i, n) => ({ outpoint: i.outpoint, value: i.witnessValueSats!, owner: n === 0 ? "maker" : "taker" })),
    outputs: d.outputs.map((o) => ({ address: o.address!, value: o.valueSats })),
    feeSats: d.inputs.reduce((s, i) => s + i.witnessValueSats!, 0) - d.totalOutSats,
  };
  if (layout.inputs[0]?.value !== maker.value || layout.inputs[1]?.value !== taker.value) return { ok: false, reason: "input values differ from chain" };
  if (layout.outputs[0]?.address !== taker.address) return { ok: false, reason: "offered item is not sent to the matched item's holder" };
  const bad = verifyLayoutForMaker(layout, t, taker);
  if (bad) return { ok: false, reason: bad };
  // No output may pay the maker's input back to the taker beyond the agreed layout.
  const extra = layout.outputs.slice(2).filter((o) => o.address !== t.makerAddress && o.address !== layout.outputs[0]!.address);
  if (extra.length > 1) return { ok: false, reason: "unexpected extra outputs" };
  const vsizeEstimate = 11 + layout.inputs.length * 58 + layout.outputs.length * 43;
  if (layout.feeSats / vsizeEstimate > SWAP_MAX_FEE_RATE) return { ok: false, reason: "fee is unreasonably high" };
  return { ok: true, layout, taker, feeSats: layout.feeSats, vsizeEstimate };
}
