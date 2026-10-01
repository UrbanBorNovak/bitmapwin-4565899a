// Browser-only Nostr client for per-BITMAP coordinate feeds.
// Posts are kind-1 notes tagged ["t","bitmap"] and ["t","bitmap:<height>"],
// sent straight from the visitor's browser to public relays. No server copy.
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event, type EventTemplate } from "nostr-tools/pure";
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const hexToBytes = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
];

export const coordTag = (height: number) => `bitmap:${height}`;

let pool: SimplePool | null = null;
const getPool = () => (pool ??= new SimplePool());

type Nip07 = { getPublicKey(): Promise<string>; signEvent(e: EventTemplate): Promise<Event> };
const ext = () => (globalThis as unknown as { nostr?: Nip07 }).nostr;
export const hasExtension = () => !!ext();

const LOCAL_KEY = "bitmap.nostr.localKey";
function localSecret(): Uint8Array {
  const saved = localStorage.getItem(LOCAL_KEY);
  if (saved) return hexToBytes(saved);
  const sk = generateSecretKey();
  localStorage.setItem(LOCAL_KEY, bytesToHex(sk));
  return sk;
}
export const localPubkey = () => getPublicKey(localSecret());

export function subscribeCoordinate(height: number, onEvent: (e: Event) => void) {
  const sub = getPool().subscribeMany(
    RELAYS,
    { kinds: [1], "#t": [coordTag(height)], limit: 60 },
    { onevent: (e) => { if (verifyEvent(e)) onEvent(e); } },
  );
  return () => sub.close();
}

export async function postDispatch(height: number, text: string, useExtension: boolean) {
  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["t", "bitmap"], ["t", coordTag(height)]],
    content: `${text.trim()}\n\n— from ${height}.bitmap · bitmapwin.app/bitmap/${height}`,
  };
  const e = useExtension && ext() ? await ext()!.signEvent(template) : finalizeEvent(template, localSecret());
  const results = await Promise.allSettled(getPool().publish(RELAYS, e));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  if (ok === 0) throw new Error("NO RELAY ACCEPTED THE DISPATCH");
  return { event: e, relays: ok };
}
