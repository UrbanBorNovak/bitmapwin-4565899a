import type { CardVisualExtender, LivingCard, PlayVisualSettings } from "./types";
import { hash } from "./cardFactory";

export const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

export const BUILT_IN_PFP_EXTENDERS: CardVisualExtender[] = [
  {
    id: "builtin-89d8bfdc528550b34b22741d579645ba7c0899f534c617ed6f18609b280c1bc2i0",
    name: "BITCOIN HOOD #1",
    collection: "BITCOIN HOODS",
    source: "ordinals-image",
    inscriptionId: "89d8bfdc528550b34b22741d579645ba7c0899f534c617ed6f18609b280c1bc2i0",
    enabled: true,
    builtIn: true,
    addedAt: 0,
  },
  {
    id: "builtin-ee5022303dbdb2e30c3da28392f40893c318d35c0f05dba4ed62743ec26123b6i0",
    name: "BITCOIN HOOD #2",
    collection: "BITCOIN HOODS",
    source: "ordinals-image",
    inscriptionId: "ee5022303dbdb2e30c3da28392f40893c318d35c0f05dba4ed62743ec26123b6i0",
    enabled: true,
    builtIn: true,
    addedAt: 0,
    parentInscriptionId: "89d8bfdc528550b34b22741d579645ba7c0899f534c617ed6f18609b280c1bc2i0",
  },
];

export const DEFAULT_PLAY_VISUALS: PlayVisualSettings = {
  pfpExtendersEnabled: false,
  selectedPfpCollection: BUILT_IN_PFP_EXTENDERS[0]?.collection ?? null,
  selectedPfpExtenderId: BUILT_IN_PFP_EXTENDERS[0]?.id ?? null,
  customPfpExtenders: [],
};

export function normalizeInscriptionInput(value: string): string | null {
  const raw = value.trim();
  if (INSCRIPTION_ID_RE.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts.at(-1) ?? "";
    return INSCRIPTION_ID_RE.test(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function ordinalsPreviewUrl(inscriptionId: string): string {
  return `https://ordinals.com/preview/${inscriptionId}`;
}

export function inscriptionContentUrl(inscriptionId: string): string {
  return `/api/public/inscription/${inscriptionId}`;
}

export function allPfpExtenders(settings: PlayVisualSettings | null | undefined): CardVisualExtender[] {
  const seen = new Set<string>();
  const combined = [...BUILT_IN_PFP_EXTENDERS, ...(settings?.customPfpExtenders ?? [])];
  return combined.filter((extender) => {
    if (!INSCRIPTION_ID_RE.test(extender.inscriptionId) || seen.has(extender.id)) return false;
    seen.add(extender.id);
    return true;
  });
}

export function activePfpExtenderForCard(card: LivingCard, settings: PlayVisualSettings | null | undefined): CardVisualExtender | null {
  if (!settings?.pfpExtendersEnabled) return null;
  const extenders = allPfpExtenders(settings).filter((extender) => extender.enabled !== false && (extender.bitmap === undefined || extender.bitmap === null || extender.bitmap === card.bitmap));
  if (!extenders.length) return null;
  const bitmapScoped = extenders.filter((extender) => extender.bitmap === card.bitmap);
  const pool = bitmapScoped.length > 0 ? bitmapScoped : extenders;
  const legacySelected = settings.selectedPfpExtenderId
    ? allPfpExtenders(settings).find((extender) => extender.id === settings.selectedPfpExtenderId)
    : null;
  const selectedCollection = settings.selectedPfpCollection ?? legacySelected?.collection ?? null;
  const selectedPool = selectedCollection ? pool.filter((extender) => extender.collection === selectedCollection) : pool;
  const finalPool = selectedPool.length > 0 ? selectedPool : pool;
  return finalPool[hash(card.bitmap) % finalPool.length] ?? null;
}

export function normalizeVisualSettings(value: unknown): PlayVisualSettings {
  const raw = typeof value === "object" && value !== null ? (value as Partial<PlayVisualSettings>) : {};
  const custom = Array.isArray(raw.customPfpExtenders)
    ? raw.customPfpExtenders.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const candidate = item as Partial<CardVisualExtender>;
        const inscriptionId = normalizeInscriptionInput(String(candidate.inscriptionId ?? ""));
        if (!inscriptionId) return [];
        const safeName = String(candidate.name ?? "CUSTOM HTML PFP").trim().slice(0, 42) || "CUSTOM HTML PFP";
        const safeCollection = String(candidate.collection ?? "CUSTOM ORDINALS PFP").trim().slice(0, 42) || "CUSTOM ORDINALS PFP";
        if (safeCollection.toUpperCase() === "BITCOIN WEIRDOS") return [];
        const source: CardVisualExtender["source"] = candidate.source === "ordinals-image" ? "ordinals-image" : "ordinals-html";
        const bitmap = typeof candidate.bitmap === "number" && Number.isInteger(candidate.bitmap) && candidate.bitmap >= 0 && candidate.bitmap <= 999_999 ? candidate.bitmap : null;
        const parentInscriptionId = normalizeInscriptionInput(String(candidate.parentInscriptionId ?? ""));
        const contentType = typeof candidate.contentType === "string" ? candidate.contentType.slice(0, 80) : null;
        const childIndex = typeof candidate.childIndex === "number" && Number.isInteger(candidate.childIndex) ? candidate.childIndex : null;
        const childCount = typeof candidate.childCount === "number" && Number.isInteger(candidate.childCount) ? candidate.childCount : null;
        return [
          {
            id: bitmap !== null && parentInscriptionId ? `parent-${bitmap}-${parentInscriptionId}-${inscriptionId}` : `custom-${inscriptionId}`,
            name: safeName.toUpperCase(),
            collection: safeCollection.toUpperCase(),
            source,
            inscriptionId,
            enabled: candidate.enabled !== false,
            builtIn: false,
            addedAt: typeof candidate.addedAt === "number" ? candidate.addedAt : Date.now(),
            bitmap,
            parentInscriptionId,
            contentType,
            childIndex,
            childCount,
          },
        ];
      })
    : [];
  const available = allPfpExtenders({ ...DEFAULT_PLAY_VISUALS, customPfpExtenders: custom });
  const selected = typeof raw.selectedPfpExtenderId === "string" && available.some((x) => x.id === raw.selectedPfpExtenderId) ? raw.selectedPfpExtenderId : DEFAULT_PLAY_VISUALS.selectedPfpExtenderId;
  const selectedExtender = selected ? available.find((extender) => extender.id === selected) : null;
  const rawCollection = typeof raw.selectedPfpCollection === "string" ? raw.selectedPfpCollection.trim().slice(0, 80) : "";
  const selectedPfpCollection = rawCollection && rawCollection.toUpperCase() !== "BITCOIN WEIRDOS"
    ? rawCollection
    : selectedExtender?.collection ?? DEFAULT_PLAY_VISUALS.selectedPfpCollection;
  return {
    pfpExtendersEnabled: raw.pfpExtendersEnabled === true,
    selectedPfpCollection,
    selectedPfpExtenderId: selected,
    customPfpExtenders: custom,
  };
}
