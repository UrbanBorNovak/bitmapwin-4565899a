import { useEffect, useSyncExternalStore } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { applyWorldEvent, type WorldEvent } from "./events";
import { localPlayPersistence, newProfile, type PlayPersistence } from "./persistence";
import { fetchBuildCounts } from "./worldAdapter";
import { createCardFromBitmap, emptyFacts } from "./cardFactory";
import { allPfpExtenders, normalizeVisualSettings } from "./pfpExtenders";
import type { CardChange, CardVisualExtender, PlayProfile, PlayVisualSettings } from "./types";

let persistence: PlayPersistence = localPlayPersistence;
let current: PlayProfile | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setPlayPersistence(p: PlayPersistence) {
  persistence = p;
}

export function ownerKey(address: string | null | undefined) {
  return address ? address.toLowerCase() : "guest";
}

export function loadOwner(owner: string) {
  if (current?.owner === owner) return;
  current = persistence.load(owner) ?? newProfile(owner);
  persistence.save(current);
  emit();
}

function commit(next: PlayProfile) {
  current = next;
  persistence.save(next);
  emit();
}

export function dispatchWorldEvent(event: WorldEvent): CardChange[] {
  if (!current) return [];
  const { profile, changes } = applyWorldEvent(current, event);
  commit(profile);
  return changes;
}

export function selectBitmap(height: number | null) {
  if (!current) return;
  const next = { ...current, selectedBitmap: height, cards: { ...current.cards }, order: [...current.order] };
  if (height !== null && !next.cards[`bitmap-${height}`]) {
    const card = createCardFromBitmap({ ...emptyFacts(height), ownedByPlayer: true }, Date.now());
    card.origin = { kind: "territory", label: `YOUR TERRITORY · ${height}.BITMAP` };
    next.cards[card.id] = card;
    next.order.unshift(card.id);
  }
  commit(next);
}


export function updatePlayVisuals(patch: Partial<PlayVisualSettings>) {
  if (!current) return;
  const visuals = normalizeVisualSettings({ ...current.visuals, ...patch });
  commit({ ...current, visuals });
}

export function addCustomPfpExtender(extender: CardVisualExtender) {
  if (!current) return;
  const existing = current.visuals.customPfpExtenders.filter((item) => item.id !== extender.id);
  const visuals = normalizeVisualSettings({
    ...current.visuals,
    pfpExtendersEnabled: true,
    selectedPfpExtenderId: extender.id,
    customPfpExtenders: [extender, ...existing].slice(0, 12),
  });
  commit({ ...current, visuals });
}

export function setPfpExtenderEnabled(id: string, enabled: boolean) {
  if (!current) return;
  const customPfpExtenders = current.visuals.customPfpExtenders.map((item) =>
    item.id === id ? { ...item, enabled } : item,
  );
  let selectedPfpExtenderId = current.visuals.selectedPfpExtenderId;
  if (enabled) selectedPfpExtenderId = id;
  else if (selectedPfpExtenderId === id) {
    selectedPfpExtenderId = allPfpExtenders({ ...current.visuals, customPfpExtenders }).find((item) => item.id !== id && item.enabled !== false)?.id ?? null;
  }
  const visuals = normalizeVisualSettings({ ...current.visuals, customPfpExtenders, selectedPfpExtenderId });
  commit({ ...current, visuals });
}

/** Ensure a card exists for a territory (e.g. opened from the Oasis). */
export function ensureCard(height: number) {
  if (!current || current.cards[`bitmap-${height}`]) return;
  dispatchWorldEvent({ kind: "CARD_DISCOVERED", facts: emptyFacts(height), actor: "The Oasis" });
}

/** World → card: pull real Oasis build counts and turn differences into NEW_BUILD events. */
let syncing = false;
export async function syncWorld(): Promise<"ok" | "unavailable"> {
  if (!current || syncing) return "ok";
  syncing = true;
  try {
    const cards = Object.values(current.cards);
    const counts = await fetchBuildCounts(cards.map((c) => c.bitmap));
    if (!counts) return "unavailable";
    for (const card of cards) {
      const n = counts.get(card.bitmap);
      if (n === undefined) continue;
      const known = current.cards[card.id]?.facts.buildCount ?? null;
      if (n > (known ?? 0)) dispatchWorldEvent({ kind: "NEW_BUILD", height: card.bitmap, buildCount: n });
      else if (known === null && current.cards[card.id]) {
        const c = current.cards[card.id]!;
        current.cards[card.id] = { ...c, facts: { ...c.facts, buildCount: n, source: "bitmapwin-world", checkedAt: Date.now() } };
      }
    }
    commit({ ...current });
    return "ok";
  } finally {
    syncing = false;
  }
}

/** Client-only hook. Returns null during SSR / first paint. */
export function usePlayProfile(): PlayProfile | null {
  const wallet = useWalletSession();
  const owner = ownerKey(wallet?.ordinalsAddress);
  useEffect(() => loadOwner(owner), [owner]);
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
  return snap && snap.owner === owner ? snap : null;
}

export function readProfileFor(address: string): PlayProfile | null {
  if (typeof window === "undefined") return null;
  return persistence.load(ownerKey(address));
}
