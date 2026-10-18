import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { ContinuityNote, ToonCharacter } from "@/lib/toon-library";
import { ContinuityHint } from "@/components/toon/ContinuityNotebook";
import { CharacterHint } from "@/components/toon/CharacterProfiles";
import { MAX_SCENE_SECONDS, MAX_SCENES, type Pose, type Shot, type ToonEpisode, type ToonLine, type ToonScene } from "@/lib/toon-script";

const SHOTS: { v: Shot; label: string }[] = [
  { v: "wide", label: "Wide sweep" }, { v: "orbit", label: "Orbit" }, { v: "dolly", label: "Dolly in" },
  { v: "dutch", label: "Dutch tilt" }, { v: "crane", label: "Crane drop" },
];
const POSES: { v: Pose; label: string }[] = [
  { v: "idle", label: "Idle" }, { v: "walk", label: "Walk" }, { v: "talk", label: "Talk" },
  { v: "jump", label: "Jump" }, { v: "combat", label: "Combat" },
];
const SFX = ["", "BAM!", "HODL!", "SATS!", "WHOOSH!", "POW!"];
const field = "w-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground";
const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0));

/** Visual editor for the episode script; every change produces a new episode object. */
export function SceneEditor({ episode, onChange, onSeek, characters = [], notes = [] }: { episode: ToonEpisode; onChange: (e: ToonEpisode) => void; onSeek: (t: number) => void; characters?: ToonCharacter[]; notes?: ContinuityNote[] }) {
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, episode.scenes.length - 1);
  const s = episode.scenes[i]!;
  const start = episode.scenes.slice(0, i).reduce((a, c) => a + c.duration, 0);

  const setScenes = (scenes: ToonScene[]) => onChange({ ...episode, scenes });
  const patch = (p: Partial<ToonScene>) => setScenes(episode.scenes.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const patchLine = (k: number, p: Partial<ToonLine>) => patch({ lines: s.lines.map((l, j) => (j === k ? { ...l, ...p } : l)) });
  const select = (k: number) => { setSel(k); onSeek(episode.scenes.slice(0, k).reduce((a, c) => a + c.duration, 0)); };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="label text-signal">SCENE EDITOR</div>
      <input className={`${field} mt-2`} value={episode.title} onChange={(e) => onChange({ ...episode, title: e.target.value })} aria-label="Episode title" />

      <div className="mt-3 flex flex-wrap gap-1">
        {episode.scenes.map((c, k) => (
          <button key={k} onClick={() => select(k)}
            className={`border px-2 py-1 font-mono text-[11px] ${k === i ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
            {k + 1} · {c.duration}s
          </button>
        ))}
        <button disabled={episode.scenes.length >= MAX_SCENES} className="border border-border px-2 py-1 font-mono text-[11px] text-signal disabled:opacity-40"
          onClick={() => { setScenes([...episode.scenes, structuredClone(s)]); setSel(episode.scenes.length); }}>+ DUPLICATE</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">BITMAP block
          <input className={field} inputMode="numeric" value={s.block} onChange={(e) => patch({ block: num(e.target.value.replace(/\D/g, ""), 0, 1_999_999) })} />
        </label>
        <label className="text-[11px] text-muted-foreground">Camera move
          <select className={field} value={s.shot} onChange={(e) => patch({ shot: e.target.value as Shot })}>
            {SHOTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-[11px] text-muted-foreground">Length: {s.duration}s
          <input type="range" min={1} max={MAX_SCENE_SECONDS} step={0.5} value={s.duration} className="w-full" onChange={(e) => patch({ duration: Number(e.target.value) })} />
        </label>
        <label className="text-[11px] text-muted-foreground">Sound effect
          <select className={field} value={s.sfx ?? ""} onChange={(e) => patch({ sfx: e.target.value })}>
            {SFX.map((x) => <option key={x} value={x}>{x || "None"}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-1">
          <button className="btn-term-ghost text-[11px]" onClick={() => onSeek(start)}>PREVIEW</button>
          <button disabled={episode.scenes.length <= 1} className="btn-term-ghost text-[11px] disabled:opacity-40"
            onClick={() => { setScenes(episode.scenes.filter((_, k) => k !== i)); setSel(Math.max(0, i - 1)); }}>DELETE</button>
        </div>
      </div>

      <SceneTimeline duration={s.duration}
        rows={[
          ...s.cast.flatMap((a, k) => a.to ? [{ key: `m${k}`, kind: "move" as const, label: `▶ ${characters.find((c) => c.height === a.height)?.nickname || a.name} walks`, start: a.moveStart ?? 0, end: a.moveEnd ?? s.duration,
            set: (st: number, en: number) => patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, moveStart: st, moveEnd: en } : c)) }) }] : []),
          ...s.lines.map((l, k) => ({ key: `l${k}`, kind: "line" as const, label: `“${l.text.slice(0, 24)}”`, start: l.at, end: l.at + l.dur,
            set: (st: number, en: number) => patchLine(k, { at: st, dur: Math.max(0.3, en - st) }) })),
        ]} />
      <div className="label mt-4 text-signal">GUARDIANS</div>
      {s.cast.map((a, k) => (
        <div key={k} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className={field} inputMode="numeric" aria-label="Guardian block" value={a.height}
            onChange={(e) => { const h = num(e.target.value.replace(/\D/g, ""), 0, 1_999_999); patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, height: h, name: `${h}.bitmap` } : c)) }); }} />
          <select className={field} value={a.pose} aria-label="Guardian action" onChange={(e) => patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, pose: e.target.value as Pose } : c)) })}>
            {POSES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <button className="px-2 font-mono text-[11px] text-muted-foreground hover:text-bitcoin" aria-label="Remove Guardian"
            onClick={() => patch({ cast: s.cast.filter((_, j) => j !== k), lines: s.lines.filter((l) => l.speaker !== k).map((l) => ({ ...l, speaker: l.speaker > k ? l.speaker - 1 : l.speaker })) })}>✕</button>
          <div className="col-span-3 text-[10px] font-mono text-muted-foreground">{a.to ? "START POSITION" : "POSITION"}</div>
          <PositionPad x={a.x} z={a.z} onMove={(x, z) => patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, x, z } : c)) })} />
          <label className="col-span-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={!!a.to} onChange={(e) => patch({ cast: s.cast.map((c, j) => {
              if (j !== k) return c;
              if (e.target.checked) return { ...c, to: { x: Math.max(-20, Math.min(20, -c.x || 8)), z: c.z } };
              const { to: _drop, moveStart: _a, moveEnd: _b, ...rest } = c; return rest;
            }) })} /> MOVES DURING SCENE
          </label>
          {a.to && (<>
            <div className="col-span-3 text-[10px] font-mono text-bitcoin">END POSITION</div>
            <div className="col-span-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <label>Start walking at {(a.moveStart ?? 0).toFixed(1)}s
                <input type="range" min={0} max={s.duration} step={0.1} value={a.moveStart ?? 0} className="w-full" aria-label="Movement start time"
                  onChange={(e) => { const v = Number(e.target.value); patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, moveStart: v, moveEnd: Math.max(v, c.moveEnd ?? s.duration) } : c)) }); }} />
              </label>
              <label>Arrive by {(a.moveEnd ?? s.duration).toFixed(1)}s
                <input type="range" min={0} max={s.duration} step={0.1} value={a.moveEnd ?? s.duration} className="w-full" aria-label="Movement stop time"
                  onChange={(e) => { const v = Number(e.target.value); patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, moveEnd: v, moveStart: Math.min(v, c.moveStart ?? 0) } : c)) }); }} />
              </label>
            </div>
            <PositionPad x={a.to.x} z={a.to.z} start={{ x: a.x, z: a.z }} onMove={(x, z) => patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, to: { x, z } } : c)) })} />
          </>)}
        </div>
      ))}
      {s.cast.length < 4 && (
        <button className="mt-2 font-mono text-[11px] text-signal" onClick={() => patch({ cast: [...s.cast, { height: s.block, name: `${s.block}.bitmap`, x: s.cast.length % 2 ? 6 : -6, z: 0, pose: "idle" }] })}>+ ADD GUARDIAN</button>
      )}

      <div className="label mt-4 text-signal">DIALOGUE</div>
      <ContinuityHint notes={notes} characters={characters} />
      {s.lines.map((l, k) => (
        <div key={k} className="mt-2 space-y-1 border-l border-border pl-2">
          <CharacterHint c={characters.find((c) => c.height === s.cast[l.speaker]?.height)} />
          <textarea className={`${field} h-14`} value={l.text} aria-label="Line text" onChange={(e) => patchLine(k, { text: e.target.value.slice(0, 140) })} />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <select className={field} value={l.speaker} aria-label="Speaker" onChange={(e) => patchLine(k, { speaker: Number(e.target.value) })}>
              {s.cast.map((a, j) => <option key={j} value={j}>{characters.find((c) => c.height === a.height)?.nickname || a.name}</option>)}
            </select>
            <select className={field} value={l.style} aria-label="Bubble style" onChange={(e) => patchLine(k, { style: e.target.value as ToonLine["style"] })}>
              <option value="speech">Speech</option><option value="shout">Shout</option><option value="thought">Thought</option>
            </select>
            <button className="px-2 font-mono text-[11px] text-muted-foreground hover:text-bitcoin" aria-label="Remove line" onClick={() => patch({ lines: s.lines.filter((_, j) => j !== k) })}>✕</button>
          </div>
          <label className="block text-[11px] text-muted-foreground">Starts at {l.at}s · shows {l.dur}s
            <input type="range" min={0} max={s.duration} step={0.1} value={l.at} className="w-full" onChange={(e) => patchLine(k, { at: Number(e.target.value) })} />
            <input type="range" min={0.5} max={s.duration} step={0.1} value={l.dur} className="w-full" onChange={(e) => patchLine(k, { dur: Number(e.target.value) })} />
          </label>
        </div>
      ))}
      {s.cast.length > 0 && (
        <button className="mt-2 font-mono text-[11px] text-signal" onClick={() => patch({ lines: [...s.lines, { at: 0.5, dur: Math.min(3, s.duration), speaker: 0, text: "New line", style: "speech" }] })}>+ ADD LINE</button>
      )}
    </section>
  );
}

/** Drag pad: left/right moves x, up/down moves the Guardian back/front (z). Arrow buttons nudge. */
function PositionPad({ x, z, onMove, start }: { x: number; z: number; onMove: (x: number, z: number) => void; start?: { x: number; z: number } }) {
  const clamp = (v: number) => Math.max(-20, Math.min(20, Math.round(v)));
  const at = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMove(clamp(((e.clientX - r.left) / r.width) * 40 - 20), clamp(((e.clientY - r.top) / r.height) * 40 - 20));
  };
  const btn = "h-8 w-8 border border-border font-mono text-xs hover:text-bitcoin";
  return (
    <div className="col-span-3 flex items-center gap-3">
      <div role="slider" aria-label="Guardian position" aria-valuetext={`x ${x}, depth ${z}`} tabIndex={0}
        className="relative h-24 w-24 shrink-0 touch-none cursor-crosshair border border-border bg-background"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
        onPointerMove={(e) => { if (e.buttons) at(e); }}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" /><div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span className="absolute left-1 top-0.5 font-mono text-[9px] text-muted-foreground">BACK</span>
        <span className="absolute bottom-0.5 left-1 font-mono text-[9px] text-muted-foreground">FRONT</span>
        {start && <div className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal" style={{ left: `${((start.x + 20) / 40) * 100}%`, top: `${((start.z + 20) / 40) * 100}%` }} />}
        <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bitcoin" style={{ left: `${((x + 20) / 40) * 100}%`, top: `${((z + 20) / 40) * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span /><button className={btn} aria-label="Move back" onClick={() => onMove(x, clamp(z - 2))}>↑</button><span />
        <button className={btn} aria-label="Move left" onClick={() => onMove(clamp(x - 2), z)}>←</button>
        <button className={btn} aria-label="Centre" onClick={() => onMove(0, 0)}>·</button>
        <button className={btn} aria-label="Move right" onClick={() => onMove(clamp(x + 2), z)}>→</button>
        <span /><button className={btn} aria-label="Move front" onClick={() => onMove(x, clamp(z + 2))}>↓</button><span />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">X {x}<br />DEPTH {z}</span>
    </div>
  );
}

type TimelineRow = { key: string; kind: "move" | "line"; label: string; start: number; end: number; set: (start: number, end: number) => void };

/** Scene timeline: Guardian walks (orange) and dialogue (cyan) as bars; drag a bar to shift it, drag its edges to retime. */
function SceneTimeline({ duration, rows }: { duration: number; rows: TimelineRow[] }) {
  const [snapOn, setSnapOn] = useState(true);
  const [guide, setGuide] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const setZoomAt = (next: number, anchorPx?: number) => {
    const el = scroller.current, z = Math.max(1, Math.min(16, next));
    if (!el) return setZoom(z);
    const ax = anchorPx ?? el.clientWidth / 2, frac = (el.scrollLeft + ax) / (el.clientWidth * zoom);
    setZoom(z);
    requestAnimationFrame(() => { el.scrollLeft = frac * el.clientWidth * z - ax; });
  };
  const zoomRef = useRef(setZoomAt); zoomRef.current = setZoomAt;
  const zRef = useRef(zoom); zRef.current = zoom;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Ctrl/⌘ + wheel or trackpad pinch zooms around the cursor; plain wheel scrolls the page.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomRef.current(zRef.current * Math.exp(-dy * 0.003), e.clientX - el.getBoundingClientRect().left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rows.length > 0]);
  const step = [0.25, 0.5, 1, 2, 5].find((v) => duration / v <= 6 * zoom) ?? 5;
  const ticks = Array.from({ length: Math.floor(duration / step + 1e-6) + 1 }, (_, k) => +(k * step).toFixed(2));
  if (!rows.length) return null;
  const tenth = (v: number) => Math.round(v * 10) / 10;
  // Walk bars snap to dialogue start/end times within ~8px.
  const targets = rows.filter((r) => r.kind === "line").flatMap((r) => [r.start, r.end]);
  const drag = (e: RPointerEvent<HTMLElement>, r: TimelineRow, mode: "start" | "end" | "move") => {
    e.preventDefault(); e.stopPropagation();
    const track = (e.currentTarget.closest("[data-track]") as HTMLElement).getBoundingClientRect();
    const x0 = e.clientX, s0 = r.start, e0 = r.end, len = e0 - s0, tol = (8 / track.width) * duration;
    const useSnap = snapOn && r.kind === "move" && targets.length > 0;
    const near = (v: number) => { let best: number | null = null; for (const t of targets) if (Math.abs(t - v) <= tol && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t; return best; };
    const onMove = (ev: PointerEvent) => {
      const d = ((ev.clientX - x0) / track.width) * duration;
      let g: number | null = null;
      if (mode === "start") { let v = Math.max(0, Math.min(e0 - 0.1, s0 + d)); const n = useSnap ? near(v) : null; if (n !== null && n < e0) { v = n; g = n; } else v = tenth(v); r.set(v, e0); }
      else if (mode === "end") { let v = Math.min(duration, Math.max(s0 + 0.1, e0 + d)); const n = useSnap ? near(v) : null; if (n !== null && n > s0) { v = n; g = n; } else v = tenth(v); r.set(s0, v); }
      else {
        let st = Math.max(0, Math.min(duration - len, s0 + d));
        const ns = useSnap ? near(st) : null, ne = useSnap ? near(st + len) : null;
        if (ns !== null && (ne === null || Math.abs(ns - st) <= Math.abs(ne - st - len))) { st = ns; g = ns; }
        else if (ne !== null && ne - len >= 0) { st = ne - len; g = ne; }
        else st = tenth(st);
        r.set(st, st + len);
      }
      setGuide(g);
    };
    const up = () => { setGuide(null); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", up);
  };
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="label text-signal">SCENE TIMELINE</div>
        <label className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <span className="mr-2 flex items-center gap-1">
            <button className="h-6 w-6 border border-border hover:text-bitcoin disabled:opacity-40" disabled={zoom <= 1} aria-label="Zoom out timeline" onClick={() => setZoomAt(zoom / 1.5)}>−</button>
            <span className="w-8 text-center">{zoom.toFixed(1)}×</span>
            <button className="h-6 w-6 border border-border hover:text-bitcoin disabled:opacity-40" disabled={zoom >= 16} aria-label="Zoom in timeline" onClick={() => setZoomAt(zoom * 1.5)}>+</button>
            <button className="h-6 border border-border px-1 hover:text-bitcoin" aria-label="Fit timeline" onClick={() => setZoomAt(1)}>FIT</button>
          </span>
          <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> SNAP TO DIALOGUE
        </label>
      </div>
      <div ref={scroller} className="mt-1 overflow-x-auto pb-1">
      <div style={{ width: `${zoom * 100}%` }}>
      <div className="relative h-4 font-mono text-[9px] text-muted-foreground">
        {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(t / duration) * 100}%` }}>{t.toFixed(step < 1 ? 1 : 0)}s</span>)}
      </div>
      <div className="relative space-y-1">
        {guide !== null && (
          <div className="pointer-events-none absolute -inset-y-1 z-10 w-px bg-foreground" style={{ left: `${(guide / duration) * 100}%` }}>
            <span className="absolute -bottom-4 -translate-x-1/2 bg-foreground px-1 font-mono text-[9px] text-background">{guide.toFixed(1)}s</span>
          </div>
        )}
        {rows.map((r) => {
          const left = (r.start / duration) * 100, width = Math.max(2, ((Math.min(r.end, duration) - r.start) / duration) * 100);
          const tone = r.kind === "move" ? "border-bitcoin bg-bitcoin/25 text-bitcoin" : "border-signal bg-signal/20 text-signal";
          return (
            <div key={r.key} data-track className="relative h-7 border border-border bg-background">
              <div className={`absolute inset-y-0 flex cursor-grab touch-none items-center overflow-hidden border px-2 font-mono text-[10px] ${tone}`}
                style={{ left: `${left}%`, width: `${width}%` }} onPointerDown={(e) => drag(e, r, "move")} title={`${r.label} · ${r.start.toFixed(1)}s → ${r.end.toFixed(1)}s`}>
                <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none bg-current opacity-50" aria-label={`${r.label} start`} onPointerDown={(e) => drag(e, r, "start")} />
                <span className="truncate">{r.label}{width * zoom > 28 ? ` · ${r.start.toFixed(1)}–${r.end.toFixed(1)}s` : ""}</span>
                <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none bg-current opacity-50" aria-label={`${r.label} end`} onPointerDown={(e) => drag(e, r, "end")} />
              </div>
            </div>
          );
        })}
      </div>
      </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Ctrl/⌘ + scroll or pinch to zoom. Drag a bar to move it; drag its ends to change when it starts and stops. Walk bars snap to dialogue times.</p>
    </div>
  );
}
