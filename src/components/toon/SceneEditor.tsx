import { useState } from "react";
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
          <label className="col-span-3 text-[11px] text-muted-foreground">Position ← → {a.x}
            <input type="range" min={-20} max={20} value={a.x} className="w-full" onChange={(e) => patch({ cast: s.cast.map((c, j) => (j === k ? { ...c, x: Number(e.target.value) } : c)) })} />
          </label>
        </div>
      ))}
      {s.cast.length < 4 && (
        <button className="mt-2 font-mono text-[11px] text-signal" onClick={() => patch({ cast: [...s.cast, { height: s.block, name: `${s.block}.bitmap`, x: s.cast.length % 2 ? 6 : -6, z: 0, pose: "idle" }] })}>+ ADD GUARDIAN</button>
      )}

      <div className="label mt-4 text-signal">DIALOGUE</div>
      <ContinuityHint notes={notes} />
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
