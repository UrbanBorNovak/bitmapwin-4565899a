import { useState } from "react";
import { sceneAt, type LineCam, type Pose, type Shot, type ToonEpisode, type ToonScene } from "@/lib/toon-script";

const SHOTS: { v: Shot; label: string }[] = [
  { v: "wide", label: "WIDE" }, { v: "orbit", label: "ORBIT" }, { v: "dolly", label: "DOLLY" },
  { v: "dutch", label: "DUTCH" }, { v: "crane", label: "CRANE" },
];
const CAMS: { v: LineCam; label: string }[] = [
  { v: "auto", label: "SCENE CAM" }, { v: "close", label: "CLOSE" }, { v: "two", label: "TWO-SHOT" },
  { v: "ots", label: "OVER SHOULDER" }, { v: "establish", label: "ESTABLISH" },
];
const POSES: Pose[] = ["idle", "talk", "walk", "combat", "wave", "dance", "jump"];
const clamp = (v: number) => Math.max(-20, Math.min(20, v));

/** Quick visual staging for the scene under the playhead: camera, active-line framing, actor marks. */
export function StageDirector({ episode, time, disabled, onChange }: { episode: ToonEpisode; time: number; disabled?: boolean; onChange: (e: ToonEpisode) => void }) {
  const [actor, setActor] = useState(0);
  const { index, local } = sceneAt(episode, time);
  const s = episode.scenes[index];
  if (!s) return null;
  const setScene = (p: Partial<ToonScene>) => onChange({ ...episode, scenes: episode.scenes.map((c, k) => (k === index ? { ...c, ...p } : c)) });
  const lineIdx = s.lines.findIndex((l) => local >= l.at && local < l.at + l.dur);
  const line = lineIdx >= 0 ? s.lines[lineIdx] : undefined;
  const a = Math.min(actor, Math.max(0, s.cast.length - 1));
  const who = s.cast[a];
  const move = (x: number, z: number) => setScene({ cast: s.cast.map((c, j) => (j === a ? { ...c, x: clamp(x), z: clamp(z) } : c)) });
  const btn = (on: boolean) => (on ? "btn-term" : "btn-term-ghost");

  return (
    <section className="mt-3 rounded-lg border border-border bg-card p-3 font-mono text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label text-signal">STAGE DIRECTOR · SCENE {index + 1}</span>
        <span className="text-muted-foreground">{local.toFixed(1)}s / {s.duration}s</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="w-24 text-muted-foreground">CAMERA</span>
        {SHOTS.map((o) => (
          <button key={o.v} disabled={disabled} aria-pressed={s.shot === o.v} className={btn(s.shot === o.v)} onClick={() => setScene({ shot: o.v })}>[ {o.label} ]</button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="w-24 text-muted-foreground">THIS LINE</span>
        {line ? CAMS.map((o) => {
          const on = (line.cam ?? "auto") === o.v;
          return (
            <button key={o.v} disabled={disabled} aria-pressed={on} className={btn(on)}
              onClick={() => setScene({ lines: s.lines.map((l, k) => (k === lineIdx ? { ...l, cam: o.v } : l)) })}>[ {o.label} ]</button>
          );
        }) : <span className="text-muted-foreground">Move the playhead onto a line of dialogue to frame it.</span>}
      </div>
      {line && <div className="mt-1 pl-24 text-muted-foreground">“{line.text.slice(0, 60)}”</div>}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="w-24 text-muted-foreground">ACTOR</span>
        {s.cast.map((c, k) => (
          <button key={k} disabled={disabled} aria-pressed={k === a} className={btn(k === a)} onClick={() => setActor(k)}>[ {k + 1} · {c.name.slice(0, 14)} ]</button>
        ))}
      </div>
      {who && (<>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="w-24 text-muted-foreground">MARK</span>
          <button disabled={disabled} className="btn-term-ghost" onClick={() => move(-8, who.z)}>[ ◄ LEFT ]</button>
          <button disabled={disabled} className="btn-term-ghost" onClick={() => move(0, 2)}>[ ▲ CENTER ]</button>
          <button disabled={disabled} className="btn-term-ghost" onClick={() => move(8, who.z)}>[ RIGHT ► ]</button>
          <button disabled={disabled} className="btn-term-ghost" onClick={() => move(who.x, who.z + 3)}>[ FORWARD ]</button>
          <button disabled={disabled} className="btn-term-ghost" onClick={() => move(who.x, who.z - 3)}>[ BACK ]</button>
          <span className="text-muted-foreground">x {who.x} · z {who.z}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="w-24 text-muted-foreground">ACTION</span>
          {POSES.map((p) => (
            <button key={p} disabled={disabled} aria-pressed={who.pose === p} className={btn(who.pose === p)}
              onClick={() => setScene({ cast: s.cast.map((c, j) => (j === a ? { ...c, pose: p } : c)) })}>[ {p.toUpperCase()} ]</button>
          ))}
        </div>
      </>)}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="w-24 text-muted-foreground">FORMAT</span>
        <button disabled={disabled} aria-pressed={episode.aspect === "16:9"} className={btn(episode.aspect === "16:9")} onClick={() => onChange({ ...episode, aspect: "16:9" })}>[ 16:9 CINEMA ]</button>
        <button disabled={disabled} aria-pressed={episode.aspect === "9:16"} className={btn(episode.aspect === "9:16")} onClick={() => onChange({ ...episode, aspect: "9:16" })}>[ 9:16 VERTICAL ]</button>
      </div>
    </section>
  );
}

/** Rule-of-thirds guide over the preview (never recorded: export draws its own overlay canvas). */
export function ThirdsGuide() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[33.333, 66.666].map((p) => <div key={`v${p}`} className="absolute inset-y-0 border-l border-dashed border-signal/30" style={{ left: `${p}%` }} />)}
      {[33.333, 66.666].map((p) => <div key={`h${p}`} className="absolute inset-x-0 border-t border-dashed border-signal/30" style={{ top: `${p}%` }} />)}
    </div>
  );
}
