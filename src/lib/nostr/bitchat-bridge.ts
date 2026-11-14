// BitChat geohash channel bridge. BitChat location channels are ephemeral
// Nostr kind-20000 events tagged ["g", geohash] with an optional ["n", nick].
// We read and post those same events from the browser, so BitChat app users
// in that geohash see Oasis messages and vice versa. Nothing is stored on our
// server. Each geohash gets its own device-held key (unlinkable across places).
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, verifyEvent, type Event } from "nostr-tools/pure";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

export const BITCHAT_KIND = 20000;
export const BITCHAT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://offchain.pub"];
const SEED_KEY = "bitmap.bitchat.seed";
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const isGeohash = (g: string) => /^[0123456789bcdefghjkmnpqrstuvwxyz]{2,7}$/.test(g);

/** Standard geohash encoding of a latitude/longitude. */
export function encodeGeohash(lat: number, lon: number, precision = 5): string {
  let lo = [-90, 90], ln = [-180, 180], out = "", bit = 0, ch = 0, even = true;
  while (out.length < precision) {
    const r = even ? ln : lo, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
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

let pool: SimplePool | null = null;
const getPool = () => (pool ??= new SimplePool());

export type BitchatLine = { id: string; nick: string; pubkey: string; text: string; at: number };
export function toLine(e: Event): BitchatLine {
  const nick = e.tags.find((t) => t[0] === "n")?.[1] || `anon#${e.pubkey.slice(-4)}`;
  return { id: e.id, nick, pubkey: e.pubkey, text: e.content.slice(0, 500), at: e.created_at };
}

export function subscribeBitchat(gh: string, onLine: (l: BitchatLine) => void) {
  const sub = getPool().subscribeMany(
    BITCHAT_RELAYS,
    { kinds: [BITCHAT_KIND], "#g": [gh], since: Math.floor(Date.now() / 1000) - 3600, limit: 100 },
    { onevent: (e) => { if (verifyEvent(e) && e.tags.some((t) => t[0] === "g" && t[1] === gh)) onLine(toLine(e)); } },
  );
  return () => sub.close();
}

export async function postBitchat(gh: string, nick: string, text: string) {
  const body = text.trim().slice(0, 500);
  if (!body) throw new Error("EMPTY MESSAGE");
  const tags = [["g", gh]];
  if (nick.trim()) tags.push(["n", nick.trim().slice(0, 24)]);
  const e = finalizeEvent({ kind: BITCHAT_KIND, created_at: Math.floor(Date.now() / 1000), tags, content: body }, geohashKey(gh));
  const r = await Promise.allSettled(getPool().publish(BITCHAT_RELAYS, e));
  if (!r.some((x) => x.status === "fulfilled")) throw new Error("NO RELAY ACCEPTED THE MESSAGE");
  return toLine(e);
}
