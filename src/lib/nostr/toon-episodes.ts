// Browser-only: Toon Studio episodes as NIP-78 (kind 30078) replaceable events.
// content = the episode JSON; ["d", slug] lets the author update it in place.
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event, type EventTemplate } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import { RELAYS } from "@/lib/nostr/coordinate";

export const TOON_KIND = 30078;
export const TOON_TAG = "bitmapwin-toon";
export const MAX_EPISODE_BYTES = 60_000;

let pool: SimplePool | null = null;
const getPool = () => (pool ??= new SimplePool());
type Nip07 = { getPublicKey(): Promise<string>; signEvent(e: EventTemplate): Promise<Event> };
const ext = () => (globalThis as unknown as { nostr?: Nip07 }).nostr;
export const hasNostrExtension = () => !!ext();

const KEY = "bitmap.nostr.localKey";
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
function localSecret(): Uint8Array {
  const s = localStorage.getItem(KEY);
  if (s) return Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
  const sk = generateSecretKey();
  localStorage.setItem(KEY, hex(sk));
  return sk;
}

export const slugFor = (title: string) =>
  (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "episode");

export function episodeTemplate(json: string, title: string, aspect: string, createdAt = Math.floor(Date.now() / 1000)): EventTemplate {
  return {
    kind: TOON_KIND,
    created_at: createdAt,
    tags: [["d", `toon:${slugFor(title)}`], ["t", TOON_TAG], ["title", title.slice(0, 120)], ["format", aspect], ["client", "bitmapwin.app/toon"]],
    content: json,
  };
}

export async function publishEpisode(json: string, title: string, aspect: string, useExtension: boolean) {
  if (new TextEncoder().encode(json).length > MAX_EPISODE_BYTES) throw new Error("EPISODE TOO BIG FOR RELAYS (60 KB MAX)");
  const t = episodeTemplate(json, title, aspect);
  const e = useExtension && ext() ? await ext()!.signEvent(t) : finalizeEvent(t, localSecret());
  const res = await Promise.allSettled(getPool().publish(RELAYS, e));
  const ok = res.filter((r) => r.status === "fulfilled").length;
  if (!ok) throw new Error("NO RELAY ACCEPTED THE EPISODE");
  const d = e.tags.find((x) => x[0] === "d")?.[1] ?? "";
  return { event: e, relays: ok, naddr: nip19.naddrEncode({ kind: TOON_KIND, pubkey: e.pubkey, identifier: d, relays: RELAYS.slice(0, 2) }) };
}

const isToon = (e: Event) => verifyEvent(e) && e.kind === TOON_KIND && e.tags.some((t) => t[0] === "t" && t[1] === TOON_TAG);

/** Latest version of one episode by naddr. */
export async function fetchEpisode(naddr: string): Promise<Event | null> {
  const d = nip19.decode(naddr);
  if (d.type !== "naddr" || d.data.kind !== TOON_KIND) throw new Error("NOT A TOON EPISODE LINK");
  const evs = await getPool().querySync(RELAYS, { kinds: [TOON_KIND], authors: [d.data.pubkey], "#d": [d.data.identifier] }, { maxWait: 6000 });
  return evs.filter(isToon).sort((a, b) => b.created_at - a.created_at)[0] ?? null;
}

/** Recent community episodes, newest version per author+d. */
export async function recentEpisodes(limit = 30): Promise<Event[]> {
  const evs = await getPool().querySync(RELAYS, { kinds: [TOON_KIND], "#t": [TOON_TAG], limit }, { maxWait: 6000 });
  const best = new Map<string, Event>();
  for (const e of evs.filter(isToon)) {
    const k = e.pubkey + (e.tags.find((t) => t[0] === "d")?.[1] ?? "");
    if (!best.has(k) || best.get(k)!.created_at < e.created_at) best.set(k, e);
  }
  return [...best.values()].sort((a, b) => b.created_at - a.created_at);
}

export const naddrOf = (e: Event) =>
  nip19.naddrEncode({ kind: TOON_KIND, pubkey: e.pubkey, identifier: e.tags.find((t) => t[0] === "d")?.[1] ?? "", relays: RELAYS.slice(0, 2) });
export const titleOf = (e: Event) => e.tags.find((t) => t[0] === "title")?.[1] ?? "Untitled episode";
export const myLocalPubkey = () => getPublicKey(localSecret());

/** Device key backup/restore (nsec). Same key used by BITMAP dispatches on this device. */
export const myNpub = () => nip19.npubEncode(myLocalPubkey());
export const exportNsec = () => nip19.nsecEncode(localSecret());
export function importNsec(nsec: string) {
  const d = nip19.decode(nsec.trim());
  if (d.type !== "nsec") throw new Error("THAT IS NOT AN NSEC KEY");
  localStorage.setItem(KEY, hex(d.data));
  return nip19.npubEncode(getPublicKey(d.data));
}
