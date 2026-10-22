export type QualityMode = "auto" | "low" | "medium" | "high";
export type ViewDistance = "short" | "medium" | "far";

export type QualityOverrides = Partial<{
  renderScale: number;
  viewDistance: ViewDistance;
  shadows: boolean;
  plotGlow: boolean;
  fpsCap: 30 | 45 | 60;
  adaptive: boolean;
}>;

export type StoredQuality = {
  mode: QualityMode;
  overrides: QualityOverrides;
};

export type QualitySettings = {
  mode: QualityMode;
  resolved: Exclude<QualityMode, "auto">;
  pixelRatio: number;
  renderScale: number;
  maxRenderScale: number;
  viewDistance: ViewDistance;
  chunkRadius: 0 | 1 | 2;
  shadows: boolean;
  shadowMapSize: 0 | 512 | 1024;
  plotGlow: boolean;
  effects: "off" | "half" | "full";
  propDetail: "cheap" | "mid" | "full";
  npcLimit: number;
  animationStride: 1 | 2 | 3;
  fpsCap: 30 | 45 | 60;
  adaptive: boolean;
  antialias: boolean;
};

export const QUALITY_STORAGE_KEY = "bitmapwin.quality";
export const QUALITY_PROMPT_KEY = "bitmapwin.quality.prompted";

const clampScale = (value: number) => Math.max(0.5, Math.min(1, value));

export function isTouchHardware() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function isLimitedHardware() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  let webgl2 = false;
  try {
    webgl2 = Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    webgl2 = false;
  }
  return isTouchHardware() || (nav.deviceMemory ?? 8) <= 4 || navigator.hardwareConcurrency <= 4 || !webgl2;
}

export function detectAutoQuality(): Exclude<QualityMode, "auto"> {
  if (typeof window === "undefined") return "medium";
  if (isLimitedHardware()) return "low";
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.deviceMemory ?? 8) >= 8 && navigator.hardwareConcurrency >= 8 ? "high" : "medium";
}

export function loadQuality(): StoredQuality {
  if (typeof window === "undefined") return { mode: "auto", overrides: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(QUALITY_STORAGE_KEY) ?? "null") as StoredQuality | null;
    if (parsed && ["auto", "low", "medium", "high"].includes(parsed.mode)) {
      return { mode: parsed.mode, overrides: parsed.overrides ?? {} };
    }
  } catch {
    // Invalid old settings fall back to Auto.
  }
  return { mode: "auto", overrides: {} };
}

export function saveQuality(value: StoredQuality) {
  if (typeof window !== "undefined") localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify(value));
}

export function qualitySettings(
  stored: StoredQuality,
  autoResolved: Exclude<QualityMode, "auto">,
  adaptiveScale?: number,
): QualitySettings {
  const resolved = stored.mode === "auto" ? autoResolved : stored.mode;
  const touch = isTouchHardware();
  // 90s-retro target: every tier aims for 60 fps; chunky pixels, no shadows,
  // no MSAA. Higher tiers only widen view distance and detail.
  void touch;
  const defaults = resolved === "low"
    ? { pixelRatio: 1, renderScale: 0.6, viewDistance: "short" as const, shadows: false, plotGlow: false, fpsCap: 60 as const, adaptive: true }
    : resolved === "medium"
      ? { pixelRatio: 1, renderScale: 0.75, viewDistance: "short" as const, shadows: false, plotGlow: false, fpsCap: 60 as const, adaptive: true }
      : { pixelRatio: 1, renderScale: 0.9, viewDistance: "medium" as const, shadows: false, plotGlow: false, fpsCap: 60 as const, adaptive: true };
  const viewDistance = stored.overrides.viewDistance ?? defaults.viewDistance;
  const renderScale = clampScale(adaptiveScale ?? stored.overrides.renderScale ?? defaults.renderScale);
  const shadows = stored.overrides.shadows ?? defaults.shadows;
  return {
    mode: stored.mode,
    resolved,
    pixelRatio: defaults.pixelRatio,
    renderScale,
    maxRenderScale: stored.overrides.renderScale ?? defaults.renderScale,
    viewDistance,
    chunkRadius: viewDistance === "short" ? 0 : viewDistance === "medium" ? 1 : 2,
    shadows,
    shadowMapSize: shadows ? (resolved === "high" ? 1024 : 512) : 0,
    plotGlow: stored.overrides.plotGlow ?? defaults.plotGlow,
    effects: resolved === "high" ? "half" : "off",
    propDetail: resolved === "low" ? "cheap" : resolved === "medium" ? "mid" : "full",
    npcLimit: resolved === "low" ? 8 : resolved === "medium" ? 16 : 64,
    animationStride: resolved === "low" ? 3 : resolved === "medium" ? 2 : 1,
    fpsCap: 60,
    adaptive: stored.overrides.adaptive ?? defaults.adaptive,
    antialias: false,
  };
}