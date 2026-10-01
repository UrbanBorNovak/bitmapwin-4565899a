/**
 * Ordinals inscriber for Shadow artifacts, fully in the browser.
 *
 * Commit: the holder's wallet pays a one-time taproot address whose script
 * carries the inscription. Reveal: a throwaway key made on this device spends
 * that output, putting the artifact on Bitcoin and sending the inscribed sat
 * to the holder's ordinals address. The throwaway key is saved locally as a
 * recovery record until the reveal is broadcast — nothing is custodial.
 */
import * as btc from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { OutOrdinalReveal, p2tr_ord_reveal } from "micro-ordinals";
import { outScriptForAddress, type ParentSpend } from "@/lib/ord-parents";

export const INSCRIBE_POSTAGE = 546;
export const INSCRIBE_MAX_BYTES = 60_000;
const ESPLORA = ["https://blockstream.info/api", "https://mempool.space/api", "https://mempool.emzy.de/api"];
const customScripts = [OutOrdinalReveal];

export type InscribeJob = {
  digest: string;
  privHex: string;
  commitAddress: string;
  contentType: string;
  bodyHex: string;
  receiveAddress: string;
  feeRate: number;
  revealFee: number;
  commitAmount: number;
  /** parent inscriptions claimed by this child, spent and returned in the reveal */
  parents?: ParentSpend[];
  /** tag 11: render this inscription with another inscription's code (near-zero bytes) */
  delegate?: string;
  commitTxid?: string;
  revealTxid?: string;
  createdAt: string;
};


/** Signs the parent inputs it owns in a reveal PSBT, without finalizing. */
export type ParentSigners = {
  wallet?: (psbtBase64: string, indices: number[]) => Promise<string>;
  platform?: (psbtBase64: string, indices: number[]) => Promise<string>;
};


const KEY = (digest: string) => `bitmapwin:shadow-inscribe:${digest}`;
export const loadJob = (digest: string): InscribeJob | null => {
  try {
    const raw = localStorage.getItem(KEY(digest));
    return raw ? (JSON.parse(raw) as InscribeJob) : null;
  } catch {
    return null;
  }
};
export const saveJob = (job: InscribeJob) => localStorage.setItem(KEY(job.digest), JSON.stringify(job));
export const clearJob = (digest: string) => localStorage.removeItem(KEY(digest));

async function esplora(path: string, init?: RequestInit): Promise<Response | null> {
  for (const host of ESPLORA) {
    try {
      const r = await fetch(`${host}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
      if (r.ok) return r;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

export async function liveFeeRate(): Promise<number> {
  const r = await esplora("/v1/fees/recommended");
  if (r) {
    const j = (await r.json()) as { halfHourFee?: number };
    if (j.halfHourFee && j.halfHourFee > 0) return j.halfHourFee;
  }
  const e = await esplora("/fee-estimates");
  const j = e ? ((await e.json()) as Record<string, number>) : {};
  return Math.max(1, Math.ceil(j["3"] ?? 2));
}

/** The made-for-you artifact: drawn purely from the pass's public note fields. */
export function passArtifactSvg(p: { slug: string; height: number; index: number; digest: string }): string {
  const cells: string[] = [];
  for (let i = 0; i < 64; i++) {
    const v = parseInt(p.digest.slice((i % 32) * 2, (i % 32) * 2 + 2), 16);
    if ((v >> (i >> 5)) & 1) {
      const x = 40 + (i % 8) * 40;
      const y = 60 + Math.floor(i / 8) * 40;
      cells.push(`<rect x="${x}" y="${y}" width="36" height="36" fill="${v % 3 === 0 ? "#f7931a" : "#3fe0d0"}" opacity="${(0.35 + (v % 60) / 100).toFixed(2)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460"><rect width="400" height="460" fill="#07090b"/><rect x="20" y="40" width="360" height="360" fill="none" stroke="#3fe0d0" stroke-opacity=".35"/>${cells.join("")}<text x="20" y="28" fill="#f7931a" font-family="monospace" font-size="14">SHAD · ${p.height}.BITMAP · #${p.index}</text><text x="20" y="424" fill="#3fe0d0" font-family="monospace" font-size="10">${p.slug.toUpperCase()}</text><text x="20" y="442" fill="#8a949c" font-family="monospace" font-size="7">${p.digest}</text></svg>`;
}

function revealPayment(
  privHex: string,
  contentType: string,
  body: Uint8Array,
  digest: string,
  parents: ParentSpend[] = [],
  delegate?: string,
) {
  const pub = btc.utils.pubSchnorr(hex.decode(privHex));
  // Tag 3 may repeat: one entry per parent, in the order the reveal spends them.
  // Tag 11 (delegate) points at the master generator; the body then stays empty.
  const tags = {
    ...(delegate ? {} : { contentType }),
    metaprotocol: `shad:${digest}`,
    ...(parents.length ? { parent: parents.map((p) => p.inscriptionId) } : {}),
    ...(delegate ? { delegate } : {}),
  } as never;
  const inscription = { tags, body };
  return btc.p2tr(undefined, p2tr_ord_reveal(pub, [inscription]), btc.NETWORK, false, customScripts);
}

/** Creates the throwaway key, commit address and exact fees. Saves the recovery record. */
export async function prepareJob(input: {
  digest: string;
  contentType: string;
  body: Uint8Array;
  receiveAddress: string;
  parents?: ParentSpend[];
  /** tag 11 target: the body is dropped and the master generator renders this child */
  delegate?: string;
}): Promise<InscribeJob> {
  if (input.body.length > INSCRIBE_MAX_BYTES) throw new Error("FILE TOO LARGE — KEEP IT UNDER 60 KB");
  const parents = input.parents ?? [];
  const delegate = input.delegate?.trim() || undefined;
  const body = delegate ? new Uint8Array(0) : input.body;
  const priv = btc.utils.randomPrivateKeyBytes();
  const privHex = hex.encode(priv);
  const pay = revealPayment(privHex, input.contentType, body, input.digest, parents, delegate);
  const feeRate = await liveFeeRate();
  // witness bytes count a quarter; ~ 150 vB of fixed overhead for 1-in/1-out taproot.
  // Each parent adds one taproot input (~58 vB) and its pass-through output (~43 vB).
  const parentIds = parents.reduce((n, p) => n + p.inscriptionId.length, 0);
  const tagBytes = parentIds + (delegate ? 36 : input.contentType.length) + 120;
  const vbytes = Math.ceil((body.length + tagBytes) / 4) + 150 + parents.length * 101;
  const revealFee = Math.ceil(vbytes * feeRate);
  const job: InscribeJob = {
    digest: input.digest,
    privHex,
    commitAddress: pay.address!,
    contentType: input.contentType,
    bodyHex: hex.encode(body),
    receiveAddress: input.receiveAddress,
    feeRate,
    revealFee,
    commitAmount: INSCRIBE_POSTAGE + revealFee,
    ...(parents.length ? { parents } : {}),
    ...(delegate ? { delegate } : {}),
    createdAt: new Date().toISOString(),
  };
  saveJob(job);
  return job;
}


/** Finds the commit output once it has reached a public mempool. */
export async function findCommitOutput(job: InscribeJob): Promise<{ txid: string; vout: number; value: number } | null> {
  const r = await esplora(`/address/${job.commitAddress}/utxo`);
  if (!r) return null;
  const utxos = (await r.json()) as { txid: string; vout: number; value: number }[];
  return utxos.find((u) => u.value >= job.commitAmount) ?? null;
}

/**
 * Signs the reveal and broadcasts it.
 *
 * Input 0 is the commit output, signed here by the throwaway key. Every claimed
 * parent follows as its own input and is handed straight back to its holder in
 * the matching output, so the wallet holding the bitmap and the platform key
 * holding the collection inscription each sign only their own input.
 */
export async function revealJob(
  job: InscribeJob,
  utxo: { txid: string; vout: number; value: number },
  signers: ParentSigners = {},
): Promise<string> {
  const body = hex.decode(job.bodyHex);
  const parents = job.parents ?? [];
  const pay = revealPayment(job.privHex, job.contentType, body, job.digest, parents);
  const tx = new btc.Transaction({ customScripts });
  tx.addInput({
    ...pay,
    txid: utxo.txid,
    index: utxo.vout,
    witnessUtxo: { script: pay.script, amount: BigInt(utxo.value) },
  } as never);
  for (const parent of parents) {
    tx.addInput({
      txid: parent.txid,
      index: parent.vout,
      witnessUtxo: { script: outScriptForAddress(parent.address), amount: BigInt(parent.value) },
      ...(parent.tapInternalKey ? { tapInternalKey: hex.decode(parent.tapInternalKey) } : {}),
    });
  }
  // Output 0 carries the new inscription; each parent returns to its own holder.
  tx.addOutputAddress(job.receiveAddress, BigInt(utxo.value - job.revealFee), btc.NETWORK);
  for (const parent of parents) tx.addOutputAddress(parent.address, BigInt(parent.value), btc.NETWORK);
  tx.signIdx(hex.decode(job.privHex), 0, undefined, new Uint8Array(32));

  let signed = tx;
  if (parents.length) {
    const indicesFor = (who: ParentSpend["signer"]) =>
      parents.map((p, i) => ({ p, i: i + 1 })).filter((x) => x.p.signer === who).map((x) => x.i);
    let psbt = base64.encode(tx.toPSBT());
    for (const who of ["platform", "wallet"] as const) {
      const indices = indicesFor(who);
      const sign = signers[who];
      if (indices.length === 0) continue;
      if (!sign) throw new Error(`NO SIGNER AVAILABLE FOR THE ${who === "wallet" ? "BITMAP" : "COLLECTION"} PARENT`);
      psbt = await sign(psbt, indices);
    }
    signed = btc.Transaction.fromPSBT(base64.decode(psbt), { allowUnknown: true, allowUnknownInputs: true, customScripts });
  }

  signed.finalize();
  const r = await esplora("/tx", { method: "POST", body: signed.hex });
  if (!r) throw new Error("BITCOIN DID NOT ACCEPT THE REVEAL YET — TRY AGAIN IN A MINUTE");
  return (await r.text()).trim();
}

