/**
 * SEALED RELICS — sealed vault notes that mean something in Biternam and the Oasis.
 *
 * A sealed note's `kind` names what it is:
 *   relic:<questItemId>   a keepsake of a Biternam item you have earned
 *   keycard:<gateSlug>    a transferable key for one Shadow Gate archway
 * Ownership is the sealed note itself; only notes the live Bitcoin check reports
 * SEALED (6 confirmations) unlock anything. Relics never advance quests — quest
 * progress and BIT stay with questStore and the server.
 */
import { useSyncExternalStore } from "react";
import { FINAL_CONFIRMATIONS, mempoolChain, verifySealed, type SealState } from "./shadow-seal";
import { loadHeld, type HeldSealed } from "./shadow-seal-wallet";
import { heldItems, itemById, type QuestItem, type QuestProgress } from "./biternam-quests";

export type RelicKind = { type: "relic"; itemId: string } | { type: "keycard"; slug: string };

const SLUG = /^[a-z0-9-]{1,64}$/;

export const relicKind = (itemId: string) => `relic:${itemId}`;
export const keycardKind = (slug: string) => `keycard:${slug}`;

export function parseRelicKind(kind: string): RelicKind | null {
  const m = /^(relic|keycard):(.+)$/.exec(kind);
  if (!m) return null;
  if (m[1] === "relic") return itemById(m[2]!) ? { type: "relic", itemId: m[2]! } : null;
  return SLUG.test(m[2]!) ? { type: "keycard", slug: m[2]! } : null;
}

/** Items you may seal as relics: only ones on your wrist right now. */
export const sealableItems = (p: QuestProgress): QuestItem[] => heldItems(p);

export type HeldRelic = { key: string; label: string; kind: RelicKind; item: QuestItem | null; state: SealState | null };

/** Only a fully confirmed seal unlocks. Pending, conflicting, lost or unchecked never do. */
export const unlocks = (s: SealState | null | undefined) => s?.state === "SEALED";

export function keycardOpens(relics: HeldRelic[], slug: string): boolean {
  return relics.some((r) => r.kind.type === "keycard" && r.kind.slug === slug && unlocks(r.state));
}

export function relicsFrom(held: HeldSealed[], states: Record<string, SealState>): HeldRelic[] {
  const out: HeldRelic[] = [];
  for (const h of held) {
    const kind = parseRelicKind(h.c.note.kind);
    if (!kind) continue;
    const key = h.c.note.genesis;
    out.push({ key, label: h.c.note.label, kind, item: kind.type === "relic" ? itemById(kind.itemId) : null, state: states[key] ?? null });
  }
  return out;
}

/* ── shared store: held notes from the vault + their last live Bitcoin check ── */
let states: Record<string, SealState> = {};
let snapshot: HeldRelic[] = [];
let lastCheck = 0;
let built = false;
const listeners = new Set<() => void>();
const EMPTY: HeldRelic[] = [];

function readHeld(): HeldSealed[] {
  try { return loadHeld(); } catch { return []; } // a damaged vault unlocks nothing
}
function rebuild() { snapshot = relicsFrom(readHeld(), states); listeners.forEach((f) => f()); }

export const relicStore = {
  get: () => { if (!built && typeof window !== "undefined") { built = true; snapshot = relicsFrom(readHeld(), states); void relicStore.refresh(); } return snapshot; },
  subscribe(fn: () => void) {
    listeners.add(fn);
    if (listeners.size === 1) { rebuild(); void relicStore.refresh(); }
    return () => { listeners.delete(fn); };
  },
  /** Re-check every relic on Bitcoin. Throttled to once a minute unless forced. */
  async refresh(force = false) {
    if (typeof window === "undefined") return;
    if (!force && Date.now() - lastCheck < 60_000) { rebuild(); return; }
    lastCheck = Date.now();
    const held = readHeld().filter((h) => parseRelicKind(h.c.note.kind));
    const chain = mempoolChain();
    const next: Record<string, SealState> = {};
    await Promise.all(held.map(async (h) => {
      try { next[h.c.note.genesis] = await verifySealed(h.c, chain, h.mine); }
      catch (e) { next[h.c.note.genesis] = { state: "UNAVAILABLE", reason: (e as Error).message }; }
    }));
    states = next;
    rebuild();
  },
};

export function useSealedRelics(): HeldRelic[] {
  return useSyncExternalStore(relicStore.subscribe, relicStore.get, () => EMPTY);
}

export function relicStateLabel(s: SealState | null): string {
  if (!s) return "CHECKING BITCOIN…";
  if (s.state === "SEALED") return `SEALED · ${FINAL_CONFIRMATIONS}+ CONF`;
  if (s.state === "PENDING") return `PENDING · ${s.confirmations}/${FINAL_CONFIRMATIONS}`;
  return s.state.replace("_", " ");
}
