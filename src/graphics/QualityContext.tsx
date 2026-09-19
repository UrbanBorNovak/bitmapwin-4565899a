import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectAutoQuality, loadQuality, qualitySettings, saveQuality, type QualityMode, type QualityOverrides, type QualitySettings, type StoredQuality } from "./quality";

type QualityContextValue = {
  quality: QualitySettings;
  stored: StoredQuality;
  setMode: (mode: QualityMode) => void;
  setOverride: <K extends keyof QualityOverrides>(key: K, value: QualityOverrides[K]) => void;
  setAdaptiveScale: (value: number) => void;
};

const QualityContext = createContext<QualityContextValue | null>(null);

export function QualityProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredQuality>({ mode: "auto", overrides: {} });
  const [autoResolved, setAutoResolved] = useState<"low" | "medium" | "high">("medium");
  const [adaptiveScale, setAdaptiveScaleState] = useState<number | undefined>();

  useEffect(() => {
    setStored(loadQuality());
    setAutoResolved(detectAutoQuality());
  }, []);

  useEffect(() => saveQuality(stored), [stored]);

  const setMode = useCallback((mode: QualityMode) => {
    setAdaptiveScaleState(undefined);
    setStored((current) => ({ ...current, mode }));
  }, []);
  const setOverride = useCallback(<K extends keyof QualityOverrides>(key: K, value: QualityOverrides[K]) => {
    setAdaptiveScaleState(undefined);
    setStored((current) => ({ ...current, overrides: { ...current.overrides, [key]: value } }));
  }, []);
  const quality = useMemo(() => qualitySettings(stored, autoResolved, adaptiveScale), [adaptiveScale, autoResolved, stored]);
  const setAdaptiveScale = useCallback((value: number) => setAdaptiveScaleState(value), []);
  const value = useMemo(() => ({ quality, stored, setMode, setOverride, setAdaptiveScale }), [quality, setAdaptiveScale, setMode, setOverride, stored]);
  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>;
}

export function useQuality() {
  const value = useContext(QualityContext);
  if (!value) throw new Error("useQuality must be used inside QualityProvider");
  return value;
}