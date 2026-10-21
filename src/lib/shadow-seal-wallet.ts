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
/**
 * Fail-closed storage. A missing record is empty; an unreadable, unparseable or wrongly shaped
 * record THROWS (never silently becomes "nothing pending", which would unblock competing transfers
 * or drop notes). Writes are read back and verified, and a damaged record is never overwritten.
 */
export class VaultStorageError extends Error {}
const isOut = (o: unknown): o is { txid: string; vout: number } =>
  !!o && typeof o === "object" && /^[0-9a-f]{64}$/i.test(String((o as { txid?: unknown }).txid)) && Number.isInteger((o as { vout?: unknown }).vout);
const isHeld = (h: unknown) => !!h && typeof h === "object" && isOut((h as HeldSealed).mine) && !!(h as HeldSealed).c?.note?.genesis;
const VALID: Record<string, (v: unknown) => boolean> = {};
const shapeOk = (k: string, v: unknown) => (VALID[k] ? VALID[k]!(v) : true);
const read = <T,>(k: string, d: T): T => {
  let raw: string | null;
  try { raw = localStorage.getItem(k); } catch { throw new VaultStorageError("BROWSER STORAGE IS UNAVAILABLE — NOTHING CHANGED"); }
  if (raw == null) return d;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { throw new VaultStorageError(`DAMAGED VAULT RECORD (${k}) — RESTORE A BACKUP; NOTHING WAS CHANGED`); }
  if (!shapeOk(k, v)) throw new VaultStorageError(`DAMAGED VAULT RECORD (${k}) — RESTORE A BACKUP; NOTHING WAS CHANGED`);
  return v as T;
};
const write = (k: string, v: unknown) => {
  read(k, null); // refuses to overwrite a damaged record
  const s = JSON.stringify(v);
  try { localStorage.setItem(k, s); } catch { throw new VaultStorageError("COULD NOT SAVE TO BROWSER STORAGE (FULL OR BLOCKED) — NOTHING SENT"); }
  let back: string | null = null;
  try { back = localStorage.getItem(k); } catch { /* fallthrough */ }
  if (back !== s) throw new VaultStorageError("BROWSER STORAGE DID NOT KEEP THE SAVE — NOTHING SENT");
};
VALID[K.held] = (v) => Array.isArray(v) && v.every(isHeld);
VALID[K.undo] = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((b) => Array.isArray(b) && b.every(isHeld));
VALID[K.recv] = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(isOut);
VALID[K.sent] = (v) => Array.isArray(v);
export const sealStore = {
  held: () => read<HeldSealed[]>(K.held, []), setHeld: (v: HeldSealed[]) => write(K.held, v),
  recv: () => read<Record<string, Reveal>>(K.recv, {}), setRecv: (v: Record<string, Reveal>) => write(K.recv, v),
  sent: () => read<{ label: string; code: string; at: string }[]>(K.sent, []), setSent: (v: { label: string; code: string; at: string }[]) => write(K.sent, v),
  undo: () => read<Record<string, HeldSealed[]>>(K.undo, {}), setUndo: (v: Record<string, HeldSealed[]>) => write(K.undo, v),
};
export const sealKey = (r: { txid: string; vout: number }) => `${r.txid}:${r.vout}`;

/* ── 1-click transfer pipeline (pure, injectable so it can be tested with a mock wallet) ── */

/** Smallest confirmed coin that can pay the fee and keep change, skipping coins that fail the plain-coin check. */
export async function pickPlainCoin(coins: Coin[], feeRate: number, isPlain: (c: Coin) => Promise<void> = assertPlainCoin, sealCoins: Set<string> = new Set()): Promise<Coin> {
  const cands = coins.filter((c) => !sealCoins.has(sealKey(c)) && c.confirmed && c.value >= sealFee(feeRate) + DUST + 1000).sort((a, b) => a.value - b.value);
  for (const c of cands) {
    try { await isPlain(c); return c; } catch { /* not plain or not checkable — try next */ }
  }
  throw new Error("NO PLAIN COIN FOUND — ADD A SMALL PLAIN BITCOIN COIN (5,000+ SATS) TO YOUR WALLET");
}

/** Plans, asks the wallet to sign, and checks the result. Nothing is stored here: if signing is cancelled the caller's notes are untouched. */
export async function prepareTransfer(o: {
  bundle: HeldSealed[]; give: Record<string, string>; coin: Coin; address: string; tapInternalKeyHex?: string | undefined;
  feeRate: number; sign: (psbtB64: string) => Promise<string>;
  /** Every note this device holds — used to prove the bundle is complete for the coin being spent. */
  allHeld: HeldSealed[];
}) {
  const ck = sealKey(o.coin);
  if (!o.bundle.length) throw new Error("NO NOTES ON THIS COIN");
  if (o.bundle.some((h) => sealKey(h.mine) !== ck)) throw new Error("WRONG COIN — ONLY THE COIN ANCHORING THESE NOTES CAN BE SPENT");
  const inBundle = new Set(o.bundle.map((h) => noteKey(h.c.note.genesis)));
  if (o.allHeld.some((h) => sealKey(h.mine) === ck && !inBundle.has(noteKey(h.c.note.genesis))))
    throw new Error("EVERY NOTE ON THIS COIN MUST BE GIVEN OR KEPT — SOME WOULD BE LOST");
  if (Object.keys(o.give).some((n) => !inBundle.has(n))) throw new Error("A GIVEN NOTE IS NOT ON THIS COIN");
  if (!Object.keys(o.give).length) throw new Error("CHOOSE AT LEAST ONE NOTE TO GIVE");
  const { assignments, commitment } = planBundle(o.bundle, o.give);
  const { psbt, fee, keepValue } = buildSealSpendPsbt({ coin: o.coin, address: o.address, tapInternalKeyHex: o.tapInternalKeyHex, commitment, feeRate: o.feeRate });
  let signedB64: string;
  try { signedB64 = await o.sign(psbt); } catch { throw new Error("SIGNING CANCELLED — NOTHING CHANGED, YOUR NOTES ARE STILL ON THEIR COIN"); }
  const out = finishSigned(signedB64, commitment);
  return { ...out, fee, keepValue, ...applySpend(o.bundle, assignments, out.txid) };
}

/** Thrown when we can't tell whether Bitcoin received the tx (timeout / connection drop). Never treat as "not sent". */
export class BroadcastUnknown extends Error {
  constructor(public txid: string) { super("NO REPLY FROM BITCOIN — IT MAY OR MAY NOT HAVE BEEN SENT. CHECK BEFORE CANCELLING OR RETRYING"); }
}

/** Is this txid known to Bitcoin (mempool or block)? "unknown" when the check itself fails. */
export async function txSeenOnChain(txid: string, fetchImpl: typeof fetch = fetch): Promise<"seen" | "absent" | "unknown"> {
  try {
    const r = await fetchImpl(`https://mempool.space/api/tx/${txid}/status`);
    if (r.status === 404) return "absent";
    if (!r.ok) return "unknown";
    return "seen";
  } catch { return "unknown"; }
}

/**
 * Sends a signed tx via mempool.space. Only called when the holder presses the button.
 * Returns the txid when accepted. Throws BroadcastUnknown on timeout/connection loss,
 * and a plain Error only when Bitcoin definitively rejected it.
 */
export async function broadcastTx(rawHex: string, txid: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20_000): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let r: Response, t: string;
  try {
    r = await fetchImpl("https://mempool.space/api/tx", { method: "POST", body: rawHex, signal: ctl.signal });
    t = (await r.text()).trim();
  } catch { throw new BroadcastUnknown(txid); }
  finally { clearTimeout(timer); }
  if (!r.ok) {
    if (/already|known|in-mempool|in-chain/i.test(t)) return txid;
    if (r.status >= 500) throw new BroadcastUnknown(txid);
    throw new Error(`BITCOIN REJECTED IT: ${t.slice(0, 120)}`);
  }
  if (t.toLowerCase() !== txid.toLowerCase()) throw new BroadcastUnknown(txid);
  return t;
}

/* ── unresolved signed transfers (survive reloads + wallet reconnects) ── */
export type BtcNetwork = "mainnet" | "testnet" | "regtest";
export const networkOf = (address: string): BtcNetwork | null =>
  /^bc1|^[13]/.test(address) ? "mainnet" : /^bcrt1/.test(address) ? "regtest" : /^tb1|^[mn2]/.test(address) ? "testnet" : null;
export type PendingTransfer = {
  txid: string; rawHex: string; anchor: { txid: string; vout: number };
  /** wallet address + network the transfer was signed for — recovery only shows it to that wallet */
  address: string; network: BtcNetwork;
  /** full bundle before the spend + notes kept on output 0, so recovery never depends on other records */
  before?: HeldSealed[]; kept?: HeldSealed[];
  sent: { label: string; code: string }[]; at: string; unknown?: boolean;
};
const PK = "bitmapwin:sealed-pending";
VALID[PK] = (v) => Array.isArray(v) && v.every((p) => p && /^[0-9a-f]{64}$/i.test(p.txid) && typeof p.rawHex === "string" && isOut(p.anchor) && typeof p.address === "string" && Array.isArray(p.sent)
  && (p.before === undefined || (Array.isArray(p.before) && p.before.every(isHeld))) && (p.kept === undefined || (Array.isArray(p.kept) && p.kept.every(isHeld))));
export const pendingStore = {
  all: () => read<PendingTransfer[]>(PK, []),
  /** Only the transfers signed by this wallet on this network. */
  forWallet: (address: string) => read<PendingTransfer[]>(PK, []).filter((p) => p.address === address && p.network === networkOf(address)),
  /** Any unresolved transfer on this coin, whichever wallet or tab made it. */
  onAnchor: (a: { txid: string; vout: number }) => read<PendingTransfer[]>(PK, []).filter((p) => sealKey(p.anchor) === sealKey(a)),
  put: (p: PendingTransfer) => write(PK, [...read<PendingTransfer[]>(PK, []).filter((x) => x.txid !== p.txid), p]),
  drop: (txid: string) => write(PK, read<PendingTransfer[]>(PK, []).filter((x) => x.txid !== txid)),
};

export type Resolution = "SENT" | "SAFE_TO_CANCEL" | "UNRESOLVED" | "CONFLICT";
/**
 * Decides a signed-but-unconfirmed transfer from two independent facts:
 * is this exact txid known to Bitcoin, and is the anchor coin still unspent?
 * Only "absent" + "unspent" may be cancelled or replaced. Anything unavailable
 * or contradictory stays UNRESOLVED.
 */
export async function resolvePending(p: PendingTransfer, deps: {
  txSeen: (txid: string) => Promise<"seen" | "absent" | "unknown">;
  outspend: (o: { txid: string; vout: number }) => Promise<{ spent: boolean; txid?: string }>;
}): Promise<Resolution> {
  let seen: "seen" | "absent" | "unknown", os: { spent: boolean; txid?: string } | null;
  try { seen = await deps.txSeen(p.txid); } catch { seen = "unknown"; }
  try { os = await deps.outspend(p.anchor); } catch { os = null; }
  if (!os || seen === "unknown") return seen === "seen" && os?.spent && os.txid === p.txid ? "SENT" : "UNRESOLVED";
  if (os.spent && os.txid && os.txid !== p.txid) return "CONFLICT";
  if (seen === "seen" && os.spent && os.txid === p.txid) return "SENT";
  if (seen === "absent" && !os.spent) return "SAFE_TO_CANCEL";
  return "UNRESOLVED"; // e.g. seen but anchor unspent, or absent but anchor spent by us
}

/* ── one signer per anchor coin across tabs ── */
type LockLike = { request: (name: string, opts: { mode: "exclusive"; ifAvailable: true }, cb: (lock: unknown) => Promise<unknown>) => Promise<unknown> };

/**
 * Runs `fn` (plan → sign → persist) holding an exclusive cross-tab lock on the anchor coin.
 * Refuses when another tab holds the lock, or when any unresolved transfer for that coin is
 * already stored (re-read inside the lock, so a tab that just finished is always seen).
 */
export async function withAnchorLock<T>(anchor: { txid: string; vout: number }, fn: () => Promise<T>, locks?: LockLike): Promise<T> {
  const lm = locks ?? (typeof navigator !== "undefined" ? (navigator as unknown as { locks?: LockLike }).locks : undefined);
  if (!lm) throw new Error("THIS BROWSER CAN'T PREVENT TWO TABS SIGNING AT ONCE — USE AN UP-TO-DATE BROWSER");
  let ran = false, out: T | undefined;
  await lm.request(`bitmapwin:seal-anchor:${sealKey(anchor)}`, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) return;
    ran = true;
    if (pendingStore.onAnchor(anchor).length) throw new Error("THIS COIN ALREADY HAS AN UNFINISHED TRANSFER — RESOLVE IT FIRST (MAYBE IN ANOTHER TAB)");
    if (intentStore.onAnchor(anchor).length) throw new Error("A SIGNING ON THIS COIN WAS INTERRUPTED — CHECK IT ON BITCOIN FIRST");
    out = await fn();
  });
  if (!ran) throw new Error("ANOTHER TAB IS SIGNING A TRANSFER FOR THIS COIN — FINISH OR CLOSE IT FIRST");
  return out as T;
}

/* ── signing intents: written BEFORE the wallet opens, so a crash/reload mid-popup is never forgotten ── */
export type SigningIntent = { anchor: { txid: string; vout: number }; address: string; network: BtcNetwork; at: string; /** random id of this signing attempt */ attempt?: string };
const IK = "bitmapwin:sealed-intent";
VALID[IK] = (v) => Array.isArray(v) && v.every((i) => i && isOut(i.anchor) && typeof i.address === "string");
export const intentStore = {
  all: () => read<SigningIntent[]>(IK, []),
  onAnchor: (a: { txid: string; vout: number }) => read<SigningIntent[]>(IK, []).filter((i) => sealKey(i.anchor) === sealKey(a)),
  forWallet: (address: string) => read<SigningIntent[]>(IK, []).filter((i) => i.address === address && i.network === networkOf(address)),
  put: (i: SigningIntent) => write(IK, [...read<SigningIntent[]>(IK, []).filter((x) => sealKey(x.anchor) !== sealKey(i.anchor)), i]),
  drop: (a: { txid: string; vout: number }) => write(IK, read<SigningIntent[]>(IK, []).filter((x) => sealKey(x.anchor) !== sealKey(a))),
  /** Drops the intent only if it still belongs to this attempt (never a newer one). */
  dropAttempt: (a: { txid: string; vout: number }, attempt: string) => write(IK, read<SigningIntent[]>(IK, []).filter((x) => !(sealKey(x.anchor) === sealKey(a) && x.attempt === attempt))),
  isCurrent: (a: { txid: string; vout: number }, attempt: string) => read<SigningIntent[]>(IK, []).some((x) => sealKey(x.anchor) === sealKey(a) && x.attempt === attempt),
};
const newAttempt = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The whole sign step under the anchor lock:
 *   intent stored → wallet signs → notes, undo and pending stored in one synchronous step → intent dropped.
 * The pending record is always filed under the wallet/network that STARTED signing, even if the
 * user switched wallet or network while the popup was open (the result is then flagged).
 */
export async function runLockedTransfer(o: {
  bundle: HeldSealed[]; give: Record<string, string>; coin: Coin; address: string; tapInternalKeyHex?: string | undefined;
  feeRate: number; sign: (psbtB64: string) => Promise<string>;
  currentWallet: () => string | null; locks?: LockLike; now?: () => string;
}) {
  const network = networkOf(o.address);
  if (!network) throw new Error("UNKNOWN BITCOIN NETWORK FOR THIS WALLET");
  const now = o.now ?? (() => new Date().toISOString());
  const anchor = { txid: o.coin.txid, vout: o.coin.vout };
  return withAnchorLock(anchor, async () => {
    const attempt = newAttempt();
    intentStore.put({ anchor, address: o.address, network, at: now(), attempt });
    if (!intentStore.isCurrent(anchor, attempt)) throw new VaultStorageError("COULD NOT SAVE THE SIGNING LOCK — WALLET NOT OPENED");
    let r: Awaited<ReturnType<typeof prepareTransfer>>;
    try {
      r = await prepareTransfer({ ...o, allHeld: sealStore.held() });
    } catch (e) { intentStore.dropAttempt(anchor, attempt); throw e; }
    // From here on everything is synchronous: one tick, so no other tab can interleave.
    // Stale check: this attempt must still be the live one (not cleared, not superseded, no other transfer filed).
    if (!intentStore.isCurrent(anchor, attempt) || pendingStore.onAnchor(anchor).length) {
      throw new Error("THIS SIGNATURE IS STALE — THAT SIGNING WAS CLEARED OR REPLACED. DISCARDED, NOTHING SAVED OR SENT");
    }
    const heldNow = sealStore.held();
    const ck = sealKey(anchor);
    if (heldNow.some((h) => sealKey(h.mine) === ck && !o.bundle.some((b) => noteKey(b.c.note.genesis) === noteKey(h.c.note.genesis)))) {
      intentStore.dropAttempt(anchor, attempt);
      throw new Error("NOTES ON THIS COIN CHANGED WHILE SIGNING — SIGNATURE DISCARDED, NOTHING SENT");
    }
    // 1) The signed transfer record is the commit point. If it can't be saved, discard the signature:
    //    the intent stays (coin blocked as "interrupted") and every note is still on the coin.
    try {
      pendingStore.put({ txid: r.txid, rawHex: r.rawHex, anchor, address: o.address, network, sent: r.sent, at: now(), before: o.bundle, kept: r.kept });
    } catch (e) {
      try { pendingStore.drop(r.txid); } catch { /* leave whatever is there; read is fail-closed */ }
      throw new VaultStorageError(`COULD NOT SAVE THE SIGNED TRANSFER — SIGNATURE DISCARDED, NOTHING SENT, NOTES UNCHANGED (${(e as Error).message})`);
    }
    // 2) Secondary records. If these fail the pending record still holds before + kept, and repairHeld() fixes notes on next load.
    try {
      sealStore.setUndo({ ...sealStore.undo(), [r.txid]: o.bundle });
      sealStore.setSent([...sealStore.sent(), ...r.sent.map((x) => ({ ...x, at: now() }))]);
      sealStore.setHeld([...heldNow.filter((h) => sealKey(h.mine) !== ck), ...r.kept]);
    } catch { /* recovered from the pending record */ }
    try { intentStore.dropAttempt(anchor, attempt); } catch { /* pending record already blocks the coin */ }
    const cur = o.currentWallet();
    return { ...r, walletChanged: cur !== o.address || networkOf(cur ?? "") !== network };
  }, o.locks);
}

/** An interrupted signing (crash/reload mid-popup) can be cleared only when no tab holds the lock and the anchor is provably unspent. */
export async function clearInterrupted(anchor: { txid: string; vout: number }, outspend: (o: { txid: string; vout: number }) => Promise<{ spent: boolean; txid?: string }>, locks?: LockLike): Promise<"CLEARED" | "SPENT" | "UNRESOLVED" | "BUSY"> {
  const lm = locks ?? (typeof navigator !== "undefined" ? (navigator as unknown as { locks?: LockLike }).locks : undefined);
  if (!lm) return "UNRESOLVED";
  let res: "CLEARED" | "SPENT" | "UNRESOLVED" | "BUSY" = "BUSY";
  await lm.request(`bitmapwin:seal-anchor:${sealKey(anchor)}`, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) return;
    let os: { spent: boolean } | null = null;
    try { os = await outspend(anchor); } catch { /* unavailable */ }
    if (!os) { res = "UNRESOLVED"; return; }
    if (os.spent) { res = "SPENT"; return; }
    intentStore.drop(anchor); res = "CLEARED";
  });
  return res;
}

/** Notes as they should be: any held note still on an anchor with a saved transfer is replaced by that transfer's kept notes. */
export function repairedHeld(held: HeldSealed[], pending: PendingTransfer[]): HeldSealed[] {
  let out = held;
  for (const p of pending) {
    if (!p.kept) continue;
    const ak = sealKey(p.anchor);
    if (!out.some((h) => sealKey(h.mine) === ak)) continue;
    const have = new Set(out.filter((h) => sealKey(h.mine) !== ak).map((h) => noteKey(h.c.note.genesis) + "@" + sealKey(h.mine)));
    out = [...out.filter((h) => sealKey(h.mine) !== ak), ...p.kept.filter((h) => !have.has(noteKey(h.c.note.genesis) + "@" + sealKey(h.mine)))];
  }
  return out;
}
/** Loads notes, repairing from saved transfers; writes back only if something changed. Throws on damaged records. */
export function loadHeld(): HeldSealed[] {
  recoverInterruptedRestore();
  const h = sealStore.held(), fixed = repairedHeld(h, pendingStore.all());
  if (fixed !== h) { try { sealStore.setHeld(fixed); } catch { /* still correct in memory */ } }
  return fixed;
}

/* ── guarded backup restore: locked, journaled (all-or-nothing), wallet-scoped ── */
export type RestoreResult = { restored: string[]; skippedSpent: string[]; skippedInFlight: string[] };
const JK = "bitmapwin:sealed-restore-journal";
const RESTORE_KEYS = [K.held, K.recv, K.sent];
const rawGet = (k: string) => { try { return localStorage.getItem(k); } catch { throw new VaultStorageError("BROWSER STORAGE IS UNAVAILABLE — NOTHING CHANGED"); } };
const rawPut = (k: string, v: string | null) => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); if (localStorage.getItem(k) !== v) throw new Error("not kept"); };
/**
 * If a restore was cut off (crash, reload, storage failure), put the notes/recv/sent records back
 * exactly as they were before it. Never touches signing or signed-transfer records.
 */
export function recoverInterruptedRestore(): boolean {
  const j = rawGet(JK);
  if (j == null) return false;
  let prev: Record<string, string | null>;
  try { prev = JSON.parse(j).prev; if (!prev || typeof prev !== "object") throw 0; }
  catch { throw new VaultStorageError(`DAMAGED VAULT RECORD (${JK}) — RESTORE A BACKUP; NOTHING WAS CHANGED`); }
  try { for (const k of RESTORE_KEYS) rawPut(k, prev[k] ?? null); localStorage.removeItem(JK); }
  catch { throw new VaultStorageError("AN INTERRUPTED RESTORE COULDN'T BE UNDONE YET — NOTHING ELSE CHANGED, TRY AGAIN"); }
  return true;
}
/** Holds the restore lock and every listed anchor lock at once (ifAvailable); busy anchors are reported, not waited on. */
async function withLocks(lm: LockLike, names: string[], fn: (busy: Set<string>) => Promise<void>, busy = new Set<string>()): Promise<void> {
  if (!names.length) return fn(busy);
  const [n, ...rest] = names;
  await lm.request(n!, { mode: "exclusive", ifAvailable: true }, async (l) => { if (!l) busy.add(n!); await withLocks(lm, rest, fn, busy); });
}
/**
 * Restores a backup without ever erasing an unfinished signing or signed transfer, resurrecting
 * notes whose coin is spent, or freeing a coin for a competing transfer.
 * All writes are journaled first: either every record is replaced or none is (recovered on next load).
 */
export async function restoreBackup(backup: unknown, o: {
  outspend: (x: { txid: string; vout: number }) => Promise<{ spent: boolean; txid?: string }>;
  locks?: LockLike; address?: string | null; currentWallet?: () => string | null;
}): Promise<RestoreResult> {
  const b = backup as { held?: unknown; recv?: unknown; sent?: unknown };
  if (!b || typeof b !== "object" || !VALID[K.held]!(b.held ?? []) || !VALID[K.recv]!(b.recv ?? {}) || !VALID[K.sent]!(b.sent ?? []))
    throw new Error("THIS IS NOT A VALID SEALED-NOTES BACKUP — NOTHING CHANGED");
  const lm = o.locks ?? (typeof navigator !== "undefined" ? (navigator as unknown as { locks?: LockLike }).locks : undefined);
  if (!lm) throw new Error("THIS BROWSER CAN'T PREVENT TWO TABS CHANGING THE VAULT AT ONCE — USE AN UP-TO-DATE BROWSER");
  const startWallet = o.address ?? null, startNet = networkOf(startWallet ?? "");
  const walletMoved = () => { const c = o.currentWallet ? o.currentWallet() : startWallet; return c !== startWallet || networkOf(c ?? "") !== startNet; };
  const bHeld = (b.held ?? []) as HeldSealed[];
  // 1) Bitcoin checks, outside any lock (they're slow). Results are only trusted for the wallet that asked.
  const spent = new Set<string>();
  for (const a of [...new Set(bHeld.map((h) => sealKey(h.mine)))]) {
    const h = bHeld.find((x) => sealKey(x.mine) === a)!;
    let os: { spent: boolean } | null = null;
    try { os = await o.outspend(h.mine); } catch { /* unavailable */ }
    if (!os) throw new Error("COULDN'T CHECK A NOTE'S COIN ON BITCOIN — NOTHING RESTORED, TRY AGAIN");
    if (os.spent) spent.add(a);
  }
  if (walletMoved()) throw new Error("YOUR WALLET OR NETWORK CHANGED DURING THE CHECK — THOSE RESULTS WERE DISCARDED, NOTHING RESTORED");
  // 2) Under the restore lock + every affected anchor lock: re-read, decide, journal, write — no awaits between.
  const anchors = [...new Set(bHeld.map((h) => sealKey(h.mine)))].sort();
  let res: RestoreResult | null = null, err: unknown = null;
  await lm.request("bitmapwin:seal-restore", { mode: "exclusive", ifAvailable: true }, async (rl) => {
    if (!rl) { err = new Error("ANOTHER TAB IS RESTORING A BACKUP — WAIT FOR IT TO FINISH"); return; }
    await withLocks(lm, anchors.map((a) => `bitmapwin:seal-anchor:${a}`), async (busyNames) => {
      try {
        recoverInterruptedRestore();
        if (walletMoved()) throw new Error("YOUR WALLET OR NETWORK CHANGED DURING THE CHECK — THOSE RESULTS WERE DISCARDED, NOTHING RESTORED");
        const pending = pendingStore.all(), intents = intentStore.all(); // fail closed on damage
        const blocked = new Set([...pending.map((p) => sealKey(p.anchor)), ...intents.map((i) => sealKey(i.anchor)), ...[...busyNames].map((n) => n.replace("bitmapwin:seal-anchor:", ""))]);
        let current: HeldSealed[] = [], recv: Record<string, Reveal> = {}, sent: { label: string; code: string; at: string }[] = [];
        try { current = sealStore.held(); } catch (e) { if ((e as Error).message.includes("UNAVAILABLE")) throw e; }
        try { recv = sealStore.recv(); } catch (e) { if ((e as Error).message.includes("UNAVAILABLE")) throw e; }
        try { sent = sealStore.sent(); } catch (e) { if ((e as Error).message.includes("UNAVAILABLE")) throw e; }
        const have = new Set(current.map((h) => noteKey(h.c.note.genesis)));
        const r: RestoreResult = { restored: [], skippedSpent: [], skippedInFlight: [] };
        const add: HeldSealed[] = [];
        for (const h of bHeld) {
          const nk = noteKey(h.c.note.genesis);
          if (have.has(nk) || add.some((x) => noteKey(x.c.note.genesis) === nk)) continue;
          if (blocked.has(sealKey(h.mine))) { r.skippedInFlight.push(h.c.note.label); continue; }
          if (spent.has(sealKey(h.mine))) { r.skippedSpent.push(h.c.note.label); continue; }
          add.push(h); r.restored.push(h.c.note.label);
        }
        const codes = new Set(sent.map((x) => x.code));
        const next: Record<string, string> = {
          [K.held]: JSON.stringify(repairedHeld([...current, ...add], pending)),
          [K.recv]: JSON.stringify({ ...(b.recv as Record<string, Reveal> ?? {}), ...recv }),
          [K.sent]: JSON.stringify([...sent, ...((b.sent ?? []) as typeof sent).filter((x) => !codes.has(x.code))]),
        };
        const prev: Record<string, string | null> = {};
        for (const k of RESTORE_KEYS) prev[k] = rawGet(k);
        try { rawPut(JK, JSON.stringify({ prev })); } catch { throw new VaultStorageError("COULD NOT SAVE THE RESTORE SAFETY RECORD — NOTHING RESTORED"); }
        try { for (const k of RESTORE_KEYS) rawPut(k, next[k]!); }
        catch {
          try { recoverInterruptedRestore(); } catch { /* journal stays; undone on next load */ }
          throw new VaultStorageError("COULD NOT SAVE THE RESTORED NOTES — EVERYTHING WAS PUT BACK AS BEFORE");
        }
        try { localStorage.removeItem(JK); } catch { /* harmless: next load would undo; but all writes landed */ }
        if (rawGet(JK) != null) { recoverInterruptedRestore(); throw new VaultStorageError("COULD NOT FINISH THE RESTORE — EVERYTHING WAS PUT BACK AS BEFORE"); }
        res = r;
      } catch (e) { err = e; }
    });
  });
  if (err) throw err;
  return res!;
}
