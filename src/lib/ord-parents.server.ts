/**
 * The BITMAPWIN master collection parent.
 *
 * The master inscription lives on a taproot address derived from the platform
 * seed. It is spent as a parent input of every creature reveal and returned to
 * the same address in the same transaction, which is what lets explorers group
 * every creature under one collection while each creature also keeps its own
 * `<height>.bitmap` parent.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { p2tr, Transaction } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { fetchParentSpend, pendingTransferOf, type ParentSpend } from "@/lib/ord-parents";

function collectionKey(): Uint8Array {
  const seed = process.env["SHORD_POOL_SEED"];
  if (!seed) throw new Error("THE COLLECTION KEY IS NOT CONFIGURED");
  return sha256(new TextEncoder().encode(`bitmapwin:collection:master:v1:${seed}`));
}

function collectionPayment() {
  const priv = collectionKey();
  const pub = schnorr.getPublicKey(priv);
  const pay = p2tr(pub);
  if (!pay.address) throw new Error("COULD NOT DERIVE THE COLLECTION ADDRESS");
  return { priv, pub, pay, address: pay.address };
}

export function collectionAddress(): string {
  return collectionPayment().address;
}

/**
 * The BITMAPWIN master collection root, inscribed and transferred to the
 * platform collection address. An env override stays available for testing.
 */
import { MASTER_PARENT_ID } from "@/lib/collection-parent";
const MASTER_PARENT_DEFAULT = MASTER_PARENT_ID;

export function masterParentInscriptionId(): string | null {
  const raw = (process.env["MASTER_PARENT_INSCRIPTION_ID"] ?? "").trim().toLowerCase();
  const id = raw || MASTER_PARENT_DEFAULT;
  return /^[0-9a-f]{64}i\d+$/.test(id) ? id : null;
}


/**
 * The master collection parent, ready to be spent. Returns null (with a reason)
 * when the master inscription is not configured yet or no longer sits on the
 * platform address — creature mints then fall back to the bitmap parent alone.
 */
export async function masterParentSpend(): Promise<{ spend: ParentSpend | null; reason: string | null; address: string }> {
  const { address, pub } = collectionPayment();
  const id = masterParentInscriptionId();
  if (!id) return { spend: null, reason: "THE MASTER COLLECTION INSCRIPTION IS NOT SET UP YET", address };
  const spend = await fetchParentSpend(id, "platform");
  if (!spend) return { spend: null, reason: "COULD NOT LOCATE THE MASTER COLLECTION INSCRIPTION RIGHT NOW", address };
  if (spend.address !== address) {
    const pending = await pendingTransferOf(spend.txid, spend.vout);
    if (pending) {
      return {
        spend: null,
        reason: `THE MASTER COLLECTION INSCRIPTION IS IN TRANSIT — AWAITING 1 CONFIRMATION (TX ${pending.txid.slice(0, 12)}…)`,
        address,
      };
    }
    return { spend: null, reason: "THE MASTER COLLECTION INSCRIPTION IS NOT HELD BY THE PLATFORM ADDRESS", address };
  }
  return { spend: { ...spend, tapInternalKey: hex.encode(pub) }, reason: null, address };
}


/**
 * Signs only the reveal inputs that spend the collection address, and only when
 * the transaction returns every satoshi of those inputs straight back to it.
 */
export async function signCollectionInputs(psbtBase64: string): Promise<{ ok: true; psbt: string } | { ok: false; reason: string }> {
  const { priv, pay, address } = collectionPayment();
  let tx: Transaction;
  try {
    tx = Transaction.fromPSBT(base64.decode(psbtBase64), { allowUnknown: true, allowUnknownInputs: true, allowUnknownOutputs: true });
  } catch {
    return { ok: false, reason: "THAT TRANSACTION COULD NOT BE READ" };
  }

  let ours = 0n;
  const indices: number[] = [];
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    const script = input.witnessUtxo?.script;
    if (script && hex.encode(script) === hex.encode(pay.script)) {
      indices.push(i);
      ours += input.witnessUtxo!.amount;
    }
  }
  if (indices.length === 0) return { ok: false, reason: "NOTHING IN THAT TRANSACTION BELONGS TO THE COLLECTION" };

  let returned = 0n;
  for (let i = 0; i < tx.outputsLength; i++) {
    const out = tx.getOutput(i);
    if (out.script && hex.encode(out.script) === hex.encode(pay.script)) returned += out.amount ?? 0n;
  }
  if (returned < ours) {
    return { ok: false, reason: `THE COLLECTION INSCRIPTION MUST COME BACK TO ${address}` };
  }

  try {
    for (const i of indices) tx.signIdx(priv, i);
  } catch (e) {
    return { ok: false, reason: `THE COLLECTION COULD NOT SIGN: ${(e as Error).message.slice(0, 120)}` };
  }
  return { ok: true, psbt: base64.encode(tx.toPSBT()) };
}
