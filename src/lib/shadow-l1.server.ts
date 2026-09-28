/**
 * Shielded OP_RETURN notes on Bitcoin L1 (direct protocol, Option 2).
 *
 * A note is one ordinary Bitcoin transaction: output 0 is the 43-byte SHAD
 * OP_RETURN envelope, output 1 pays the territory anchor fee, output 2 is the
 * payer's change. The payer signs with their own wallet; nothing is custodial.
 *
 * Only hashes reach the chain. The salt and nullifier secret behind a pass stay
 * in the holder's browser, so an anchored pass proves a pass exists without
 * linking it to any wallet or account.
 */
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import {
  buildPaymentPsbt,
  byteArrayToHex,
  extractRawTxHex,
  finalizeSignedPsbt,
  inputSignatureReport,
  psbtOutputs,
  type FundingUtxo,
} from "@/lib/psbt-buyer";
import { broadcastRawTransaction } from "@/lib/purchase.server";
import { encodeShadowNote, shadowNoteScriptHex, type ShadowOp } from "@/lib/shadow-wire";
import {
  SHADOW_GATE_ANCHOR_SATS,
  SHADOW_PASS_ANCHOR_SATS,
  SHADOW_L1_TREASURY,
  type ShadowL1Note,
} from "@/lib/shadow-l1";

const ESPLORA_HOSTS = [
  "https://mempool.space/api",
  "https://blockstream.info/api",
  "https://mempool.emzy.de/api",
];
const UA = "bitmapwin-shadow/1.0";
const HEX64 = /^[0-9a-f]{64}$/;

async function esplora<T>(path: string): Promise<T | null> {
  for (const host of ESPLORA_HOSTS) {
    try {
      const resp = await fetch(`${host}${path}`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) continue;
      return (await resp.json()) as T;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function feeRate(): Promise<number> {
  const fees = await esplora<{ halfHourFee?: number; fastestFee?: number }>("/v1/fees/recommended");
  const rate = Number(fees?.halfHourFee ?? fees?.fastestFee ?? 0);
  return rate > 0 ? rate : 4;
}

type EsploraUtxo = { txid: string; vout: number; value: number; status?: { confirmed?: boolean } };

const anchorSats = (op: ShadowOp) => (op === "gate" ? SHADOW_GATE_ANCHOR_SATS : SHADOW_PASS_ANCHOR_SATS);

type NoteTarget = { op: ShadowOp; slug: string; height: number; index: number; digest: string };

export type ShadowNoteQuote = {
  payloadHex: string;
  scriptHex: string;
  psbtBase64: string;
  signIndices: number[];
  anchorSats: number;
  minerFeeSats: number;
  feeRate: number;
  totalSats: number;
  treasury: string;
};

/** Builds the note transaction against the payer's live confirmed UTXO set. */
export async function quoteShadowNote(input: {
  target: NoteTarget;
  payerAddress: string;
  tapInternalKeyHex?: string | undefined;
  paymentPublicKeyHex?: string | string[] | undefined;
}): Promise<ShadowNoteQuote> {
  const payloadHex = encodeShadowNote({
    op: input.target.op,
    height: input.target.height,
    index: input.target.index,
    digest: input.target.digest,
  });
  const scriptHex = shadowNoteScriptHex(payloadHex);

  const utxos = await esplora<EsploraUtxo[]>(`/address/${input.payerAddress}/utxo`);
  if (utxos === null) throw new Error("COULD NOT READ YOUR WALLET FUNDS — TRY AGAIN SHORTLY");
  const payerScriptHex = byteArrayToHex(addressToScriptPubKey(input.payerAddress));
  const funding: FundingUtxo[] = utxos
    .filter((u) => u.status?.confirmed !== false && Number(u.value) > 546)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 8)
    .map((u) => ({ txid: u.txid, vout: u.vout, valueSats: Number(u.value), scriptPubKeyHex: payerScriptHex }));
  if (funding.length === 0) throw new Error("NO CONFIRMED SATS IN THIS WALLET TO WRITE THE NOTE");

  const rate = await feeRate();
  const fee = anchorSats(input.target.op);
  const built = buildPaymentPsbt({
    funding,
    payerScriptHex,
    outputs: [
      { scriptHex, valueSats: 0 },
      { scriptHex: byteArrayToHex(addressToScriptPubKey(SHADOW_L1_TREASURY)), valueSats: fee },
    ],
    feeRate: rate,
    tapInternalKeyHex: input.tapInternalKeyHex,
    paymentPublicKeyHex: input.paymentPublicKeyHex,
  });

  return {
    payloadHex,
    scriptHex,
    psbtBase64: built.psbtBase64,
    signIndices: built.signIndices,
    anchorSats: fee,
    minerFeeSats: built.feeSats,
    feeRate: rate,
    totalSats: fee + built.feeSats,
    treasury: SHADOW_L1_TREASURY,
  };
}

/**
 * Finalizes the signed note transaction, refuses to broadcast anything whose
 * OP_RETURN payload or anchor payout was altered, then broadcasts and records it.
 */
export async function submitShadowNote(input: {
  target: NoteTarget;
  psbtBase64: string;
}): Promise<{ ok: boolean; reason?: string; txid?: string }> {
  const payloadHex = encodeShadowNote({
    op: input.target.op,
    height: input.target.height,
    index: input.target.index,
    digest: input.target.digest,
  });
  const scriptHex = shadowNoteScriptHex(payloadHex);

  const finalized = finalizeSignedPsbt(input.psbtBase64.replace(/\s+/g, ""));
  const unsigned = inputSignatureReport(finalized).filter((r) => !r.isFinal);
  if (unsigned.length > 0) {
    return { ok: false, reason: "YOUR WALLET DID NOT SIGN EVERY INPUT — APPROVE ALL OF THEM AND RETRY" };
  }

  const outs = psbtOutputs(finalized);
  if (outs[0]?.scriptHex !== scriptHex || Number(outs[0]?.valueSats) !== 0) {
    return { ok: false, reason: "REFUSING TO BROADCAST: THE SHIELDED NOTE WAS ALTERED" };
  }
  const treasuryScript = byteArrayToHex(addressToScriptPubKey(SHADOW_L1_TREASURY));
  if (outs[1]?.scriptHex !== treasuryScript || Number(outs[1]?.valueSats) < anchorSats(input.target.op)) {
    return { ok: false, reason: "REFUSING TO BROADCAST: THE ANCHOR PAYMENT WAS ALTERED" };
  }

  const rawHex = extractRawTxHex(finalized);
  if (!rawHex) return { ok: false, reason: "THE SIGNED TRANSACTION COULD NOT BE ASSEMBLED — RETRY" };

  const result = await broadcastRawTransaction(rawHex);
  if ("error" in result) return { ok: false, reason: `BITCOIN REJECTED THE NOTE: ${result.error.toUpperCase()}` };

  const db = await admin();
  await db.from("shadow_l1_notes").insert({
    op: input.target.op,
    slug: input.target.slug,
    territory_block: input.target.height,
    pass_index: input.target.index,
    digest_hex: input.target.digest,
    payload_hex: payloadHex,
    txid: result.txid,
  });
  return { ok: true, txid: result.txid };
}

const rowToNote = (r: {
  op: string;
  slug: string;
  territory_block: number | string;
  pass_index: number;
  digest_hex: string;
  payload_hex: string;
  txid: string;
  status: string;
  confirmed_height: number | string | null;
  created_at: string;
}): ShadowL1Note => ({
  op: r.op as ShadowL1Note["op"],
  slug: r.slug,
  territoryBlock: Number(r.territory_block),
  passIndex: r.pass_index,
  digestHex: r.digest_hex,
  payloadHex: r.payload_hex,
  txid: r.txid,
  status: r.status as ShadowL1Note["status"],
  confirmedHeight: r.confirmed_height === null ? null : Number(r.confirmed_height),
  createdAt: r.created_at,
});

const NOTE_COLUMNS =
  "op, slug, territory_block, pass_index, digest_hex, payload_hex, txid, status, confirmed_height, created_at";

/** Confirms any still-unconfirmed note against the chain before reading. */
async function refreshPending(notes: ShadowL1Note[]): Promise<ShadowL1Note[]> {
  const pending = notes.filter((n) => n.status === "broadcast").slice(0, 8);
  if (pending.length === 0) return notes;
  const db = await admin();
  const patched = new Map<string, ShadowL1Note>();
  await Promise.all(
    pending.map(async (note) => {
      const tx = await esplora<{ status?: { confirmed?: boolean; block_height?: number } }>(`/tx/${note.txid}`);
      if (!tx?.status?.confirmed) return;
      const height = Number(tx.status.block_height ?? 0) || null;
      await db
        .from("shadow_l1_notes")
        .update({ status: "confirmed", confirmed_height: height })
        .eq("txid", note.txid);
      patched.set(note.txid, { ...note, status: "confirmed", confirmedHeight: height });
    }),
  );
  return notes.map((n) => patched.get(n.txid) ?? n);
}

/** Every anchored note for a gate. Public chain data only. */
export async function readShadowNotes(slug: string): Promise<ShadowL1Note[]> {
  const db = await admin();
  const { data } = await db
    .from("shadow_l1_notes")
    .select(NOTE_COLUMNS)
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(200);
  return refreshPending((data ?? []).map(rowToNote));
}

/** The note anchoring one specific commitment or nullifier, if any. */
export async function readShadowNoteByDigest(digest: string): Promise<ShadowL1Note | null> {
  if (!HEX64.test(digest)) return null;
  const db = await admin();
  const { data } = await db.from("shadow_l1_notes").select(NOTE_COLUMNS).eq("digest_hex", digest).maybeSingle();
  if (!data) return null;
  const [note] = await refreshPending([rowToNote(data)]);
  return note ?? null;
}

/** Resolves the gate a note belongs to and checks who may anchor it. */
export async function gateForNote(slug: string) {
  const db = await admin();
  const { data } = await db
    .from("shadow_events")
    .select("slug, title, territory_block, max_passes, passes_issued, is_active, issuer_user_id")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}
