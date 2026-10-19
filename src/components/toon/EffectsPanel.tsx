import { useEffect, useState } from "react";
import { HOUSE_VFX, VFX_FORMAT, VFX_MAX_CUES, loadCustomVFX, parseVFX, saveCustomVFX, type ToonVFX } from "@/lib/toon-vfx";
import { sceneAt, type ToonEpisode } from "@/lib/toon-script";

/** Pick an effect, drop it into the current scene at the playhead, or import a community effect as JSON. */
export function EffectsPanel({ episode, time, onChange }: { episode: ToonEpisode; time: number; onChange: (e: ToonEpisode) => void }) {
  const [custom, setCustom] = useState<ToonVFX[]>([]);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setCustom(loadCustomVFX()), []);
  const { index, local } = sceneAt(episode, time);
  const scene = episode.scenes[index];
  const all = [...HOUSE_VFX, ...custom];

  const persist = (list: ToonVFX[]) => { setCustom(list); saveCustomVFX(list); window.dispatchEvent(new Event("bitmapwin-vfx")); };
  const setFx = (fx: import("@/lib/toon-vfx").VfxCue[]) => onChange({ ...episode, scenes: episode.scenes.map((s, i) => (i === index ? { ...s, fx } : s)) });
  const add = (id: string) => {
    if (!scene) return;
    const cur = scene.fx ?? [];
    if (cur.length >= VFX_MAX_CUES) return setMsg(`At most ${VFX_MAX_CUES} effects per scene.`);
    setFx([...cur, { id, at: Math.round(local * 10) / 10, x: 0, y: 0, z: 0 }]);
    setMsg(`Added to scene ${index + 1} at ${local.toFixed(1)}s.`);
  };
  const importFx = () => {
    try {
      const fx = parseVFX(json);
      if (fx.id.startsWith("bitmapwin/")) throw new Error('Use your own id prefix, not "bitmapwin/".');
      persist([...custom.filter((c) => c.id !== fx.id), fx]); setJson(""); setMsg(`Imported "${fx.name}".`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Invalid effect."); }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="label text-signal">EFFECTS · OPEN {VFX_FORMAT.toUpperCase()}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">Each effect is plain JSON anyone can make and share, drawn in one draw call and fully repeatable when scrubbing or exporting.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {all.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 border border-border p-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{f.name}</div>
              <div className="truncate font-mono text-[10px] text-muted-foreground" data-no-translate>{f.id}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="btn-term-ghost text-[10px]" onClick={() => add(f.id)}>[ ADD ]</button>
              <button className="btn-term-ghost text-[10px]" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(f, null, 2)); setMsg(`Copied "${f.name}" JSON.`); }}>[ COPY ]</button>
              {!f.id.startsWith("bitmapwin/") && <button className="btn-term-ghost text-[10px]" onClick={() => persist(custom.filter((c) => c.id !== f.id))}>[ × ]</button>}
            </div>
          </div>
        ))}
      </div>
      {scene && (scene.fx?.length ?? 0) > 0 && (
        <div className="mt-3">
          <div className="label">SCENE {index + 1} EFFECTS</div>
          <ul className="mt-1 space-y-1">
            {scene.fx!.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span data-no-translate>{c.id} @ {c.at}s{all.some((f) => f.id === c.id) ? "" : " (not in your library)"}</span>
                <button className="btn-term-ghost text-[10px]" onClick={() => setFx(scene.fx!.filter((_, j) => j !== i))}>[ REMOVE ]</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <div className="label">IMPORT AN EFFECT (JSON)</div>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Effect JSON"
          placeholder={`{ "format": "${VFX_FORMAT}", "id": "you/flare-v1", ... }`}
          className="mt-1 h-24 w-full border border-border bg-background p-2 font-mono text-[11px]" />
        <button className="btn-term mt-2" onClick={importFx}>[ IMPORT EFFECT ]</button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-signal">{msg}</p>}
    </section>
  );
}
