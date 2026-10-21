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
  sent: { label: string; code: string }[]; at: string; unknown?: boolean;
};
const PK = "bitmapwin:sealed-pending";
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
    out = await fn();
  });
  if (!ran) throw new Error("ANOTHER TAB IS SIGNING A TRANSFER FOR THIS COIN — FINISH OR CLOSE IT FIRST");
  return out as T;
}
