/**
 * Shadow Seal v1 — Bitcoin single-use seals for Shadow Vault notes.
 *
 * A seal is one Bitcoin output. Several notes may share one seal (a bundle).
 * Spending the seal is the only way to move any of its notes, and the spending
 * transaction must carry OP_RETURN "BWSEAL1" + commitment over an assignment
 * for EVERY note in the bundle:
 *   - a transferred note → the recipient's blinded outpoint (they keep the salt)
 *   - a kept note        → an output of the spending tx itself ("witness" seal)
 * Bundle rules (enforced by planAnchor, checked by verifySealed):
 *   - a note with no assignment in the anchor that spent its seal is LOST
 *   - a seal spent without a BWSEAL1 commitment loses every note in it
 *   - a note key may appear only once per anchor
 * A note counts as SEALED only when every handoff (and the final seal's own
 * coin) has FINAL_CONFIRMATIONS blocks. Anything less is PENDING.
 * The vault never signs or broadcasts; the holder's wallet does.
 */
import { sha256 } from "@noble/hashes/sha2.js";

export const FINAL_CONFIRMATIONS = 6;
export const SEAL_TAG = "BWSEAL1";

const enc = new TextEncoder();
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const h = (s: string) => toHex(sha256(enc.encode(s)));

export type Outpoint = { txid: string; vout: number };
export type Reveal = Outpoint & { salt: string };
export type SealRef = { kind: "blind"; hash: string } | { kind: "witness"; vout: number };
export type Assignment = { note: string; to: SealRef };
export type Anchor = { txid: string; assignments: Assignment[] };
export type SealedNote = { v: 2; label: string; kind: string; at: string; seal0: string; genesis: string };
/** What a sender hands over: the note, every anchor so far, and the reveal of every spent seal. */
export type Consignment = { note: SealedNote; steps: Anchor[]; reveals: (Reveal | null)[] };

export const blindSeal = (o: Reveal) => h(`bitmapwin:seal:blind|${o.txid.toLowerCase()}:${o.vout}|${o.salt}`);
export const noteKey = (genesis: string) => h(`bitmapwin:seal:note|${genesis}`);
const refStr = (r: SealRef) => (r.kind === "blind" ? `b:${r.hash}` : `w:${r.vout}`);

/** Only newly minted notes can be sealed; legacy notes stay UNSEALED forever. */
export function mintSealed(label: string, kind: string, seal: Reveal, at = new Date().toISOString()): SealedNote {
  const seal0 = blindSeal(seal);
  return { v: 2, label, kind, at, seal0, genesis: h(`bitmapwin:seal:genesis|${kind}|${label}|${at}|${seal0}`) };
}

export function anchorCommitment(assignments: Assignment[]): string {
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.note)) throw new Error("NOTE ASSIGNED TWICE IN ONE ANCHOR");
    seen.add(a.note);
  }
  const lines = assignments.map((a) => `${a.note}>${refStr(a.to)}`).sort();
  return h(`bitmapwin:seal:anchor|${lines.join("|")}`);
}

/** OP_RETURN script hex: 6a <len> "BWSEAL1" <32-byte commitment>. */
export function anchorScript(commitment: string): string {
  const payload = toHex(enc.encode(SEAL_TAG)) + commitment;
  return `6a${(payload.length / 2).toString(16).padStart(2, "0")}${payload}`;
}
export function readAnchorScript(scriptHex: string): string | null {
  const tag = toHex(enc.encode(SEAL_TAG));
  const m = new RegExp(`^6a27${tag}([0-9a-f]{64})$`).exec(scriptHex.toLowerCase());
  return m ? m[1]! : null;
}

/**
 * Plan the spend of one seal. Every note in the bundle gets an assignment:
 * listed notes go to their recipients, every other note stays with the holder
 * on output `keepVout` of the spending transaction.
 */
export function planAnchor(bundle: string[], sendTo: Record<string, SealRef>, keepVout: number): Assignment[] {
  for (const k of Object.keys(sendTo)) if (!bundle.includes(k)) throw new Error("NOTE IS NOT IN THIS SEAL");
  if (new Set(bundle).size !== bundle.length) throw new Error("DUPLICATE NOTE IN BUNDLE");
  return bundle.map((note) => ({ note, to: sendTo[note] ?? { kind: "witness", vout: keepVout } }));
}

/* ── chain view (mempool.space-compatible) ── */
export type TxStatus = { confirmed: boolean; block_height?: number };
export type ChainView = {
  tip(): Promise<number>;
  outspend(o: Outpoint): Promise<{ spent: boolean; txid?: string; status?: TxStatus }>;
  tx(txid: string): Promise<{ status: TxStatus; vout: { scriptpubkey: string }[] }>;
};

export function mempoolChain(base = "https://mempool.space/api"): ChainView {
  const j = async (p: string) => { const r = await fetch(base + p); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; };
  return {
    tip: async () => Number(await (await j("/blocks/tip/height")).text()),
    outspend: async (o) => (await j(`/tx/${o.txid}/outspend/${o.vout}`)).json(),
    tx: async (txid) => (await j(`/tx/${txid}`)).json(),
  };
}

export type SealState =
  | { state: "SEALED"; confirmations: number }
  | { state: "PENDING"; confirmations: number; reason: string }
  | { state: "CONFLICT"; reason: string; spentBy: string }
  | { state: "LOST"; reason: string; spentBy: string }
  | { state: "MOVED"; spentBy: string }
  | { state: "INVALID"; reason: string }
  | { state: "NOT_YOURS" }
  | { state: "UNAVAILABLE"; reason: string };

const confs = (s: TxStatus | undefined, tip: number) => (s?.confirmed && s.block_height ? tip - s.block_height + 1 : 0);

/**
 * Client-side validation of a sealed note. `mine` is the recipient's own
 * reveal of the final seal; without it the result describes the note only.
 * The answer is recomputed from the live chain every time, so a reorg or a
 * replaced transaction moves the state back to PENDING or CONFLICT.
 */
export async function verifySealed(c: Consignment, chain: ChainView, mine?: Reveal): Promise<SealState> {
  const n = c.note;
  if (n?.v !== 2 || n.genesis !== h(`bitmapwin:seal:genesis|${n.kind}|${n.label}|${n.at}|${n.seal0}`)) return { state: "INVALID", reason: "NOTE START DOES NOT MATCH" };
  if (c.reveals.length !== c.steps.length) return { state: "INVALID", reason: "MISSING SEAL REVEALS" };
  const key = noteKey(n.genesis);
  try {
    const tip = await chain.tip();
    let ref: SealRef = { kind: "blind", hash: n.seal0 };
    let prevTx = "";
    let min = Infinity;
    const resolve = (r: SealRef, rev: Reveal | null): Outpoint | null =>
      r.kind === "witness" ? { txid: prevTx, vout: r.vout } : rev && blindSeal(rev) === r.hash ? { txid: rev.txid, vout: rev.vout } : null;

    // The coin that first held the note must itself be final.
    const first = c.steps.length ? c.reveals[0] : mine;
    if (first) min = Math.min(min, confs((await chain.tx(first.txid)).status, tip));

    for (let i = 0; i < c.steps.length; i++) {
      const step = c.steps[i]!;
      const seal = resolve(ref, c.reveals[i] ?? null);
      if (!seal) return { state: "INVALID", reason: `SEAL ${i} REVEAL DOES NOT MATCH` };
      const os = await chain.outspend(seal);
      if (!os.spent || !os.txid) return { state: "PENDING", confirmations: 0, reason: `HANDOFF ${i + 1} IS NOT ON BITCOIN YET` };
      const spender = await chain.tx(os.txid);
      const commit = spender.vout.map((v) => readAnchorScript(v.scriptpubkey)).find(Boolean) ?? null;
      if (os.txid !== step.txid) {
        return commit
          ? { state: "CONFLICT", reason: "THIS SEAL WAS SPENT IN A DIFFERENT HANDOFF", spentBy: os.txid }
          : { state: "LOST", reason: "THE SEAL WAS SPENT WITHOUT A SEAL RECORD", spentBy: os.txid };
      }
      if (!commit) return { state: "LOST", reason: "THE SEAL WAS SPENT WITHOUT A SEAL RECORD", spentBy: os.txid };
      let expected: string;
      try { expected = anchorCommitment(step.assignments); } catch { return { state: "INVALID", reason: "NOTE ASSIGNED TWICE" }; }
      if (commit !== expected) return { state: "INVALID", reason: `HANDOFF ${i + 1} DOES NOT MATCH ITS BITCOIN RECORD` };
      const mineA = step.assignments.find((a) => a.note === key);
      if (!mineA) return { state: "LOST", reason: "THE SEAL WAS SPENT WITHOUT KEEPING THIS NOTE", spentBy: os.txid };
      min = Math.min(min, confs(spender.status, tip));
      ref = mineA.to;
      prevTx = step.txid;
    }

    if (mine) {
      const ok = ref.kind === "blind" ? blindSeal(mine) === ref.hash : mine.txid === prevTx && mine.vout === ref.vout;
      if (!ok) return { state: "NOT_YOURS" };
      const os = await chain.outspend(mine);
      if (os.spent) return { state: "MOVED", spentBy: os.txid ?? "" };
      if (ref.kind === "blind") min = Math.min(min, confs((await chain.tx(mine.txid)).status, tip));
    }
    const conf = Number.isFinite(min) ? min : 0;
    return conf >= FINAL_CONFIRMATIONS
      ? { state: "SEALED", confirmations: conf }
      : { state: "PENDING", confirmations: conf, reason: `${conf} OF ${FINAL_CONFIRMATIONS} CONFIRMATIONS` };
  } catch (e) {
    return { state: "UNAVAILABLE", reason: (e as Error).message || "BITCOIN DATA UNREACHABLE" };
  }
}
