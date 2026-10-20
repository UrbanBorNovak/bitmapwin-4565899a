/**
 * AGENT COLONY — wandering citizens of the Oasis.
 * Each citizen walks a fixed loop of landmarks; position and activity are pure
 * functions of wall-clock time, so every visitor and the Colony dashboard see
 * the same citizen in the same place with no server state.
 *
 * Citizens can only walk and talk. Anything that trades or spends goes into
 * the owner approval queue and never runs on its own; an approved action only
 * opens the normal flow where the owner signs in their own wallet.
 */
import { useSyncExternalStore } from "react";
import { LANDMARKS, landmarkSpot } from "./world-landmarks";
import { WORLD_CELL } from "./player-state";

export type Citizen = {
  id: string;
  name: string;
  role: string;
  color: string;
  /** landmark ids visited in order, looping */
  route: string[];
  /** world units per second */
  speed: number;
  /** seconds spent at each stop */
  dwell: number;
  /** what they do at a stop */
  doing: string;
};

export const CITIZENS: Citizen[] = [
  { id: "cartographer", name: "ODA THE CARTOGRAPHER", role: "Surveyor", color: "#28e0ff", route: ["torii", "tower", "arena", "bit-cafe"], speed: 6, dwell: 20, doing: "sketching the skyline" },
  { id: "courier", name: "PIP THE COURIER", role: "Messenger", color: "#f7931a", route: ["bit-cafe", "trading-post", "bit-museum", "mayor-pepe"], speed: 10, dwell: 10, doing: "delivering dispatches" },
  { id: "archivist", name: "SAGE THE ARCHIVIST", role: "Historian", color: "#c9b6ff", route: ["bit-museum", "torii", "mayor-pepe"], speed: 5, dwell: 30, doing: "reading block records aloud" },
  { id: "broker", name: "MARGO THE BROKER", role: "Market watcher", color: "#7dff9a", route: ["trading-post", "bit-cafe", "arena"], speed: 7, dwell: 25, doing: "reading the price board" },
  { id: "warden", name: "IRON WARDEN", role: "Patrol", color: "#ff5566", route: ["arena", "tower", "trading-post", "torii"], speed: 8, dwell: 12, doing: "standing guard" },
  { id: "bard", name: "LUTE THE BARD", role: "Entertainer", color: "#ffd84a", route: ["mayor-pepe", "bit-cafe", "bit-museum"], speed: 4, dwell: 35, doing: "singing about the halvings" },
].map((c) => ({ ...c, route: c.route.filter((id) => LANDMARKS.some((l) => l.id === id)) }))
  .filter((c) => c.route.length >= 2);

const spotOf = (id: string) => landmarkSpot(LANDMARKS.find((l) => l.id === id)!);
const labelOf = (id: string) => LANDMARKS.find((l) => l.id === id)?.label ?? id.toUpperCase();

/** Stable per-citizen offset so they don't stand on the landmark itself or in sync. */
function stopPoint(c: Citizen, i: number) {
  const s = spotOf(c.route[i]!);
  const a = (c.id.length * 1.7 + i * 2.3) % (Math.PI * 2);
  return { x: s.x + Math.cos(a) * WORLD_CELL * 1.2, z: s.z + Math.sin(a) * WORLD_CELL * 1.2 };
}

function legs(c: Citizen) {
  return c.route.map((_, i) => {
    const a = stopPoint(c, i);
    const b = stopPoint(c, (i + 1) % c.route.length);
    const walk = Math.hypot(b.x - a.x, b.z - a.z) / c.speed;
    return { i, a, b, walk, total: c.dwell + walk };
  });
}

export type CitizenState = {
  x: number; z: number; yaw: number;
  moving: boolean;
  activity: string;
  at: string;
  next: string;
};

/** Where a citizen is and what they're doing `tSec` seconds since the epoch. */
export function citizenAt(c: Citizen, tSec: number): CitizenState {
  const L = legs(c);
  const cycle = L.reduce((n, l) => n + l.total, 0);
  let t = ((tSec + c.id.length * 37) % cycle + cycle) % cycle;
  for (const l of L) {
    if (t < l.total) {
      const here = c.route[l.i]!;
      const there = c.route[(l.i + 1) % c.route.length]!;
      const yaw = Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z);
      if (t < c.dwell) return { x: l.a.x, z: l.a.z, yaw, moving: false, activity: `${c.doing} at ${labelOf(here)}`, at: here, next: there };
      const k = (t - c.dwell) / l.walk;
      return { x: l.a.x + (l.b.x - l.a.x) * k, z: l.a.z + (l.b.z - l.a.z) * k, yaw, moving: true, activity: `walking to ${labelOf(there)}`, at: here, next: there };
    }
    t -= l.total;
  }
  const a = stopPoint(c, 0);
  return { x: a.x, z: a.z, yaw: 0, moving: false, activity: c.doing, at: c.route[0]!, next: c.route[1]! };
}

/* ---------- owner approval gate ---------- */

export type AgentActionKind = "walk" | "talk" | "trade" | "spend";
/** Only these run without the owner. Trades and spends always wait. */
export const AUTONOMOUS_ACTIONS: ReadonlySet<AgentActionKind> = new Set(["walk", "talk"]);
export const needsApproval = (kind: AgentActionKind) => !AUTONOMOUS_ACTIONS.has(kind);

export type Proposal = {
  id: string;
  citizenId: string;
  kind: "trade" | "spend";
  summary: string;
  /** where the owner completes it themselves, e.g. a BITMAP page */
  href: string;
  /** trade proposals from a real listing */
  offerId?: string;
  item?: string;
  priceSats?: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "stale";
  staleWhy?: string;
  createdAt: number;
};

/** Pure transition: only pending proposals change, only by an owner decision. */
export function decide(list: Proposal[], id: string, approve: boolean): Proposal[] {
  return list.map((p) => (p.id === id && p.status === "pending" ? { ...p, status: approve ? "approved" : "rejected" } : p));
}

const KEY = "bitmapwin:agent-proposals";
let proposals: Proposal[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: Proposal[] = [];
function load() {
  if (proposals) return proposals;
  try { proposals = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Proposal[]; } catch { proposals = []; }
  return proposals;
}
function save(next: Proposal[]) {
  proposals = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* session only */ }
  listeners.forEach((f) => f());
}

export const approvals = {
  get: () => (typeof window === "undefined" ? EMPTY : load()),
  /** Agents call this for any trade or spend; it is queued, never executed. */
  propose(p: Omit<Proposal, "id" | "status" | "createdAt">) {
    const next: Proposal = { ...p, id: `${p.citizenId}:${Date.now()}`, status: "pending", createdAt: Date.now() };
    save([next, ...load()].slice(0, 50));
  },
  /** Broker queues real listings once each; already-queued offers are skipped. */
  proposeTrades(picks: BrokerPick[]) {
    const have = new Set(load().map((p) => p.offerId).filter(Boolean));
    const fresh = picks.filter((p) => !have.has(p.offerId));
    const now = Date.now();
    const rows: Proposal[] = fresh.map((p, i) => ({
      id: `broker:${p.offerId}`, citizenId: "broker", kind: "trade", status: "pending", createdAt: now + i,
      summary: `Buy ${p.item} for ${p.priceSats.toLocaleString()} sats`, href: `/bitmap/${p.height}`,
      offerId: p.offerId, item: p.item, priceSats: p.priceSats, reason: p.reason,
    }));
    if (rows.length) save([...rows, ...load()].slice(0, 50));
    return rows.length;
  },
  markStale(id: string, why: string) {
    save(load().map((p) => (p.id === id && p.status === "pending" ? { ...p, status: "stale", staleWhy: why } : p)));
  },
  decide(id: string, approve: boolean) { save(decide(load(), id, approve)); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

export const useApprovals = () => useSyncExternalStore(approvals.subscribe, approvals.get, () => EMPTY);

/* ---------- broker: picks from real open listings ---------- */

export type ListingLite = { id: string; bitmapHeight: number | null; priceSats: number; status: string };
export type BrokerPick = { offerId: string; height: number; item: string; priceSats: number; reason: string };

/** Pure: cheapest open listings, each with a reason grounded in the listing data itself. */
export function brokerPicks(listings: ListingLite[], max = 3): BrokerPick[] {
  const open = listings.filter((l): l is ListingLite & { bitmapHeight: number } => l.status === "open" && l.priceSats > 0 && l.bitmapHeight != null);
  if (open.length === 0) return [];
  const sorted = [...open].sort((a, b) => a.priceSats - b.priceSats);
  const median = sorted[Math.floor(sorted.length / 2)]?.priceSats ?? 0;
  return sorted.slice(0, max).map((l, i) => {
    const pct = median > 0 ? Math.round((1 - l.priceSats / median) * 100) : 0;
    const why = [i === 0 ? "Lowest price among open listings" : `#${i + 1} cheapest open listing`];
    if (pct > 0) why.push(`${pct}% below the median ask of ${median.toLocaleString()} sats`);
    if (l.bitmapHeight < 100_000) why.push("early block (under 100,000)");
    return { offerId: l.id, height: l.bitmapHeight, item: `${l.bitmapHeight}.bitmap`, priceSats: l.priceSats, reason: why.join(" · ") };
  });
}

/** Pure: is a broker proposal still valid against the listing as it is right now? */
export function recheckListing(p: Pick<Proposal, "priceSats">, current: { status: string; priceSats: number } | null): string | null {
  if (!current) return "Listing no longer exists";
  if (current.status !== "open") return `Listing is ${current.status === "spent" ? "sold" : current.status}`;
  if (current.priceSats !== p.priceSats) return `Price changed to ${current.priceSats.toLocaleString()} sats`;
  return null;
}
