import type { CardVisualExtender, LivingCard, PlayVisualSettings } from "./types";
import { hash } from "./cardFactory";

export const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

const WEIRDOS_HTML_ID = "f605a9be62272ad8429081e05ac8984ff0387864ec05a1682457847a684fcbd7i0";

export const BUILT_IN_PFP_EXTENDERS: CardVisualExtender[] = [
  {
    id: `ord-html-${WEIRDOS_HTML_ID}`,
    name: "WEIRDOS HTML SAMPLE",
    collection: "POPULAR ORDINALS PFP",
    source: "ordinals-html",
    inscriptionId: WEIRDOS_HTML_ID,
    enabled: true,
    builtIn: true,
    addedAt: 0,
  },
];

export const DEFAULT_PLAY_VISUALS: PlayVisualSettings = {
  pfpExtendersEnabled: false,
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
  const extenders = allPfpExtenders(settings).filter((extender) => extender.enabled !== false);
  if (!extenders.length) return null;
  const selected = settings.selectedPfpExtenderId ? extenders.find((extender) => extender.id === settings.selectedPfpExtenderId) : null;
  if (selected) return selected;
  return extenders[hash(card.bitmap) % extenders.length] ?? null;
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
        return [
          {
            id: `custom-${inscriptionId}`,
            name: safeName.toUpperCase(),
            collection: safeCollection.toUpperCase(),
            source: "ordinals-html" as const,
            inscriptionId,
            enabled: candidate.enabled !== false,
            builtIn: false,
            addedAt: typeof candidate.addedAt === "number" ? candidate.addedAt : Date.now(),
          },
        ];
      })
    : [];
  const available = allPfpExtenders({ ...DEFAULT_PLAY_VISUALS, customPfpExtenders: custom });
  const selected = typeof raw.selectedPfpExtenderId === "string" && available.some((x) => x.id === raw.selectedPfpExtenderId) ? raw.selectedPfpExtenderId : DEFAULT_PLAY_VISUALS.selectedPfpExtenderId;
  return {
    pfpExtendersEnabled: raw.pfpExtendersEnabled === true,
    selectedPfpExtenderId: selected,
    customPfpExtenders: custom,
  };
}
