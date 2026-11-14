// BitChat geohash channel bridge, matched to BitChat's protocol (iOS + Android, checked 2026-11-14):
// - Messages are kind-20000 events tagged ["g", geohash], optional ["n", nick].
// - Phones only use the 5 relays CLOSEST to the geohash centre, from the relay list
//   shipped in each app (iOS and Android lists differ), so we use the union of both picks.
// - We add a NIP-13 proof of work (12 bits, Android's default when its filter is on;
//   iOS mines 8 bits and only scores it).
// Nothing is stored on our server. Each geohash gets its own device-held key.
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, getEventHash, getPublicKey, verifyEvent, type Event } from "nostr-tools/pure";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import geoRelays from "@/lib/vendor/bitchat-georelays.json";

export const BITCHAT_KIND = 20000;
export const POW_BITS = 12;
export const RELAYS_PER_APP = 5;
const SEED_KEY = "bitmap.bitchat.seed";
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const isGeohash = (g: string) => /^[0123456789bcdefghjkmnpqrstuvwxyz]{2,7}$/.test(g);

/** Standard geohash encoding of a latitude/longitude. */
export function encodeGeohash(lat: number, lon: number, precision = 5): string {
  let lo: [number, number] = [-90, 90], ln: [number, number] = [-180, 180], out = "", bit = 0, ch = 0, even = true;
  while (out.length < precision) {
    const r = even ? ln : lo, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

/** Centre of a geohash cell. */
export function decodeGeohashCenter(gh: string): { lat: number; lon: number } {
  const lat: [number, number] = [-90, 90], lon: [number, number] = [-180, 180];
  let even = true;
  for (const c of gh) {
    const v = B32.indexOf(c);
    for (let b = 4; b >= 0; b--) {
      const r = even ? lon : lat, mid = (r[0] + r[1]) / 2;
      if ((v >> b) & 1) r[0] = mid; else r[1] = mid;
      even = !even;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lon: (lon[0] + lon[1]) / 2 };
}

function haversineKm(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180, dLat = (c - a) * rad, dLon = (d - b) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type Row = [string, number, number];
/** Same pick as the apps: nearest first, ties broken by host name. */
export function closestRelays(rows: Row[], gh: string, n = RELAYS_PER_APP): string[] {
  const { lat, lon } = decodeGeohashCenter(gh);
  return rows
    .map((r) => ({ h: r[0], d: haversineKm(lat, lon, r[1], r[2]) }))
    .sort((x, y) => x.d - y.d || (x.h < y.h ? -1 : x.h > y.h ? 1 : 0))
    .slice(0, n)
    .map((r) => `wss://${r.h}`);
}

/** Relays a BitChat iPhone or Android phone in this geohash is reading and writing. */
export function bitchatRelaysFor(gh: string): string[] {
  const g = geoRelays as { ios: Row[]; android: Row[] };
  return [...new Set([...closestRelays(g.ios, gh), ...closestRelays(g.android, gh)])];
}

function seed(): Uint8Array {
  const s = localStorage.getItem(SEED_KEY);
  if (s) return Uint8Array.from(s.match(/../g)!, (x) => parseInt(x, 16));
  const b = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(SEED_KEY, Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""));
  return b;
}
/** Per-geohash secret key, derived from a device seed. */
export const geohashKey = (gh: string) => hmac(sha256, seed(), new TextEncoder().encode(`bitchat-geo:${gh}`));

export function leadingZeroBits(hex: string): number {
  let n = 0;
  for (const c of hex) {
    const v = parseInt(c, 16);
    if (v === 0) { n += 4; continue; }
    return n + Math.clz32(v) - 28;
  }
  return n;
}

/** NIP-13: append ["nonce", n, bits] until the event id has `bits` leading zero bits. */
export async function mineNonce(t: { pubkey: string; created_at: number; kind: number; tags: string[][]; content: string }, bits = POW_BITS) {
  const deadline = Date.now() + 3000;
  for (let i = 0; ; i++) {
    const tags = [...t.tags, ["nonce", String(i), String(bits)]];
    if (leadingZeroBits(getEventHash({ ...t, tags })) >= bits) return tags;
    if (i % 2000 === 1999) {
      if (Date.now() > deadline) return t.tags; // never block sending
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

let pool: SimplePool | null = null;
const getPool = () => (pool ??= new SimplePool());

export type BitchatLine = { id: string; nick: string; pubkey: string; text: string; at: number; mine?: boolean };
export function toLine(e: Event): BitchatLine {
  const nick = e.tags.find((t) => t[0] === "n")?.[1] || "anon";
  return { id: e.id, nick: `${nick}#${e.pubkey.slice(-4)}`, pubkey: e.pubkey, text: e.content.slice(0, 500), at: e.created_at };
}

export function subscribeBitchat(gh: string, onLine: (l: BitchatLine) => void) {
  const sub = getPool().subscribeMany(
    bitchatRelaysFor(gh),
    { kinds: [BITCHAT_KIND], "#g": [gh], since: Math.floor(Date.now() / 1000) - 3600, limit: 200 },
    { onevent: (e) => { if (verifyEvent(e) && e.tags.some((t) => t[0] === "g" && t[1] === gh)) onLine(toLine(e)); } },
  );
  return () => sub.close();
}

/** Which of this channel's relays currently hold an open socket. */
export function bitchatRelayStatus(gh: string): { url: string; connected: boolean }[] {
  const live = pool?.listConnectionStatus() ?? new Map<string, boolean>();
  const norm = (u: string) => u.replace(/\/$/, "");
  return bitchatRelaysFor(gh).map((url) => ({ url, connected: [...live.entries()].some(([u, ok]) => ok && norm(u) === url) }));
}

/** Mine proof of work and sign a BitChat channel message (nothing is sent yet). */
export async function signBitchat(gh: string, nick: string, text: string): Promise<Event> {
  const content = text.trim().slice(0, 500);
  if (!content) throw new Error("EMPTY MESSAGE");
  const sk = geohashKey(gh);
  const base = [["g", gh]];
  if (nick.trim()) base.push(["n", nick.trim().slice(0, 24)]);
  const created_at = Math.floor(Date.now() / 1000);
  const tags = await mineNonce({ pubkey: getPublicKey(sk), created_at, kind: BITCHAT_KIND, tags: base, content });
  return finalizeEvent({ kind: BITCHAT_KIND, created_at, tags, content }, sk);
}

/** Relay answers only. Acceptance means a relay stored/forwarded it, never that anyone read it. */
export type RelayOutcome = { accepted: string[]; rejected: { url: string; reason: string }[]; of: number };
export type SendState = { kind: "sending" } | { kind: "accepted"; outcome: RelayOutcome } | { kind: "failed"; outcome?: RelayOutcome; reason: string };

export function sendStateFrom(outcome: RelayOutcome): SendState {
  return outcome.accepted.length > 0
    ? { kind: "accepted", outcome }
    : { kind: "failed", outcome, reason: outcome.rejected[0]?.reason || "NO RELAY ANSWERED" };
}

export async function publishBitchat(gh: string, e: Event): Promise<RelayOutcome> {
  const relays = bitchatRelaysFor(gh);
  const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error("TIMED OUT")), 8000))]);
  const r = await Promise.allSettled(getPool().publish(relays, e).map(timeout));
  const out: RelayOutcome = { accepted: [], rejected: [], of: relays.length };
  r.forEach((x, i) => {
    if (x.status === "fulfilled") out.accepted.push(relays[i]!);
    else out.rejected.push({ url: relays[i]!, reason: String((x.reason as Error)?.message ?? x.reason).slice(0, 80) });
  });
  return out;
}

export async function postBitchat(gh: string, nick: string, text: string) {
  const e = await signBitchat(gh, nick, text);
  const o = await publishBitchat(gh, e);
  if (!o.accepted.length) throw new Error("NO BITCHAT RELAY ACCEPTED THE MESSAGE");
  return { line: { ...toLine(e), mine: true }, relays: o.accepted.length, of: o.of };
}
