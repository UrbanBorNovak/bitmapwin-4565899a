/**
 * OASIS VISUAL MODS — device-local look for the world.
 * Stored only in this browser; never sent anywhere, never seen by other players.
 * Applied as CSS variables on the Oasis wrapper (canvas filter + overlay).
 */
import { useEffect, useState, type CSSProperties } from "react";
import { Palette, X, Copy, Download, Save, RotateCcw, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export type VisualMod = {
  brightness: number; contrast: number; saturate: number; sepia: number; hue: number;
  scanlines: number; vignette: number; grain: number; tint: string; tintAlpha: number;
};

export const VANILLA: VisualMod = { brightness: 1, contrast: 1, saturate: 1, sepia: 0, hue: 0, scanlines: 0, vignette: 0, grain: 0, tint: "#000000", tintAlpha: 0 };

const PRESETS: { id: string; label: string; mod: VisualMod }[] = [
  { id: "vanilla", label: "VANILLA", mod: VANILLA },
  { id: "crt", label: "CRT PHOSPHOR", mod: { ...VANILLA, contrast: 1.15, saturate: 0.7, sepia: 0.35, scanlines: 0.35, vignette: 0.6, grain: 0.15, tint: "#ffb000", tintAlpha: 0.12 } },
  { id: "matrix", label: "MATRIX HOLO", mod: { ...VANILLA, contrast: 1.2, saturate: 0.4, hue: 70, scanlines: 0.2, vignette: 0.5, tint: "#00ff66", tintAlpha: 0.18 } },
  { id: "synth", label: "SYNTHWAVE", mod: { ...VANILLA, contrast: 1.1, saturate: 1.5, hue: -25, vignette: 0.4, tint: "#ff2bd6", tintAlpha: 0.14 } },
  { id: "solar", label: "SOLAR GENESIS", mod: { ...VANILLA, brightness: 1.08, saturate: 1.2, sepia: 0.4, vignette: 0.3, tint: "#f7931a", tintAlpha: 0.12 } },
  { id: "noir", label: "NOIR WASTELAND", mod: { ...VANILLA, contrast: 1.35, saturate: 0, vignette: 0.7, grain: 0.3 } },
];

const KEY = "bitmapwin:oasis-visual-mods";

function load(): VisualMod {
  try { return { ...VANILLA, ...(JSON.parse(localStorage.getItem(KEY) ?? "null") ?? {}) }; } catch { return VANILLA; }
}

const SLOTS_KEY = "bitmapwin:oasis-visual-mod-slots";
type Slot = { name: string; mod: VisualMod };
function loadSlots(): Slot[] {
  try { const v = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "[]"); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; }
}

/** Device-local mod: loaded after hydration, saved on every change (never before load). */
export function useVisualMod() {
  const [mod, setMod] = useState<VisualMod>(VANILLA);
  const [ready, setReady] = useState(false);
  useEffect(() => { setMod(load()); setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(mod)); } catch { /* storage full/blocked */ } }, [mod, ready]);
  return [mod, setMod] as const;
}

/** Backslash toggles the panel without leaving flight. */
export function useModsHotkey(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "Backslash") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}

export function modStyle(m: VisualMod): CSSProperties {
  return {
    "--oasis-mod-filter": `brightness(${m.brightness}) contrast(${m.contrast}) saturate(${m.saturate}) sepia(${m.sepia}) hue-rotate(${m.hue}deg)`,
    "--oasis-mod-scan": String(m.scanlines),
    "--oasis-mod-vig": String(m.vignette),
    "--oasis-mod-grain": String(m.grain),
    "--oasis-mod-tint": m.tint,
    "--oasis-mod-tint-a": String(m.tintAlpha),
  } as CSSProperties;
}

const SLIDERS: { k: keyof VisualMod; label: string; min: number; max: number; step: number }[] = [
  { k: "brightness", label: "BRIGHTNESS", min: 0.5, max: 1.6, step: 0.01 },
  { k: "contrast", label: "CONTRAST", min: 0.5, max: 1.8, step: 0.01 },
  { k: "saturate", label: "SATURATION", min: 0, max: 2, step: 0.01 },
  { k: "sepia", label: "SEPIA", min: 0, max: 1, step: 0.01 },
  { k: "hue", label: "HUE SHIFT", min: -180, max: 180, step: 1 },
  { k: "scanlines", label: "SCANLINES", min: 0, max: 1, step: 0.01 },
  { k: "vignette", label: "VIGNETTE", min: 0, max: 1, step: 0.01 },
  { k: "grain", label: "FILM GRAIN", min: 0, max: 1, step: 0.01 },
  { k: "tintAlpha", label: "TINT STRENGTH", min: 0, max: 0.5, step: 0.01 },
];

export function OasisVisualModsPanel({ mod, setMod, onClose }: { mod: VisualMod; setMod: (m: VisualMod) => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [peek, setPeek] = useState(false);
  useEffect(() => setSlots(loadSlots()), []);
  const saveSlots = (next: Slot[]) => { setSlots(next); try { localStorage.setItem(SLOTS_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  // Keep slider keys/clicks inside the panel so flight controls and pointer-lock don't react.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); e.stopPropagation(); }}
      onKeyUp={stop}
      onPointerDown={stop}
      onWheel={stop}
      className={`hud-panel absolute right-3 top-16 z-[90] max-h-[calc(100%-8rem)] w-[min(300px,calc(100%-1.5rem))] overflow-y-auto p-3 font-mono text-[10px] transition-opacity ${peek ? "opacity-15" : "opacity-100"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="hud-telemetry-title flex items-center gap-1"><Palette className="size-3" /> VISUAL MODS · ONLY YOU</span>
        <span className="flex items-center gap-2">
          <button type="button" aria-label="Hold to peek at the world" title="Hold to peek" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} className="text-muted-foreground hover:text-signal"><Eye className="size-4" /></button>
          <button type="button" aria-label="Reset to vanilla" title="Reset" onClick={() => setMod(VANILLA)} className="text-muted-foreground hover:text-bitcoin"><RotateCcw className="size-4" /></button>
          <button type="button" aria-label="Close visual mods" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </span>
      </div>
      <p className="mb-2 text-muted-foreground">SAVED ON THIS DEVICE · PRESS \\ TO SHOW/HIDE WHILE FLYING</p>
      <div className="mb-3 grid grid-cols-2 gap-1">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => setMod(p.mod)} className="border border-border px-1.5 py-1 text-left hover:border-bitcoin hover:text-bitcoin">{p.label}</button>
        ))}
      </div>
      <div className="space-y-1.5">
        {SLIDERS.map((s) => (
          <label key={s.k} className="block">
            <span className="flex justify-between text-muted-foreground"><span>{s.label}</span><span className="tabular-nums text-signal">{Number(mod[s.k]).toFixed(2)}</span></span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={Number(mod[s.k])} onChange={(e) => setMod({ ...mod, [s.k]: Number(e.target.value) })} className="w-full accent-[var(--bitcoin)]" />
          </label>
        ))}
        <label className="flex items-center justify-between text-muted-foreground">TINT COLOUR
          <input type="color" value={mod.tint} onChange={(e) => setMod({ ...mod, tint: e.target.value })} className="h-6 w-10 border border-border bg-transparent" />
        </label>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-muted-foreground"><span>MY LOOKS ({slots.length}/8)</span>
          <button type="button" disabled={slots.length >= 8} onClick={() => saveSlots([...slots, { name: `LOOK ${slots.length + 1}`, mod }])} className="flex items-center gap-1 text-signal hover:text-bitcoin disabled:opacity-40"><Save className="size-3" /> SAVE CURRENT</button>
        </div>
        {slots.map((sl, i) => (
          <div key={i} className="mb-1 flex items-center gap-1">
            <button type="button" onClick={() => setMod({ ...VANILLA, ...sl.mod })} className="flex-1 border border-border px-1.5 py-1 text-left hover:border-bitcoin hover:text-bitcoin">{sl.name}</button>
            <button type="button" aria-label={`Delete ${sl.name}`} onClick={() => saveSlots(slots.filter((_, j) => j !== i))} className="px-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-1">
        <button type="button" className="flex flex-1 items-center justify-center gap-1 border border-border py-1 hover:border-signal hover:text-signal" onClick={() => { void navigator.clipboard.writeText(btoa(JSON.stringify(mod))); toast.success("Mod code copied"); }}><Copy className="size-3" /> SHARE</button>
        <button type="button" className="flex flex-1 items-center justify-center gap-1 border border-border py-1 hover:border-signal hover:text-signal" onClick={() => {
          try { setMod({ ...VANILLA, ...JSON.parse(atob(code.trim())) }); toast.success("Mod loaded"); } catch { toast.error("Invalid mod code"); }
        }}><Download className="size-3" /> LOAD</button>
      </div>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PASTE MOD CODE" className="mt-1 h-7 w-full border border-border bg-background/80 px-2 outline-none focus:border-bitcoin" />
    </div>
  );
}
