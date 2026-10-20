/**
 * WORLD VISUAL MODS — screen-space looks laid over the Oasis canvas.
 * A mod can be locked on, or "anomaly surges" swap in a random look for a
 * few seconds at random intervals. Pure overlay: never touches world state.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { tracyCue } from "@/lib/tracy-com";
import { VISUAL_MODS, pickSurge, type VisualModId } from "@/lib/visual-mods";

type State = { locked: VisualModId | null; surges: boolean; surge: VisualModId | null };
let state: State = { locked: null, surges: false, surge: null };
const listeners = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useMods = () => useSyncExternalStore(subscribe, () => state, () => state);

let surgeTimer: ReturnType<typeof setTimeout> | null = null;
function triggerSurge() {
  const id = pickSurge(state.surge, Math.random());
  set({ surge: id });
  tracyCue({ kind: "anomaly", label: VISUAL_MODS[id].label });
  if (surgeTimer) clearTimeout(surgeTimer);
  surgeTimer = setTimeout(() => set({ surge: null }), 6000);
}

export function WorldVisualMod() {
  const { locked, surges, surge } = useMods();
  useEffect(() => {
    if (!surges) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        triggerSurge();
        loop();
      }, 45000 + Math.random() * 30000);
    };
    loop();
    return () => clearTimeout(t);
  }, [surges]);

  const id = surge ?? locked;
  if (!id) return null;
  const mod = VISUAL_MODS[id];
  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden>
      <div
        className={`absolute inset-0 ${mod.jitter ? "tracy-glitch" : ""}`}
        style={{ backdropFilter: mod.filter, WebkitBackdropFilter: mod.filter }}
      />
      {mod.tint ? (
        <div className="absolute inset-0" style={{ backgroundColor: mod.tint, mixBlendMode: mod.blend ?? "multiply" }} />
      ) : null}
      {mod.pattern ? <div className="absolute inset-0" style={{ background: mod.pattern }} /> : null}
      {surge ? (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-sm border border-signal/60 bg-background/70 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-signal">
          ⚡ ANOMALY DETECTED: {mod.label} · 6s
        </div>
      ) : null}
    </div>
  );
}

export function VisualModControls() {
  const { locked, surges } = useMods();
  const [open, setOpen] = useState(false);
  const ids = Object.keys(VISUAL_MODS) as VisualModId[];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Visual mods"
        className={`h-8 rounded-sm px-2 font-mono text-xs ${locked || surges ? "bg-signal text-signal-foreground" : "text-muted-foreground"}`}
      >
        FX
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-50 w-48 space-y-1 rounded-sm border border-border bg-card/95 p-2 font-mono text-[11px] backdrop-blur">
          <button type="button" onClick={() => set({ locked: null })} className={`block w-full px-2 py-1 text-left ${!locked ? "text-bitcoin" : "text-muted-foreground"}`}>
            NORMAL
          </button>
          {ids.map((id) => (
            <button key={id} type="button" onClick={() => set({ locked: id })} className={`block w-full px-2 py-1 text-left ${locked === id ? "text-bitcoin" : "text-muted-foreground hover:text-foreground"}`}>
              {VISUAL_MODS[id].label}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button type="button" onClick={() => set({ surges: !surges })} className={`block w-full px-2 py-1 text-left ${surges ? "text-signal" : "text-muted-foreground"}`}>
            RANDOM SURGES: {surges ? "ON" : "OFF"}
          </button>
          <button type="button" onClick={triggerSurge} className="block w-full px-2 py-1 text-left text-signal">
            ⚡ GLITCH NOW
          </button>
        </div>
      ) : null}
    </div>
  );
}
