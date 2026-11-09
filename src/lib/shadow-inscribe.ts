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
const ESPLORA = ["https://mempool.space/api", "https://mempool.emzy.de/api", "https://blockstream.info/api"];
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
  /** extra output paid inside the reveal itself, read back on chain by the master generator */
  tribute?: { address: string; sats: number };
  /** extra creator payouts inside the reveal (Land Forge contributors), after the tribute */
  tributes?: { address: string; sats: number }[];
  /** tag 2: sat offset in the reveal inputs; set to the BITMAP's own sat for a reinscription */
  pointer?: number;
  /** tag 5 CBOR metadata (Land Forge delegate builds carry their voxel bytes here) */
  metadata?: Record<string, unknown>;
  /** tag 9: body is compressed with this encoding ("br"); explorers decompress it */
  contentEncoding?: string;
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
// Every job is also archived by its one-time address, so starting again on the
// same artifact can never overwrite the key of an earlier paid commit.
const ARCHIVE_PREFIX = "bitmapwin:shadow-inscribe-archive:";
export const loadJob = (digest: string): InscribeJob | null => {
  try {
    const raw = localStorage.getItem(KEY(digest));
    return raw ? (JSON.parse(raw) as InscribeJob) : null;
  } catch {
    return null;
  }
};
export const saveJob = (job: InscribeJob) => {
  localStorage.setItem(KEY(job.digest), JSON.stringify(job));
  localStorage.setItem(ARCHIVE_PREFIX + job.commitAddress, JSON.stringify(job));
};
export const clearJob = (digest: string) => localStorage.removeItem(KEY(digest));

/** Every locally held job not yet revealed, one per one-time address. */
export function listUnrevealedJobs(): InscribeJob[] {
  return listAllJobs().filter((j) => !j.revealTxid);
}

/** Every locally held job, one per one-time address, revealed ones included. */
export function listAllJobs(): InscribeJob[] {
  const byAddr = new Map<string, InscribeJob>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !(k.startsWith("bitmapwin:shadow-inscribe:") || k.startsWith(ARCHIVE_PREFIX))) continue;
      try {
        const j = JSON.parse(localStorage.getItem(k) ?? "") as InscribeJob;
        if (!j?.privHex || !j.commitAddress) continue;
        const prev = byAddr.get(j.commitAddress);
        if (!prev || (j.revealTxid && !prev.revealTxid) || (j.commitTxid && !prev.commitTxid && !prev.revealTxid)) byAddr.set(j.commitAddress, j);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* storage blocked */
  }
  return [...byAddr.values()];
}

/** Marks an archived job revealed so it leaves the recovery list. */
export const markRevealed = (job: InscribeJob, revealTxid: string) =>
  localStorage.setItem(ARCHIVE_PREFIX + job.commitAddress, JSON.stringify({ ...job, revealTxid }));

// Hosts that rate-limited us (429, or a CORS-blocked 429 page) rest for a minute.
const hostCooldown = new Map<string, number>();
async function esplora(path: string, init?: RequestInit): Promise<Response | null> {
  for (const host of ESPLORA) {
    if ((hostCooldown.get(host) ?? 0) > Date.now()) continue;
    try {
      const r = await fetch(`${host}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
      if (r.ok) return r;
      if (r.status === 429) hostCooldown.set(host, Date.now() + 60_000);
    } catch {
      // A rate-limit page has no CORS header, so it surfaces as a network error.
      hostCooldown.set(host, Date.now() + 60_000);
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
  pointer?: number,
  metadata?: Record<string, unknown>,
  contentEncoding?: string,
) {
  const pub = btc.utils.pubSchnorr(hex.decode(privHex));
  // Tag 3 may repeat: one entry per parent, in the order the reveal spends them.
  // Tag 11 (delegate) points at the master generator; the body then stays empty.
  const tags = {
    ...(delegate ? {} : { contentType }),
    ...(!delegate && contentEncoding ? { contentEncoding } : {}),
    metaprotocol: `shad:${digest}`,
    ...(parents.length ? { parent: parents.map((p) => p.inscriptionId) } : {}),
    ...(delegate ? { delegate } : {}),
    ...(pointer !== undefined ? { pointer: BigInt(pointer) } : {}),
    ...(metadata ? { metadata } : {}),
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
  /** pays this output inside the reveal, after the inscription output */
  tribute?: { address: string; sats: number };
  tributes?: { address: string; sats: number }[];
  /** land the inscription on this sat offset (reinscription onto a parent's sat) */
  pointer?: number;
  metadata?: Record<string, unknown>;
  contentEncoding?: string;
  /** sat/vB chosen by the holder; falls back to the live mempool rate */
  feeRate?: number;
  /** inscription output value; defaults to 546, 330 is the Taproot dust floor */
  postage?: number;
}): Promise<InscribeJob> {
  if (input.body.length > INSCRIBE_MAX_BYTES) throw new Error("FILE TOO LARGE — KEEP IT UNDER 60 KB");
  const parents = input.parents ?? [];
  const delegate = input.delegate?.trim() || undefined;
  const tribute = input.tribute && input.tribute.sats > 0 ? input.tribute : undefined;
  const tributes = (input.tributes ?? []).filter((t) => t.sats >= 546).slice(0, 8);
  const extraSats = tributes.reduce((n, t) => n + t.sats, 0);
  const body = delegate ? new Uint8Array(0) : input.body;
  const priv = btc.utils.randomPrivateKeyBytes();
  const privHex = hex.encode(priv);
  const pointer = input.pointer;
  const metadata = input.metadata;
  const contentEncoding = delegate ? undefined : input.contentEncoding;
  const pay = revealPayment(privHex, input.contentType, body, input.digest, parents, delegate, pointer, metadata, contentEncoding);
  const feeRate = input.feeRate && input.feeRate > 0 ? Math.max(1, Math.round(input.feeRate * 10) / 10) : await liveFeeRate();
  // witness bytes count a quarter; ~ 150 vB of fixed overhead for 1-in/1-out taproot.
  // Each parent adds one taproot input (~58 vB) and its pass-through output (~43 vB).
  const parentIds = parents.reduce((n, p) => n + p.inscriptionId.length, 0);
  const tagBytes = parentIds + (delegate ? 36 : input.contentType.length) + (contentEncoding ? 4 : 0) + 120 + (metadata ? JSON.stringify(metadata).length + 16 : 0);
  const vbytes = Math.ceil((body.length + tagBytes) / 4) + 150 + parents.length * 101 + (tribute ? 43 : 0) + tributes.length * 43;
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
    commitAmount: Math.max(330, input.postage ?? INSCRIBE_POSTAGE) + revealFee + (tribute?.sats ?? 0) + extraSats,
    ...(parents.length ? { parents } : {}),
    ...(delegate ? { delegate } : {}),
    ...(tribute ? { tribute } : {}),
    ...(tributes.length ? { tributes } : {}),
    ...(pointer !== undefined ? { pointer } : {}),
    ...(metadata ? { metadata } : {}),
    ...(contentEncoding ? { contentEncoding } : {}),
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
 * Satoshi order matters. Ordinals tracks sats first-in-first-out across the
 * whole input stream, and the miner fee is whatever is left at the very end of
 * that stream. So every claimed parent is spent first, one input per parent,
 * each mapped one-to-one onto the output that hands it straight back to its
 * holder. The commit output comes last and carries both the new inscription and
 * the entire miner fee, which means no parent sat can ever be shifted forward
 * into the fee and lost to the coinbase.
 *
 * Inputs:  [ parent 0 .. parent n-1 ] [ commit ]
 * Outputs: [ parent 0 .. parent n-1 ] [ inscription (546) ]  + fee from the tail
 */
export async function revealJob(
  job: InscribeJob,
  utxo: { txid: string; vout: number; value: number },
  signers: ParentSigners = {},
): Promise<string> {
  const body = hex.decode(job.bodyHex);
  const parents = job.parents ?? [];
  const pay = revealPayment(job.privHex, job.contentType, body, job.digest, parents, job.delegate, job.pointer, job.metadata, job.contentEncoding);
  const tx = new btc.Transaction({ customScripts });
  for (const parent of parents) {
    tx.addInput({
      txid: parent.txid,
      index: parent.vout,
      witnessUtxo: { script: outScriptForAddress(parent.address), amount: BigInt(parent.value) },
      ...(parent.tapInternalKey ? { tapInternalKey: hex.decode(parent.tapInternalKey) } : {}),
      // Xverse docs: taproot key-path inputs carry tapInternalKey + SIGHASH_ALL.
      ...(parent.signer === "wallet" && (parent.tapInternalKey || /^bc1p/i.test(parent.address)) ? { sighashType: btc.SigHash.ALL } : {}),
    });
  }
  const commitIdx = parents.length;
  tx.addInput({
    ...pay,
    txid: utxo.txid,
    index: utxo.vout,
    witnessUtxo: { script: pay.script, amount: BigInt(utxo.value) },
  } as never);
  // Each parent returns to its own holder, sat-for-sat; the inscription lands on
  // the first sat of the commit input, which is exactly where this last output
  // starts, so no pointer tag is needed.
  for (const parent of parents) tx.addOutputAddress(parent.address, BigInt(parent.value), btc.NETWORK);
  const extra = job.tributes ?? [];
  const tributeSats = (job.tribute?.sats ?? 0) + extra.reduce((n, t) => n + t.sats, 0);
  tx.addOutputAddress(job.receiveAddress, BigInt(utxo.value - job.revealFee - tributeSats), btc.NETWORK);
  // The tribute sits after the inscription output, so it can never carry the inscribed sat.
  if (job.tribute) tx.addOutputAddress(job.tribute.address, BigInt(job.tribute.sats), btc.NETWORK);
  for (const t of extra) tx.addOutputAddress(t.address, BigInt(t.sats), btc.NETWORK);
  tx.signIdx(hex.decode(job.privHex), commitIdx, undefined, new Uint8Array(32));

  let signed = tx;
  if (parents.length) {
    const indicesFor = (who: ParentSpend["signer"]) =>
      parents.map((p, i) => ({ p, i })).filter((x) => x.p.signer === who).map((x) => x.i);
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

