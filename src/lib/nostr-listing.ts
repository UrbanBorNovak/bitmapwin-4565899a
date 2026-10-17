// Open BITMAP orderbook on Nostr. A listing is a NIP-99 style replaceable event
// (kind 30402) that carries the seller's own signed listing PSBT. The Nostr key is
// only a messenger: the PSBT signature and the chain decide what can be bought.
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export const NOSTR_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://relay.nostr.band"];
export const LISTING_KIND = 30402;
export const LISTING_TAG = "bitmap-listing";

export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

export type ListingFields = {
  height: number;
  inscriptionId: string;
  outpoint: string; // txid:vout
  priceSats: number;
  psbtBase64: string;
  seller: string; // payout address
};

export function listingTags(f: ListingFields): string[][] {
  return [
    ["d", `bitmap:${f.height}:${f.outpoint}`],
    ["t", LISTING_TAG],
    ["t", "bitmap"],
    ["title", `${f.height}.bitmap`],
    ["height", String(f.height)],
    ["inscription", f.inscriptionId],
    ["utxo", f.outpoint],
    ["price", String(f.priceSats), "SAT"],
    ["seller", f.seller],
    ["psbt", f.psbtBase64],
  ];
}

/** NIP-01 event id: sha256 of the canonical serialization. */
export function eventId(e: Omit<NostrEvent, "id" | "sig">): string {
  const ser = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
  return bytesToHex(sha256(new TextEncoder().encode(ser)));
}

export function signEvent(tags: string[][], content: string, secretHex: string, createdAt = Math.floor(Date.now() / 1000)): NostrEvent {
  const sk = hexToBytes(secretHex);
  const pubkey = bytesToHex(schnorr.getPublicKey(sk));
  const base = { pubkey, created_at: createdAt, kind: LISTING_KIND, tags, content };
  const id = eventId(base);
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), sk));
  return { ...base, id, sig };
}

export function verifyEvent(e: NostrEvent): boolean {
  try {
    return eventId(e) === e.id && schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
}

const KEY = "bitmap.nostr.listing-key";
/** Device-held messenger key so the same device can replace its own listings. */
export function deviceNostrKey(): string {
  let k = localStorage.getItem(KEY);
  if (!k || !/^[0-9a-f]{64}$/.test(k)) {
    k = bytesToHex(schnorr.utils.randomSecretKey());
    localStorage.setItem(KEY, k);
  }
  return k;
}

/** Sends the event to every relay; resolves with the relays that accepted it. */
export function publishEvent(e: NostrEvent, relays = NOSTR_RELAYS, timeoutMs = 7000): Promise<string[]> {
  return Promise.all(
    relays.map(
      (url) =>
        new Promise<string | null>((resolve) => {
          let done = false;
          const finish = (v: string | null) => {
            if (done) return;
            done = true;
            try { ws.close(); } catch { /* closed */ }
            resolve(v);
          };
          const ws = new WebSocket(url);
          const t = setTimeout(() => finish(null), timeoutMs);
          ws.onopen = () => ws.send(JSON.stringify(["EVENT", e]));
          ws.onmessage = (m) => {
            try {
              const d = JSON.parse(String(m.data));
              if (d[0] === "OK" && d[1] === e.id) { clearTimeout(t); finish(d[2] ? url : null); }
            } catch { /* ignore */ }
          };
          ws.onerror = () => { clearTimeout(t); finish(null); };
        }),
    ),
  ).then((r) => r.filter((x): x is string => !!x));
}
