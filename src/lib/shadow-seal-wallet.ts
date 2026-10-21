/**
 * Wallet side of Shadow Seal: picking a seal coin, preparing the one spend
 * that moves a whole bundle, and the device storage for sealed notes.
 * BITMAPWIN only prepares the transaction. The holder's wallet signs it and the
 * holder broadcasts it themselves.
 *
 * Spend layout (fixed):
 *   input 0  = the seal coin
 *   output 0 = back to the holder's own address → the new seal for KEPT notes
 *              (first so the coin's sats, and anything on them, stay with the holder)
 *   output 1 = OP_RETURN BWSEAL1 + commitment over every note in the bundle
 */
import { Address, NETWORK, OutScript, Transaction } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import {
  anchorCommitment, anchorScript, blindSeal, noteKey, planAnchor,
  type Consignment, type Reveal, type SealRef,
} from "@/lib/shadow-seal";

export const KEEP_VOUT = 0;
export const DUST = 546;
/** One input, one change output, one OP_RETURN — rounded up. */
export const SEAL_SPEND_VBYTES = 180;

export type Coin = { txid: string; vout: number; value: number; confirmed: boolean };
export type HeldSealed = { c: Consignment; mine: Reveal };

export const sealFee = (feeRate: number) => Math.ceil(Math.max(1, feeRate) * SEAL_SPEND_VBYTES);

export function buildSealSpendPsbt(o: {
  coin: Coin; address: string; tapInternalKeyHex?: string | undefined; commitment: string; feeRate: number;
}): { psbt: string; keepValue: number; fee: number } {
  const fee = sealFee(o.feeRate);
  const keepValue = o.coin.value - fee;
  if (keepValue < DUST) throw new Error(`THIS COIN IS TOO SMALL — NEEDS AT LEAST ${fee + DUST} SATS`);
  const script = OutScript.encode(Address(NETWORK).decode(o.address));
  const type = OutScript.decode(script).type;
  if (type !== "tr" && type !== "wpkh") throw new Error("USE A TAPROOT (bc1p) OR NATIVE SEGWIT (bc1q) ADDRESS");
  if (type === "tr" && !o.tapInternalKeyHex) throw new Error("WALLET DID NOT SHARE ITS TAPROOT KEY — RECONNECT IT");
  const tx = new Transaction({ allowUnknownOutputs: true });
  tx.addInput({
    txid: o.coin.txid, index: o.coin.vout,
    witnessUtxo: { script, amount: BigInt(o.coin.value) },
    ...(type === "tr" ? { tapInternalKey: hex.decode(o.tapInternalKeyHex!) } : {}),
  });
  tx.addOutput({ script, amount: BigInt(keepValue) });
  tx.addOutput({ script: hex.decode(anchorScript(o.commitment)), amount: 0n });
  return { psbt: base64.encode(tx.toPSBT()), keepValue, fee };
}

/** Finalises the wallet-signed PSBT and returns the raw tx for the holder to broadcast. */
export function finishSigned(signedB64: string, expectedCommitment: string): { txid: string; rawHex: string } {
  const tx = Transaction.fromPSBT(base64.decode(signedB64), { allowUnknownOutputs: true });
  try { tx.finalize(); } catch { /* wallet may have finalised already */ }
  const out = tx.getOutput(1);
  if (!out.script || hex.encode(out.script) !== anchorScript(expectedCommitment)) throw new Error("THE SIGNED TRANSACTION LOST ITS SEAL RECORD");
  return { txid: tx.id, rawHex: tx.hex };
}

/** Plans the bundle spend: every note on the coin is GIVEN (to a receive code) or KEPT on output 0. */
export function planBundle(held: HeldSealed[], give: Record<string, string>) {
  const keys = held.map((h) => noteKey(h.c.note.genesis));
  const sendTo: Record<string, SealRef> = {};
  for (const [k, code] of Object.entries(give)) {
    const hash = parseSealReceive(code);
    if (!hash) throw new Error("A RECEIVE CODE IS NOT VALID");
    sendTo[k] = { kind: "blind", hash };
  }
  const assignments = planAnchor(keys, sendTo, KEEP_VOUT);
  return { assignments, commitment: anchorCommitment(assignments) };
}

/** After signing: kept notes move to output 0, given notes become codes for their recipients. */
export function applySpend(held: HeldSealed[], assignments: ReturnType<typeof planBundle>["assignments"], txid: string) {
  const step = { txid, assignments };
  const kept: HeldSealed[] = [], sent: { label: string; code: string }[] = [];
  for (const h of held) {
    const a = assignments.find((x) => x.note === noteKey(h.c.note.genesis))!;
    const c: Consignment = { note: h.c.note, steps: [...h.c.steps, step], reveals: [...h.c.reveals, h.mine] };
    if (a.to.kind === "witness") kept.push({ c, mine: { txid, vout: a.to.vout, salt: "" } });
    else sent.push({ label: h.c.note.label, code: encodeConsignment(c) });
  }
  return { kept, sent };
}

export const sealReceiveCode = (r: Reveal) => `SEAL-RECV-v1.${blindSeal(r)}`;
export const parseSealReceive = (s: string) => /^SEAL-RECV-v1\.([0-9a-f]{64})$/.exec(s.trim())?.[1] ?? null;
export const encodeConsignment = (c: Consignment) => `SEAL-NOTE-v1.${base64.encode(new TextEncoder().encode(JSON.stringify(c)))}`;
export function decodeConsignment(s: string): Consignment | null {
  const m = /^SEAL-NOTE-v1\.(.+)$/.exec(s.trim());
  if (!m) return null;
  try { return JSON.parse(new TextDecoder().decode(base64.decode(m[1]!))) as Consignment; } catch { return null; }
}

/* ── coins ── */
export async function listCoins(address: string): Promise<Coin[]> {
  const r = await fetch(`https://mempool.space/api/address/${address}/utxo`);
  if (!r.ok) throw new Error("COULD NOT READ YOUR COINS");
  const list = (await r.json()) as { txid: string; vout: number; value: number; status: { confirmed: boolean } }[];
  return list.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.status.confirmed })).sort((a, b) => b.value - a.value);
}

/** Refuses coins that carry inscriptions or runes, or when that can't be checked. */
export async function assertPlainCoin(c: { txid: string; vout: number }) {
  const r = await fetch(`https://ordinals.com/output/${c.txid}:${c.vout}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("COULD NOT CHECK THIS COIN FOR INSCRIPTIONS — TRY AGAIN");
  const j = (await r.json()) as { inscriptions?: unknown[]; runes?: unknown };
  const runes = Array.isArray(j.runes) ? j.runes.length : j.runes && typeof j.runes === "object" ? Object.keys(j.runes).length : 0;
  if ((j.inscriptions?.length ?? 0) > 0 || runes > 0) throw new Error("THIS COIN CARRIES AN INSCRIPTION OR RUNE — PICK A PLAIN COIN");
}

/* ── device storage ── */
const K = { held: "bitmapwin:sealed-notes", recv: "bitmapwin:sealed-recv", sent: "bitmapwin:sealed-sent", undo: "bitmapwin:sealed-undo" };
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
export const sealStore = {
  held: () => read<HeldSealed[]>(K.held, []), setHeld: (v: HeldSealed[]) => write(K.held, v),
  recv: () => read<Record<string, Reveal>>(K.recv, {}), setRecv: (v: Record<string, Reveal>) => write(K.recv, v),
  sent: () => read<{ label: string; code: string; at: string }[]>(K.sent, []), setSent: (v: { label: string; code: string; at: string }[]) => write(K.sent, v),
  undo: () => read<Record<string, HeldSealed[]>>(K.undo, {}), setUndo: (v: Record<string, HeldSealed[]>) => write(K.undo, v),
};
export const sealKey = (r: { txid: string; vout: number }) => `${r.txid}:${r.vout}`;
