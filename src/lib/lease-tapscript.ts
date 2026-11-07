/**
 * BW-LEASE-L1 — draft Taproot bond for trustless BITMAP leases.
 *
 * DRAFT, NOT WIRED TO THE LEASE PAGE OR ANY BROWSER WALLET. Spends are tested only
 * on a private signet node (scripts/lease-signet-test.ts); mainnet is never used.
 *
 * Output: tr(NUMS, { mutual, refund, slash }) — the internal key is the BIP-341
 * "H" point, so the key path is unspendable and every spend reveals its rule.
 *
 *  - mutual : landlord + tenant 2-of-2 (CHECKSIGADD), any time.
 *  - refund : tenant alone after `refundCsv` blocks (CSV, relative to funding).
 *  - slash  : landlord + the tenant's equivocation key `E`, any time. The tenant
 *             holds E's secret but can never use this leaf alone (needs the
 *             landlord); the landlord only learns E's secret if the tenant signs
 *             two different statements on one cell. The landlord must slash
 *             before the refund timelock matures.
 *
 * Write-once cell (BitAt-style): the tenant publishes E and a committed nonce R.
 * Each lease attestation ("rent paid for period k", "vacated", …) is a BIP-340
 * signature by E using exactly that R. One statement per cell is harmless; two
 * different statements with the same R leak E's secret:
 *     e = (s1 - s2) / (c1 - c2)  mod n
 * This is classic nonce-reuse slashing, inspired by Complexity (.com)'s
 * equivocation leaf; it is NOT their verified bytecode. It punishes contradiction
 * only — it cannot force a tenant to pay rent.
 */
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { bech32m } from "@scure/base";
import * as bitcoin from "bitcoinjs-lib";

export const LEASE_PROTOCOL = "BW-LEASE-L1";
const N = secp256k1.Point.CURVE().n;
const Point = secp256k1.Point;
/** BIP-341 provably unspendable internal key ("H"). */
export const NUMS_X = "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";
const LEAF_VERSION = 0xc0;

const OP = { CHECKSIG: 0xac, CHECKSIGVERIFY: 0xad, CHECKSIGADD: 0xba, NUMEQUAL: 0x9c, CSV: 0xb2, DROP: 0x75, OP_2: 0x52 };

function tagged(tag: string, ...msgs: Uint8Array[]) {
  const t = sha256(utf8ToBytes(tag));
  return sha256(concatBytes(t, t, ...msgs));
}
const mod = (a: bigint) => ((a % N) + N) % N;
const toBig = (b: Uint8Array) => BigInt("0x" + (bytesToHex(b) || "0"));
const to32 = (x: bigint) => hexToBytes(x.toString(16).padStart(64, "0"));
function inv(a: bigint) { let [r, s, t] = [N, mod(a), 0n], u = 1n; while (s) { const q = r / s; [r, s] = [s, r - q * s]; [t, u] = [u, t - q * u]; } return mod(t); }

/** Minimal CScriptNum push for small positive ints (CSV values). */
export function pushNum(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error("CSV must be 1..65535 blocks");
  if (n <= 16) return Uint8Array.of(0x50 + n);
  const b: number[] = []; let v = n; while (v) { b.push(v & 0xff); v >>= 8; }
  if (b[b.length - 1]! & 0x80) b.push(0);
  return Uint8Array.of(b.length, ...b);
}
const pushKey = (x: Uint8Array) => { if (x.length !== 32) throw new Error("x-only key must be 32 bytes"); return concatBytes(Uint8Array.of(32), x); };

export type LeaseTerms = { landlord: string; tenant: string; equivocation: string; refundCsv: number };
export type LeaseLeaf = "mutual" | "refund" | "slash";

export function leaseLeaves(t: LeaseTerms): Record<LeaseLeaf, Uint8Array> {
  const keys = [t.landlord, t.tenant, t.equivocation];
  if (new Set(keys).size !== 3) throw new Error("landlord, tenant and equivocation keys must all differ");
  const [L, T, E] = keys.map(hexToBytes) as [Uint8Array, Uint8Array, Uint8Array];
  const mutual = concatBytes(pushKey(L), Uint8Array.of(OP.CHECKSIG), pushKey(T), Uint8Array.of(OP.CHECKSIGADD, OP.OP_2, OP.NUMEQUAL));
  const refund = concatBytes(pushNum(t.refundCsv), Uint8Array.of(OP.CSV, OP.DROP), pushKey(T), Uint8Array.of(OP.CHECKSIG));
  const slash = concatBytes(pushKey(E), Uint8Array.of(OP.CHECKSIGVERIFY), pushKey(L), Uint8Array.of(OP.CHECKSIG));
  return { mutual, refund, slash };
}

const compact = (n: number) => Uint8Array.of(n); // all leaves are < 253 bytes
export const leafHash = (s: Uint8Array) => tagged("TapLeaf", Uint8Array.of(LEAF_VERSION), compact(s.length), s);
function branch(a: Uint8Array, b: Uint8Array) { return bytesToHex(a) < bytesToHex(b) ? tagged("TapBranch", a, b) : tagged("TapBranch", b, a); }

export type LeaseNetwork = "bc" | "tb";

/** Tree: ((mutual, refund), slash). Returns the P2TR address, output key and control blocks. */
export function leaseAddress(t: LeaseTerms, network: LeaseNetwork = "bc") {
  const leaves = leaseLeaves(t);
  const h = { mutual: leafHash(leaves.mutual), refund: leafHash(leaves.refund), slash: leafHash(leaves.slash) };
  const left = branch(h.mutual, h.refund);
  const root = branch(left, h.slash);
  const tweak = toBig(tagged("TapTweak", hexToBytes(NUMS_X), root));
  if (tweak >= N) throw new Error("tweak out of range");
  const Q = Point.fromHex("02" + NUMS_X).add(Point.BASE.multiply(tweak));
  const xq = Q.toBytes(true).slice(1);
  const parity = Number(Q.y & 1n);
  const cb = (...path: Uint8Array[]) => bytesToHex(concatBytes(Uint8Array.of(LEAF_VERSION | parity), hexToBytes(NUMS_X), ...path));
  return {
    address: bech32m.encode(network, [1, ...bech32m.toWords(xq)]),
    outputKey: bytesToHex(xq),
    scriptPubKey: "5120" + bytesToHex(xq),
    merkleRoot: bytesToHex(root),
    parity,
    leaves: { mutual: bytesToHex(leaves.mutual), refund: bytesToHex(leaves.refund), slash: bytesToHex(leaves.slash) },
    leafHashes: { mutual: bytesToHex(h.mutual), refund: bytesToHex(h.refund), slash: bytesToHex(h.slash) },
    controlBlocks: { mutual: cb(h.refund, h.slash), refund: cb(h.mutual, h.slash), slash: cb(left) } as Record<LeaseLeaf, string>,
  };
}

/* ---------- spends (script path only) ---------- */

export type LeaseSpendInput = {
  terms: LeaseTerms; network: LeaseNetwork; leaf: LeaseLeaf;
  prevTxid: string; prevVout: number; prevValue: number;
  /** destination output script (hex) and fee in sats; the whole bond minus fee goes there */
  toScript: string; feeSats: number;
};

/** Unsigned v2 spend of the bond via one leaf. Refund sets nSequence = refundCsv (BIP-68). */
export function buildLeaseSpend(i: LeaseSpendInput) {
  const out = i.prevValue - i.feeSats;
  if (out < 330) throw new Error("bond minus fee is below the P2TR dust limit");
  const a = leaseAddress(i.terms, i.network);
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  const seq = i.leaf === "refund" ? i.terms.refundCsv : 0xfffffffd;
  tx.addInput(Buffer.from(hexToBytes(i.prevTxid).reverse()), i.prevVout, seq);
  tx.addOutput(Buffer.from(hexToBytes(i.toScript)), BigInt(out) as never);
  const sighash = tx.hashForWitnessV1(0, [Buffer.from(hexToBytes(a.scriptPubKey))], [BigInt(i.prevValue) as never], bitcoin.Transaction.SIGHASH_DEFAULT, Buffer.from(hexToBytes(a.leafHashes[i.leaf])));
  return { tx, sighash: bytesToHex(sighash), lease: a };
}

/** BIP-340 signature over a leaf sighash (SIGHASH_DEFAULT, 64 bytes). */
export const signLeaf = (sighash: string, secret32: string) => bytesToHex(schnorr.sign(hexToBytes(sighash), hexToBytes(secret32)));

/** Attaches the witness. Signatures are listed in the order the script consumes them. */
export function finalizeLeaseSpend(built: ReturnType<typeof buildLeaseSpend>, leaf: LeaseLeaf, sigs: { landlord?: string; tenant?: string; equivocation?: string }) {
  const need = (s: string | undefined, who: string) => { if (!s) throw new Error(`missing ${who} signature`); return Buffer.from(hexToBytes(s)); };
  const script = Buffer.from(hexToBytes(built.lease.leaves[leaf]));
  const cb = Buffer.from(hexToBytes(built.lease.controlBlocks[leaf]));
  // stack bottom → top; the top item is consumed first
  const stack = leaf === "mutual" ? [need(sigs.tenant, "tenant"), need(sigs.landlord, "landlord")]
    : leaf === "refund" ? [need(sigs.tenant, "tenant")]
    : [need(sigs.landlord, "landlord"), need(sigs.equivocation, "equivocation")];
  built.tx.setWitness(0, [...stack, script, cb]);
  return built.tx.toHex();
}

/** Secret → x-only pubkey (even-Y normalised, as BIP-340 does internally). */
export const xOnly = (secret32: string) => bytesToHex(schnorr.getPublicKey(hexToBytes(secret32)));

/* ---------- write-once cells ---------- */

export const cellMessage = (leaseId: string, cell: number, statement: string) =>
  sha256(utf8ToBytes(`${LEASE_PROTOCOL}|${leaseId}|${cell}|${statement}`));

/** Equivocation key + its single committed nonce for one cell. Device-local secrets. */
export function newCellKey(secret: Uint8Array, nonce: Uint8Array) {
  let d = mod(toBig(secret)); let P = Point.BASE.multiply(d); if ((P.y & 1n) === 1n) { d = N - d; P = P.negate(); }
  let k = mod(toBig(nonce)); let R = Point.BASE.multiply(k); if ((R.y & 1n) === 1n) { k = N - k; R = R.negate(); }
  return { d, k, pub: bytesToHex(P.toBytes(true).slice(1)), r: bytesToHex(R.toBytes(true).slice(1)) };
}
const challenge = (r: string, pub: string, m: Uint8Array) => mod(toBig(tagged("BIP0340/challenge", hexToBytes(r), hexToBytes(pub), m)));

/** BIP-340 signature forced onto the committed nonce (so a second statement leaks d). */
export function signCell(key: ReturnType<typeof newCellKey>, msg: Uint8Array): string {
  const s = mod(key.k + challenge(key.r, key.pub, msg) * key.d);
  return key.r + bytesToHex(to32(s));
}

export type CellAttestation = { msg: Uint8Array; sig: string };

/** Verifies an attestation and that it uses the committed nonce R. */
export function verifyCell(pub: string, committedR: string, a: CellAttestation): boolean {
  return a.sig.slice(0, 64) === committedR && schnorr.verify(hexToBytes(a.sig), a.msg, hexToBytes(pub));
}

/** Two valid, different statements on one cell → the slash key. Null when not equivocation. */
export function extractEquivocationKey(pub: string, committedR: string, a: CellAttestation, b: CellAttestation): string | null {
  if (bytesToHex(a.msg) === bytesToHex(b.msg)) return null;
  if (!verifyCell(pub, committedR, a) || !verifyCell(pub, committedR, b)) return null;
  const s1 = toBig(hexToBytes(a.sig.slice(64))), s2 = toBig(hexToBytes(b.sig.slice(64)));
  const c1 = challenge(committedR, pub, a.msg), c2 = challenge(committedR, pub, b.msg);
  const d = mod((s1 - s2) * inv(c1 - c2));
  return bytesToHex(Point.BASE.multiply(d).toBytes(true).slice(1)) === pub ? bytesToHex(to32(d)) : null;
}
