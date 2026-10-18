// Browser-only Nostr transport for Co-Forge rooms. Each event carries a small
// batch of build ops, signed by a device key; relays keep them so late joiners replay the room.
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { RELAYS } from "@/lib/nostr/coordinate";
import { parseOp, roomTag, type CoOp } from "@/lib/co-forge";

export const CO_FORGE_KIND = 7417;
/** Room control: owner config {cfg} and join requests {hello}. */
export const CO_FORGE_CTRL_KIND = 7418;
const KEY = "bitmap.coforge.key";
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
function secret(): Uint8Array {
  const s = localStorage.getItem(KEY);
  if (s) return Uint8Array.from(s.match(/../g)!, (x) => parseInt(x, 16));
  const k = generateSecretKey();
  localStorage.setItem(KEY, hex(k));
  return k;
}
export const myPubkey = () => getPublicKey(secret());

let pool: SimplePool | null = null;
const P = () => (pool ??= new SimplePool());

export type RoomBatch = { ops: CoOp[]; t: number; by: string; id: string };

export type RoomCtrl = { by: string; t: number; cfg?: unknown; hello?: boolean };

export function joinRoom(room: string, onBatch: (b: RoomBatch) => void, onCtrl: (c: RoomCtrl) => void = () => {}) {
  const sub = P().subscribeMany(RELAYS, { kinds: [CO_FORGE_KIND, CO_FORGE_CTRL_KIND], "#t": [roomTag(room)], since: Math.floor(Date.now() / 1000) - 7 * 86400, limit: 2000 }, {
    onevent: (e) => {
      if (!verifyEvent(e)) return;
      try {
        const c = JSON.parse(e.content) as { ops?: unknown[]; t?: number; cfg?: unknown; hello?: unknown };
        if (e.kind === CO_FORGE_CTRL_KIND) { onCtrl({ by: e.pubkey, t: Number.isFinite(c.t) ? c.t! : e.created_at * 1000, cfg: c.cfg, hello: c.hello === true }); return; }
        const ops = (c.ops ?? []).slice(0, 400).map((o) => parseOp(o)).filter((o): o is CoOp => !!o);
        const t = Number.isFinite(c.t) ? Math.min(c.t!, e.created_at * 1000 + 60_000) : e.created_at * 1000;
        if (ops.length) onBatch({ ops, t, by: e.pubkey, id: e.id });
      } catch { /* not ours */ }
    },
  });
  return () => sub.close();
}

export async function sendOps(room: string, ops: CoOp[], t: number) {
  const e = finalizeEvent({ kind: CO_FORGE_KIND, created_at: Math.floor(t / 1000), tags: [["t", roomTag(room)]], content: JSON.stringify({ v: 1, t, ops }) }, secret());
  const r = await Promise.allSettled(P().publish(RELAYS, e));
  if (!r.some((x) => x.status === "fulfilled")) throw new Error("NO RELAY ACCEPTED THE MOVE");
  return e.id;
}

export async function sendCtrl(room: string, body: { cfg?: { allow: string[]; locked: boolean; seal?: string[]; deny?: string[] }; hello?: true }) {
  const t = Date.now();
  const e = finalizeEvent({ kind: CO_FORGE_CTRL_KIND, created_at: Math.floor(t / 1000), tags: [["t", roomTag(room)]], content: JSON.stringify({ v: 1, t, ...body }) }, secret());
  const r = await Promise.allSettled(P().publish(RELAYS, e));
  if (!r.some((x) => x.status === "fulfilled")) throw new Error("NO RELAY ACCEPTED THE CHANGE");
  return t;
}
