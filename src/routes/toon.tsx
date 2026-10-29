import { ReleasePanel } from "@/components/toon/ReleasePanel";
import { EpisodeMachine } from "@/components/toon/EpisodeMachine";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { episodeLength, generateEpisode, parseEpisode, sceneAt, transitionAt, MUSIC, type Music, type ToonEpisode } from "@/lib/toon-script";
import { TOON_STYLES, paintStyle, styleFilter, type ToonStyle } from "@/lib/toon-style";
import { EffectsPanel } from "@/components/toon/EffectsPanel";
import { SceneEditor } from "@/components/toon/SceneEditor";
import { ToonLibraryPanel } from "@/components/toon/ToonLibraryPanel";
import type { ContinuityNote, ToonCharacter } from "@/lib/toon-library";
import { playSoundtrack, renderSoundtrack } from "@/lib/toon-audio";
import { canEncodeMp4, createXRecorder, probeMp4, X_MAX_SECONDS, X_SIZES, xIntentUrl } from "@/lib/x-video";
import { BEACH_LANDING, CITADEL_TEASER, FORGE_PROMO, PIXELS_HOMECOMING, TRANSMISSION } from "@/lib/toon-teaser";
import { drawOverlay } from "@/lib/toon-overlay";
import { StageDirector, ThirdsGuide } from "@/components/toon/StageDirector";
import { CinemaSubmitPanel } from "@/components/toon/CinemaSubmitPanel";

const ToonStage3D = lazy(() => import("@/components/toon/ToonStage3D"));

export const Route = createFileRoute("/toon")({
  head: () => {
    const title = "Toon Studio — Cartoon Episodes Starring BITMAP Guardians";
    const description =
      "Script cartoon episodes on real BITMAP land: cast on-chain Guardians, stage voxel builds, add comic speech bubbles and export the video from your browser.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ToonPage,
});


function ToonPage() {
  const [hero, setHero] = useState("840000");
  const [rival, setRival] = useState("77819");
  const [episode, setEpisode] = useState<ToonEpisode>(() => generateEpisode(840000, 77819));
  const [script, setScript] = useState(() => JSON.stringify(generateEpisode(840000, 77819), null, 2));
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [characters, setCharacters] = useState<ToonCharacter[]>([]);
  const [notes, setNotes] = useState<ContinuityNote[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const total = useMemo(() => episodeLength(episode), [episode]);
  const timeRef = useRef(0);
  timeRef.current = time;
  const [muted, setMuted] = useState(false);
  const [guides, setGuides] = useState(false);
  const [tab, setTab] = useState<"direct" | "write" | "look" | "library" | "export" | "code">("direct");
  const soundRef = useRef<{ key: string; buf: Promise<AudioBuffer | null> } | null>(null);
  const soundtrack = () => {
    const key = JSON.stringify(episode);
    if (soundRef.current?.key !== key) soundRef.current = { key, buf: renderSoundtrack(episode).catch(() => null) };
    return soundRef.current.buf;
  };
  // Live preview audio follows play/pause and restarts from the playhead.
  useEffect(() => {
    if (!playing || muted || recording) return;
    let stop = () => {}, live = true;
    void soundtrack().then((b) => { if (b && live) stop = playSoundtrack(b, timeRef.current); });
    return () => { live = false; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, muted, recording, episode]);

  const load = (e: ToonEpisode) => { setEpisode(e); setScript(JSON.stringify(e, null, 2)); setTime(0); setScriptError(null); };

  useEffect(() => {
    if (!playing) return;
    // Absolute clock: a slow render must never lose time (export would stretch past its real length).
    let raf = 0;
    const t0 = timeRef.current, start = performance.now();
    const tick = (now: number) => {
      const next = t0 + Math.max(0, now - start) / 1000;
      timeRef.current = next;
      if (next >= total) { setTime(total); setPlaying(false); return; }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)) { c.width = Math.round(r.width); c.height = Math.round(r.height); }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawOverlay(ctx, c.width, c.height, episode, time);
    // Redraw once the 3D stage has rendered this time, so bubbles use fresh head positions (scrubbing).
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => drawOverlay(ctx, c.width, c.height, episode, timeRef.current)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [episode, time]);

  const [lastFile, setLastFile] = useState<File | null>(null);
  // Label the button with the format this browser will really save (checked after hydration).
  const [mp4Ok, setMp4Ok] = useState<boolean | null>(null);
  useEffect(() => { let live = true; void probeMp4().then((ok) => { if (live) setMp4Ok(ok); }); return () => { live = false; }; }, []);

  const record = async () => {
    const gl = stageRef.current?.querySelector("canvas");
    if (!gl || (typeof MediaRecorder === "undefined" && !canEncodeMp4())) return setNote("VIDEO RECORDING IS NOT SUPPORTED IN THIS BROWSER.");
    if (total > X_MAX_SECONDS) setNote(`EPISODE IS LONGER THAN ${X_MAX_SECONDS}s — X MAY REJECT IT.`);
    const [W, H] = X_SIZES[episode.aspect];
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d")!;
    const over = document.createElement("canvas");
    over.width = W; over.height = H;
    const octx = over.getContext("2d")!;
    const rec = await createXRecorder(out, muted ? null : await soundtrack());
    let raf = 0, stopped = false;
    const paint = async () => {
      // Cover-fit the stage into the exact X frame size.
      const s = Math.max(W / gl.width, H / gl.height), dw = gl.width * s, dh = gl.height * s;
      ctx.fillStyle = "#0a0e14"; ctx.fillRect(0, 0, W, H);
      ctx.filter = styleFilter(episode.style);
      ctx.drawImage(gl, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.filter = "none";
      drawOverlay(octx, W, H, episode, timeRef.current, (nx, ny) => [(W - dw) / 2 + nx * dw, (H - dh) / 2 + ny * dh]);
      ctx.drawImage(over, 0, 0);
      rec.addFrame(out, timeRef.current);
      if (timeRef.current >= total && !stopped) {
        stopped = true;
        const blob = await rec.finish();
        setRecording(false);
        const name = `${episode.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-bitmapwin.${rec.kind}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
        setLastFile(new File([blob], name, { type: blob.type }));
        setNote(rec.kind === "mp4" ? `X-READY MP4 SAVED (${W}×${H}, 30 FPS, H.264${rec.hasAudio ? " + AAC SOUND" : muted ? ", SOUND OFF" : ", NO SOUND — THIS BROWSER CAN'T ENCODE AUDIO"}). NOW PRESS POST TO X AND ATTACH IT.` : "SAVED AS WEBM — X NEEDS MP4. USE CHROME, EDGE OR SAFARI FOR AN X-READY FILE.");
        return;
      }
      raf = requestAnimationFrame(paint);
    };
    void raf;
    setNote(null);
    setTime(0);
    timeRef.current = 0;
    setRecording(true);
    setPlaying(true);
    raf = requestAnimationFrame(paint);
  };

  const postToX = async () => {
    const file = lastFile;
    if (file && matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: episode.title, text: `${episode.title} #Bitmap #Ordinals #Bitcoin` }); return; } catch { /* fall through */ }
    }
    window.open(xIntentUrl(episode.title), "_blank", "noopener");
  };

  const vertical = episode.aspect === "9:16";
  const edit = (n: ToonEpisode) => { setEpisode(n); setScript(JSON.stringify(n, null, 2)); setScriptError(null); };
  const cur = sceneAt(episode, time).index;
  const tc = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const presets: [string, ToonEpisode, string][] = [
    ["CITADEL", CITADEL_TEASER, "Guardians of the Citadel teaser"],
    ["PIXELS", PIXELS_HOMECOMING, "BITMAP Pixels: Coming Home trailer"],
    ["TIDE OF IRON", BEACH_LANDING, "3-minute short Tide of Iron"],
    ["TRANSMISSION", TRANSMISSION, "portal short Transmission"],
    ["FORGE PROMO", FORGE_PROMO, "Land Forge promo"],
  ];
  const TABS = [["direct", "DIRECT"], ["write", "WRITE"], ["look", "LOOK & SOUND"], ["library", "LIBRARY"], ["export", "EXPORT"], ["code", "SCRIPT"]] as const;
  return (
    <div className="studio-shell mx-auto max-w-[1700px] px-2 pb-32 pt-3 sm:px-3 md:px-6 lg:pb-6">
      {/* Production bar */}
      <header className="studio-panel flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 font-mono text-xs">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${recording ? "animate-pulse bg-destructive" : playing ? "bg-signal" : "bg-muted-foreground/50"}`} />
          <span className="label text-bitcoin">TOON STUDIO</span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span className="truncate text-foreground" title={episode.title}>{episode.title}</span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{episode.scenes.length} SCENES · {total.toFixed(0)}s</span>
        <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
          {(["16:9", "9:16"] as const).map((a) => (
            <button key={a} aria-pressed={episode.aspect === a} disabled={recording} onClick={() => load({ ...episode, aspect: a })}
              className={`rounded px-2 py-1 ${episode.aspect === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{a === "16:9" ? "▭ 16:9" : "▯ 9:16"}</button>
          ))}
          <button className="btn-term ml-2" disabled={recording} onClick={() => void record()}>{recording ? "● REC…" : "⏺ EXPORT"}</button>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_440px]">
        {/* Monitor column */}
        <div className="min-w-0 space-y-3">
          <section className="studio-panel p-2">
            <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] text-muted-foreground">
              <span>PROGRAM MONITOR · SCENE {cur + 1}/{episode.scenes.length} · {episode.scenes[cur]?.shot.toUpperCase()}</span>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> GUIDES</label>
            </div>
            <div className="studio-monitor grid place-items-center rounded">
              <div ref={stageRef} className={`relative w-full overflow-hidden ${vertical ? "aspect-[9/16] max-h-[70vh] w-auto" : "aspect-video"}`} style={vertical ? { height: "70vh" } : undefined}>
                <div className="absolute inset-0" style={{ filter: styleFilter(episode.style) }}>
                  <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
                    <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
                      <ToonStage3D episode={episode} time={time} />
                    </Suspense>
                  </ClientOnly>
                </div>
                <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                {guides && !recording && <ThirdsGuide />}
                {recording && <span className="absolute left-3 top-3 rounded bg-destructive px-2 py-0.5 font-mono text-[10px] text-destructive-foreground">● REC</span>}
              </div>
            </div>

            {/* Transport */}
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1 font-mono text-xs">
              <button aria-label="Rewind" className="studio-key" disabled={recording} onClick={() => { setPlaying(false); setTime(0); }}>⏮</button>
              <button aria-label="Back one second" className="studio-key" disabled={recording} onClick={() => { setPlaying(false); setTime((t) => Math.max(0, t - 1)); }}>◀◀</button>
              <button aria-label={playing ? "Pause" : "Play"} className="studio-key studio-key-main" disabled={recording} onClick={() => { if (time >= total) setTime(0); setPlaying((p) => !p); }}>{playing ? "❚❚" : "▶"}</button>
              <button aria-label="Forward one second" className="studio-key" disabled={recording} onClick={() => { setPlaying(false); setTime((t) => Math.min(total, t + 1)); }}>▶▶</button>
              <span className="studio-timecode">{tc(time)} <span className="text-muted-foreground">/ {tc(total)}</span></span>
              <button className="studio-key sm:ml-auto" disabled={recording} onClick={() => setMuted((m) => !m)}>{muted ? "🔇 MUTED" : "🔊 SOUND"}</button>
            </div>
          </section>

          {/* Timeline */}
          <section className="studio-panel p-2 font-mono text-[10px]">
            <div className="mb-1 flex justify-between px-1 text-muted-foreground"><span>TIMELINE</span><span>CLICK A CLIP TO JUMP</span></div>
            <div className="relative overflow-x-auto pb-1"><div className="relative min-w-full" style={{ width: `max(100%, ${episode.scenes.length * 84}px)` }}>
              <div className="flex h-12 gap-px rounded">
                {episode.scenes.map((s, i) => (
                  <button key={i} onClick={() => { setPlaying(false); setTime(episode.scenes.slice(0, i).reduce((a, x) => a + x.duration, 0) + 0.01); }}
                    style={{ flexGrow: s.duration, flexBasis: 0 }}
                    className={`studio-clip min-w-0 px-1.5 text-left ${i === cur ? "studio-clip-on" : ""}`}>
                    <span className="block truncate">{i + 1} · {s.shot.toUpperCase()}</span>
                    <span className="block truncate text-muted-foreground">{s.lines.length} LINE{s.lines.length === 1 ? "" : "S"} · {s.duration}s</span>
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 bg-bitcoin" style={{ left: `${total ? (time / total) * 100 : 0}%` }} />
            </div></div>
            <input type="range" min={0} max={total} step={0.05} value={time} disabled={recording}
              onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} className="mt-2 w-full" aria-label="Timeline" />
          </section>
          {note && <p className="studio-panel px-3 py-2 font-mono text-[11px] text-signal">&gt; {note}</p>}
        </div>

        {/* Inspector */}
        <aside className="studio-panel flex min-h-0 flex-col lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)]">
          <nav className="flex gap-px overflow-x-auto border-b border-border p-1 font-mono text-[10px]">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
                className={`flex-1 shrink-0 whitespace-nowrap rounded px-2.5 py-2 ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 sm:p-3">
            {tab === "direct" && (
              <>
                <StageDirector episode={episode} time={time} disabled={recording} onChange={edit} />
                <EffectsPanel episode={episode} time={time} onChange={edit} />
              </>
            )}
            {tab === "write" && (
              <>
                <div id="episode-machine"><EpisodeMachine disabled={recording} onEpisode={(e) => { load(e); setPlaying(true); }} /></div>
                <section className="rounded border border-border p-3">
                  <div className="label text-signal">QUICK EPISODE FROM TWO BLOCKS</div>
                  <div className="mt-2 flex gap-2 font-mono text-xs">
                    <input value={hero} onChange={(e) => setHero(e.target.value.replace(/\D/g, ""))} aria-label="Hero BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Hero block" />
                    <input value={rival} onChange={(e) => setRival(e.target.value.replace(/\D/g, ""))} aria-label="Rival BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Rival block" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-term" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0))}>[ WRITE ]</button>
                    <button className="btn-term-ghost" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0, Math.floor(Math.random() * 1e9)))}>[ NEW TAKE ]</button>
                  </div>
                </section>
                <SceneEditor episode={episode} characters={characters} notes={notes}
                  onChange={(e) => { edit(e); setTime((t) => Math.min(t, episodeLength(e))); }}
                  onSeek={(t) => { setPlaying(false); setTime(t + 0.01); }} />
              </>
            )}
            {tab === "look" && (
              <section className="space-y-3 font-mono text-xs">
                <div>
                  <div className="label text-signal">ART STYLE</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {TOON_STYLES.map((s) => (
                      <button key={s.id} disabled={recording} aria-pressed={(episode.style ?? "classic") === s.id}
                        className={(episode.style ?? "classic") === s.id ? "btn-term" : "btn-term-ghost"}
                        onClick={() => edit({ ...episode, style: s.id as ToonStyle })}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label text-signal">MUSIC</div>
                  <select className="mt-2 w-full border border-border bg-background px-2 py-1.5" value={episode.music ?? "adventure"} disabled={recording}
                    onChange={(e) => edit({ ...episode, music: e.target.value as Music })}>
                    {MUSIC.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={episode.voices !== false} disabled={recording} onChange={(e) => edit({ ...episode, voices: e.target.checked })} /> GUARDIAN VOICES
                </label>
              </section>
            )}
            {tab === "library" && (
              <>
                <section className="rounded border border-border p-3">
                  <div className="label text-signal">TEMPLATES</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {presets.map(([label, ep, desc]) => (
                      <button key={label} className="btn-term-ghost" disabled={recording} onClick={() => {
                        if (window.confirm(`Replace your current episode with the ${desc}? Unsaved changes will be lost.`)) load(structuredClone(ep));
                      }}>{label}</button>
                    ))}
                  </div>
                </section>
                <ToonLibraryPanel episode={episode} onOpen={load} onCharacters={setCharacters} onNotes={setNotes} />
              </>
            )}
            {tab === "export" && (
              <>
                <section className="rounded border border-border p-3 font-mono text-xs">
                  <div className="label text-signal">RENDER</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Plays the whole episode and saves {mp4Ok === false ? "a WEBM" : "an MP4 ready for X"} at {X_SIZES[episode.aspect].join("×")}.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-term" disabled={recording} onClick={() => void record()}>[ {recording ? "● RECORDING…" : "⏺ EXPORT VIDEO"} ]</button>
                    <button className="btn-term-ghost" disabled={recording} onClick={() => void postToX()}>[ 𝕏 POST TO X ]</button>
                  </div>
                </section>
                <ReleasePanel episode={episode} file={lastFile} onAspect={(a) => load({ ...episode, aspect: a })} />
                <CinemaSubmitPanel episode={episode} />
              </>
            )}
            {tab === "code" && (
              <section>
                <p className="text-[11px] text-muted-foreground">Edit scenes, shots, poses and lines directly, then apply.</p>
                <textarea value={script} onChange={(e) => setScript(e.target.value)} spellCheck={false}
                  className="mt-2 h-[50vh] w-full border border-border bg-background p-2 font-mono text-[11px]" aria-label="Episode script" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn-term" onClick={() => { try { load(parseEpisode(script)); } catch (err) { setScriptError(err instanceof Error ? err.message : "Invalid script."); } }}>[ APPLY ]</button>
                  <button className="btn-term-ghost" onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([script], { type: "application/json" }));
                    a.download = "episode.toon.json"; a.click();
                  }}>[ DOWNLOAD ]</button>
                </div>
                {scriptError && <p className="mt-2 font-mono text-[11px] text-bitcoin">&gt; {scriptError}</p>}
              </section>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
