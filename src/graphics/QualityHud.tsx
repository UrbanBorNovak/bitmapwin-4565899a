import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Gauge, SignalHigh, SignalLow, SignalMedium, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuality } from "./QualityContext";
import { UI_SCALES, loadUiScale, saveUiScale } from "./ui-scale";
import {
  QUALITY_PROMPT_KEY,
  isLimitedHardware,
  type QualityMode,
  type ViewDistance,
} from "./quality";

const MODES: Array<{ value: QualityMode; label: string; icon: ReactNode }> = [
  { value: "auto", label: "AUTO", icon: <Wand2 /> },
  { value: "low", label: "LOW", icon: <SignalLow /> },
  { value: "medium", label: "MEDIUM", icon: <SignalMedium /> },
  { value: "high", label: "HIGH", icon: <SignalHigh /> },
];

export function QualityHud({ touch = false }: { touch?: boolean }) {
  const { quality, stored, setMode, setOverride } = useQuality();
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [suggestLow, setSuggestLow] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  useEffect(() => setUiScale(loadUiScale()), []);
  useEffect(() => {
    if (!localStorage.getItem(QUALITY_PROMPT_KEY) && stored.mode === "auto" && isLimitedHardware())
      setSuggestLow(true);
  }, [stored.mode]);
  const dismissSuggestion = (low: boolean) => {
    localStorage.setItem(QUALITY_PROMPT_KEY, "1");
    if (low) setMode("low");
    setSuggestLow(false);
  };
  return (
    <>
      <div className="relative pointer-events-auto" data-no-translate>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Graphics quality"
          title="Graphics quality"
          onClick={() => setOpen((value) => !value)}
          className={`grid place-items-center border border-border bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors hover:border-bitcoin hover:text-bitcoin [&_svg]:size-[1.15rem] ${touch ? "size-11" : "size-11"}`}
        >
          <Gauge />
        </button>
        {open ? (
          <section
            className="hud-panel absolute bottom-full right-0 mb-2 max-h-[55dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto p-2 font-mono text-[10px] shadow-lg"
            aria-label="Graphics quality"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="hud-telemetry-title">
                GRAPHICS · {quality.resolved.toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setOpen(false)}
                aria-label="Close graphics quality"
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-label={mode.label}
                  title={mode.label}
                  onClick={() => setMode(mode.value)}
                  className={`grid ${touch ? "min-h-11" : "h-9"} place-items-center border transition-colors [&_svg]:size-[1.15rem] ${stored.mode === mode.value ? "border-bitcoin bg-bitcoin text-bitcoin-foreground" : "border-border text-muted-foreground hover:border-bitcoin hover:text-bitcoin"}`}
                >
                  {mode.icon}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-1 text-[12px]">
              <span className="pr-1 text-muted-foreground">TEXT SIZE</span>
              {UI_SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { saveUiScale(s); setUiScale(s); }}
                  className={`${touch ? "min-h-11" : "h-8"} border transition-colors ${uiScale === s ? "border-bitcoin bg-bitcoin text-bitcoin-foreground" : "border-border text-muted-foreground hover:border-bitcoin hover:text-bitcoin"}`}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-2 h-8 w-full justify-between rounded-sm border border-border px-2 text-[10px]"
              onClick={() => setAdvanced((value) => !value)}
            >
              ADVANCED{" "}
              <ChevronDown
                className={`size-3 transition-transform ${advanced ? "rotate-180" : ""}`}
              />
            </Button>
            {advanced ? (
              <div className="mt-2 grid gap-2 border-t border-border pt-2">
                <label className="grid grid-cols-[1fr_auto] items-center gap-2">
                  RENDER SCALE <span>{Math.round(quality.renderScale * 100)}%</span>
                  <input
                    className="col-span-2 accent-[var(--bitcoin)]"
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={Math.round(quality.renderScale * 100)}
                    onChange={(event) =>
                      setOverride("renderScale", Number(event.target.value) / 100)
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  VIEW DISTANCE{" "}
                  <select
                    className="border border-border bg-background px-2 py-1"
                    value={quality.viewDistance}
                    onChange={(event) =>
                      setOverride("viewDistance", event.target.value as ViewDistance)
                    }
                  >
                    <option value="short">SHORT</option>
                    <option value="medium">MEDIUM</option>
                    <option value="far">FAR</option>
                  </select>
                </label>
                <Toggle
                  label="SHADOWS"
                  value={quality.shadows}
                  onChange={(value) => setOverride("shadows", value)}
                />
                <Toggle
                  label="PLOT GLOW"
                  value={quality.plotGlow}
                  onChange={(value) => setOverride("plotGlow", value)}
                />
                <label className="flex items-center justify-between gap-2">
                  FPS CAP{" "}
                  <select
                    className="border border-border bg-background px-2 py-1"
                    value={quality.fpsCap}
                    onChange={(event) =>
                      setOverride("fpsCap", Number(event.target.value) as 30 | 45 | 60)
                    }
                  >
                    <option value="30">30</option>
                    <option value="45">45</option>
                    <option value="60">60</option>
                  </select>
                </label>
                <Toggle
                  label="ADAPTIVE QUALITY"
                  value={quality.adaptive}
                  onChange={(value) => setOverride("adaptive", value)}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {suggestLow ? createPortal(
        <div className="pointer-events-auto fixed inset-0 z-[100] grid place-items-end overflow-y-auto bg-background/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:place-items-center">
          <section
            className="hud-panel pointer-events-auto w-full max-w-md p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Graphics recommendation"
          >
            <div className="hud-telemetry-title">DEVICE CHECK</div>
            <p className="my-4 text-sm text-foreground">
              This device looks limited — start on Low?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="btn-term min-h-11" onClick={() => dismissSuggestion(true)}>
                LOW
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 border border-border"
                onClick={() => dismissSuggestion(false)}
              >
                KEEP AUTO
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-8 items-center justify-between gap-2">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--bitcoin)]"
      />
    </label>
  );
}
