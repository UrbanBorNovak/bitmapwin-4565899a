/**
 * Unsigned relic reveal preview. Built only from a passing planRelicMint;
 * signing stays disabled until the relic viewer inscription is verified.
 */
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { dustLimit, planRelicMint, revealPaysPlan, type RelicPlanInput } from "@/lib/relic-mint-guard";
import type { ParentSpend } from "@/lib/ord-parents";

/** Set only after the master viewer inscription exists and is checked on chain. */
export const RELIC_VIEWER_INSCRIPTION_ID: string | null = null;
export function viewerVerified(id: string | null, onChainContentType: string | null): boolean {
  return !!id && /^[0-9a-f]{64}i\d+$/.test(id) && !!onChainContentType && onChainContentType.startsWith("text/html");
}

const OUT_VBYTES: Record<string, number> = { pkh: 34, sh: 32, wpkh: 31, wsh: 43, tr: 43 };
const outType = (a: string) => btc.OutScript.decode(btc.OutScript.encode(btc.Address(btc.NETWORK).decode(a))).type;

export type PreviewOutput = { role: "BITMAP PARENT" | "COLLECTION PARENT" | "RELIC" | "HOLDER" | "TREASURY"; address: string; sats: number; dust: number };
export type RelicPreview = {
  ok: true; psbtHex: string; parents: { role: string; inscriptionId: string; address: string }[];
  outputs: PreviewOutput[]; vbytes: number; feeRate: number; minerFee: number; tribute: number; signingEnabled: boolean; signingNote: string;
};

/**
 * Inputs: both parent spends. Outputs: each parent returned to its holder,
 * the relic to the minter, then holder + treasury tribute. Funding input is
 * added by the wallet later; the fee is estimated here and shown.
 */
export function buildRelicPreview(i: Omit<RelicPlanInput, "parents"> & { parents: ParentSpend[]; minterAddress: string; feeRate: number; metadataBytes: number; viewerOk: boolean }):
  RelicPreview | { ok: false; message: string } {
  const plan = planRelicMint(i);
  if (!plan.ok) return { ok: false, message: plan.message };
  if (!(i.feeRate >= 1 && i.feeRate <= 2000)) return { ok: false, message: "FEE RATE OUT OF RANGE" };
  if (dustLimit(i.minterAddress) === null) return { ok: false, message: "MINTER ADDRESS NOT RECOGNISED" };
  const bm = i.parents.find((p) => p.inscriptionId.toLowerCase() === i.bitmapParentId!.toLowerCase())!;
  const col = i.parents.find((p) => p.inscriptionId.toLowerCase() === i.masterInscriptionId!.toLowerCase())!;
  const outputs: PreviewOutput[] = [
    { role: "BITMAP PARENT", address: bm.address, sats: bm.value, dust: dustLimit(bm.address) ?? 0 },
    { role: "COLLECTION PARENT", address: col.address, sats: col.value, dust: dustLimit(col.address) ?? 0 },
    { role: "RELIC", address: i.minterAddress, sats: 546, dust: dustLimit(i.minterAddress)! },
    ...plan.payouts.map((p) => ({ role: p.role, address: p.address, sats: p.sats, dust: dustLimit(p.address) ?? 0 })),
  ];
  for (const o of outputs) if (!o.dust || o.sats < o.dust) return { ok: false, message: `${o.role} OUTPUT ${o.sats} SATS IS BELOW ITS ${o.dust || "UNKNOWN"} SAT DUST LIMIT` };

  const tx = new btc.Transaction({ allowUnknownOutputs: true, allowUnknownInputs: true });
  for (const p of [bm, col]) tx.addInput({ txid: p.txid, index: p.vout, witnessUtxo: { script: btc.OutScript.encode(btc.Address(btc.NETWORK).decode(p.address)), amount: BigInt(p.value) } });
  for (const o of outputs) tx.addOutputAddress(o.address, BigInt(o.sats), btc.NETWORK);
  const paid = revealPaysPlan(tx, plan.payouts);
  if (!paid.ok) return { ok: false, message: paid.reason };

  // overhead + 2 parent key-path inputs + 1 funding input + outputs + inscription witness (¼ weight).
  const vbytes = Math.ceil(10.5 + 3 * 57.5 + outputs.reduce((s, o) => s + (OUT_VBYTES[outType(o.address)] ?? 43), 0) + (i.metadataBytes + 120) / 4);
  return {
    ok: true, psbtHex: hex.encode(tx.toPSBT()),
    parents: [{ role: "BITMAP", inscriptionId: bm.inscriptionId, address: bm.address }, { role: "COLLECTION", inscriptionId: col.inscriptionId, address: col.address }],
    outputs, vbytes, feeRate: i.feeRate, minerFee: Math.ceil(vbytes * i.feeRate), tribute: plan.total,
    signingEnabled: false, // stays off in this release regardless; enabling needs viewerOk AND a wallet flow
    signingNote: i.viewerOk ? "VIEWER VERIFIED — SIGNING NOT YET WIRED" : "SIGNING DISABLED — RELIC VIEWER INSCRIPTION NOT VERIFIED",
  };
}
