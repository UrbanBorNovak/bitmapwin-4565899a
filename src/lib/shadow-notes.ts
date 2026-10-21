/**
 * Shadow Notes — device-held items checked by client-side validation.
 *
 * A note is a hash chain. Each link seals the note to the next holder's
 * commitment (sha256 of a secret only that holder's device knows). Anyone can
 * re-walk the chain; only the holder of the latest secret can move it on.
 * No server sees notes. This phase has no Bitcoin seal yet, so a sender who
 * kept an old copy could hand it to two people — the vault says so plainly.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { randomSecret } from "@/lib/shadow-vault";

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const h = (s: string) => hex(sha256(enc.encode(s)));

export const ownerCommit = (secret: string) => h(`bitmapwin:note:owner|${secret}`);

export type Link = { to: string; prev: string; hash: string; at: string };
export type ShadowNote = { v: 1; label: string; kind: string; genesis: string; chain: Link[] };
export type HeldNote = { note: ShadowNote; secret: string };

const linkHash = (prev: string, to: string, at: string) => h(`bitmapwin:note:link|${prev}|${to}|${at}`);

export function mintNote(label: string, kind: string, secret: string, at = new Date().toISOString()): ShadowNote {
  const genesis = h(`bitmapwin:note:genesis|${kind}|${label}|${at}|${ownerCommit(secret)}`);
  return { v: 1, label, kind, genesis, chain: [{ to: ownerCommit(secret), prev: genesis, at, hash: linkHash(genesis, ownerCommit(secret), at) }] };
}

/** Moves a note to a recipient commitment. Requires the current holder's secret. */
export function transferNote(held: HeldNote, toCommit: string, at = new Date().toISOString()): ShadowNote {
  const tip = held.note.chain.at(-1)!;
  if (tip.to !== ownerCommit(held.secret)) throw new Error("YOU DO NOT HOLD THIS NOTE");
  if (!/^[0-9a-f]{64}$/.test(toCommit)) throw new Error("BAD RECEIVE CODE");
  return { ...held.note, chain: [...held.note.chain, { to: toCommit, prev: tip.hash, at, hash: linkHash(tip.hash, toCommit, at) }] };
}

/** Client-side validation: every link must hash correctly and point at the one before it. */
export function verifyNote(n: ShadowNote): boolean {
  if (n?.v !== 1 || !Array.isArray(n.chain) || !n.chain.length) return false;
  const first = n.chain[0]!;
  if (n.genesis !== h(`bitmapwin:note:genesis|${n.kind}|${n.label}|${first.at}|${first.to}`)) return false;
  let prev = n.genesis;
  for (const l of n.chain) {
    if (l.prev !== prev || l.hash !== linkHash(l.prev, l.to, l.at)) return false;
    prev = l.hash;
  }
  return true;
}

export const encodeNote = (n: ShadowNote) => `SHADOW-NOTE-v1.${btoa(unescape(encodeURIComponent(JSON.stringify(n))))}`;
export function decodeNote(s: string): ShadowNote | null {
  const m = /^SHADOW-NOTE-v1\.(.+)$/.exec(s.trim());
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(m[1]!)))) as ShadowNote; } catch { return null; }
}

/* ── device storage ── */
const KEY = "bitmapwin:shadow-notes";
const RECV = "bitmapwin:shadow-note-recv";
export function loadNotes(): HeldNote[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as HeldNote[]; } catch { return []; }
}
export function saveNotes(list: HeldNote[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

/** One standing receive secret per device; its commitment is the receive code. */
export function receiveSecret(): string {
  let s = localStorage.getItem(RECV);
  if (!s) { s = randomSecret(); localStorage.setItem(RECV, s); }
  return s;
}
/** After accepting a note the receive secret is spent into it and rotated. */
export function rotateReceive() { localStorage.removeItem(RECV); }
