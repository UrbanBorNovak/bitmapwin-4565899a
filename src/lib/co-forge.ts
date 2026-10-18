/**
 * CO-FORGE — multiplayer recursive assembly rooms.
 *
 * Players in one room share a BWVX_ASM build: inscribed pieces are placed by
 * inscription id (one tiny op each) and loose blocks fill the gaps. Ops are
 * plain JSON, merged last-write-wins by (time, author), so every browser that
 * replays the same ops reaches the same build. Pure — no network here.
 */
import { MAX_ASM_PARTS, isInscriptionId, type AsmPart } from "@/lib/forge-assembly";

export type CoOp =
  | { op: "p+"; oid: string; id: string; x: number; y: number; z: number; r: number }
  | { op: "p-"; oid: string }
  | { op: "b+"; x: number; y: number; z: number; k: number }
  | { op: "b-"; x: number; y: number; z: number };

export type Stamp = { t: number; by: string };
export type CoPart = AsmPart & Stamp & { oid: string; alive: boolean };
export type CoBlock = Stamp & { k: number | null };
export type CoState = { parts: Map<string, CoPart>; blocks: Map<string, CoBlock> };

export const emptyState = (): CoState => ({ parts: new Map(), blocks: new Map() });

const newer = (a: Stamp, b: Stamp) => a.t > b.t || (a.t === b.t && a.by > b.by);
const inCanvas = (n: unknown, span: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < span;

/** Validates an op from the wire. Anything malformed is dropped. */
export function parseOp(raw: unknown, span = 64): CoOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { op?: unknown; oid?: unknown; id?: unknown; x?: unknown; y?: unknown; z?: unknown; r?: unknown; k?: unknown };
  const xyz = inCanvas(o.x, span) && inCanvas(o.y, span) && inCanvas(o.z, span);
  const oid = typeof o.oid === "string" && /^[a-z0-9]{4,24}$/.test(o.oid) ? o.oid : null;
  if (o.op === "p+" && oid && typeof o.id === "string" && isInscriptionId(o.id) && xyz && Number.isInteger(o.r))
    return { op: "p+", oid, id: o.id, x: o.x as number, y: o.y as number, z: o.z as number, r: (((o.r as number) % 4) + 4) % 4 };
  if (o.op === "p-" && oid) return { op: "p-", oid };
  if (o.op === "b+" && xyz && Number.isInteger(o.k) && (o.k as number) >= 0 && (o.k as number) < 64)
    return { op: "b+", x: o.x as number, y: o.y as number, z: o.z as number, k: o.k as number };
  if (o.op === "b-" && xyz) return { op: "b-", x: o.x as number, y: o.y as number, z: o.z as number };
  return null;
}

/** Applies one op in place; older ops never overwrite newer ones, so arrival order does not matter. */
export function applyOp(s: CoState, op: CoOp, stamp: Stamp): void {
  if (op.op === "p+" || op.op === "p-") {
    const cur = s.parts.get(op.oid);
    if (cur && !newer(stamp, cur)) return;
    if (op.op === "p+") s.parts.set(op.oid, { oid: op.oid, id: op.id, x: op.x, y: op.y, z: op.z, r: op.r, alive: true, ...stamp });
    else s.parts.set(op.oid, { ...(cur ?? { oid: op.oid, id: "", x: 0, y: 0, z: 0, r: 0 }), alive: false, ...stamp });
    return;
  }
  const key = `${op.x},${op.y},${op.z}`;
  const cur = s.blocks.get(key);
  if (cur && !newer(stamp, cur)) return;
  s.blocks.set(key, { k: op.op === "b+" ? op.k : null, ...stamp });
}

export const liveParts = (s: CoState) => [...s.parts.values()].filter((p) => p.alive && p.id).sort((a, b) => a.t - b.t || (a.oid < b.oid ? -1 : 1));
export const liveBlocks = (s: CoState) =>
  [...s.blocks.entries()].filter(([, b]) => b.k !== null).map(([k, b]) => { const [dx, dy, dz] = k.split(",").map(Number); return { dx: dx!, dy: dy!, dz: dz!, k: b.k! }; });

/** What the room master inscribes: the oldest MAX_ASM_PARTS placements + every loose block. */
export function exportAssembly(s: CoState) {
  const all = liveParts(s);
  return { parts: all.slice(0, MAX_ASM_PARTS).map(({ id, x, y, z, r }) => ({ id, x, y, z, r })), dropped: all.length - Math.min(all.length, MAX_ASM_PARTS), own: liveBlocks(s) };
}

export const roomTag = (room: string) => `bitmapwin-coforge:${roomName(room)}${roomOwner(room) ? ":" + roomOwner(room) : ""}`;
export const newOid = () => Math.random().toString(36).slice(2, 12);

/* ---------------- Room ownership ----------------
 * A room id is "<name>@<owner pubkey>", so only the owner's signed control
 * events can change who builds. Visitors always see the build; only the owner
 * and approved builders' ops count, and while locked only the owner's do.
 * Removing someone drops all their ops, so the build is replayed from history. */
/** seal: builder batches the owner had accepted at lock time (event id prefixes); deny: builder batches that arrived while locked. */
/** keep: work of revoked builders that stays (event id prefixes); purge: builders whose whole contribution is removed. */
export type RoomConfig = { allow: string[]; locked: boolean; t: number; seal: string[]; deny: string[]; keep: string[]; purge: string[] };
/** id = the signed Nostr event id; it, not the self-reported time, decides lock rules. */
export type Batch = { ops: CoOp[]; t: number; by: string; id: string };
export const openConfig = (): RoomConfig => ({ allow: [], locked: false, t: 0, seal: [], deny: [], keep: [], purge: [] });
export const SEAL_MAX = 4000;
export const sealId = (eventId: string) => eventId.slice(0, 16);

const HEX64 = /^[0-9a-f]{64}$/;
export const roomOwner = (room: string): string | null => { const o = room.split("@")[1]; return o && HEX64.test(o) ? o : null; };
export const roomName = (room: string) => room.split("@")[0]!.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
export const makeRoom = (name: string, owner: string) => `${roomName(name)}@${owner}`;

/** Accepts a control event only if the owner signed it and it is newer than the current one. */
export function nextConfig(cur: RoomConfig, owner: string, by: string, raw: unknown, t: number): RoomConfig {
  if (by !== owner || t <= cur.t || !raw || typeof raw !== "object") return cur;
  const c = raw as { allow?: unknown; locked?: unknown; seal?: unknown; deny?: unknown; keep?: unknown; purge?: unknown };
  const keys = (v: unknown) => (Array.isArray(v) ? v.filter((p): p is string => typeof p === "string" && HEX64.test(p)).slice(0, 200) : []);
  const allow = keys(c.allow);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f]{16}$/.test(x)).slice(0, SEAL_MAX) : []);
  return { allow, locked: c.locked === true, t, seal: ids(c.seal), deny: ids(c.deny), keep: ids(c.keep), purge: keys(c.purge) };
}

export function canEdit(cfg: RoomConfig, owner: string, who: string) {
  return who === owner || (!cfg.locked && cfg.allow.includes(who));
}

/**
 * Whether a builder batch counts. Timestamps are never trusted here: while locked only
 * batches in the owner's seal count, and batches the owner saw arrive during a lock stay denied.
 */
export function batchCounts(b: Batch, cfg: RoomConfig, owner: string) {
  if (b.by === owner) return true;
  if (cfg.purge.includes(b.by)) return false;
  const id = sealId(b.id);
  // Revoked builders: only the work the owner kept when revoking them still counts.
  if (!cfg.allow.includes(b.by)) return cfg.keep.includes(id) && !cfg.deny.includes(id);
  if (cfg.deny.includes(id)) return false;
  return !cfg.locked || cfg.seal.includes(id);
}

/** Builder batches the owner currently accepts — what a new lock seals. */
export const sealFor = (batches: Batch[], cfg: RoomConfig, owner: string) =>
  [...new Set(batches.filter((b) => b.by !== owner && batchCounts(b, { ...cfg, locked: false }, owner)).map((b) => sealId(b.id)))].slice(-SEAL_MAX);

/** Replays history under the current rules, in any arrival order. */
export function buildState(batches: Batch[], cfg: RoomConfig, owner: string): CoState {
  const s = emptyState();
  for (const b of batches) {
    if (!batchCounts(b, cfg, owner)) continue;
    b.ops.forEach((o) => applyOp(s, o, { t: b.t, by: b.by }));
  }
  return s;
}

/** Revoking a builder keeps every move of theirs the owner currently accepts, and nothing after. */
export const keepFor = (batches: Batch[], cfg: RoomConfig, owner: string, who: string) =>
  batches.filter((b) => b.by === who && batchCounts(b, cfg, owner)).map((b) => sealId(b.id));
