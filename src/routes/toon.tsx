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
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div className="label text-bitcoin">CREATION · TOOLS</div>
      <h1 className="display mt-2 text-2xl md:text-4xl">TOON STUDIO</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Write a short episode, cast the Guardians of real BITMAPs on their own land and voxel builds, then export the video. Everything runs in your browser.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_420px]">
        <div>
          <div ref={stageRef} className={`relative mx-auto overflow-hidden rounded-lg border border-border bg-card ${vertical ? "aspect-[9/16] max-h-[78vh]" : "aspect-video"}`}>
            <div className="absolute inset-0" style={{ filter: styleFilter(episode.style) }}>
            <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
              <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
                <ToonStage3D episode={episode} time={time} />
              </Suspense>
            </ClientOnly>
            </div>
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
            <button className="btn-term" disabled={recording} onClick={() => { if (time >= total) setTime(0); setPlaying((p) => !p); }}>[ {playing ? "PAUSE" : "▶ PLAY"} ]</button>
            <button className="btn-term-ghost" disabled={recording} onClick={() => { setPlaying(false); setTime(0); }}>[ ⏮ REWIND ]</button>
            <button className="btn-term" disabled={recording} onClick={() => void record()}>[ {recording ? "● RECORDING…" : `⏺ EXPORT VIDEO (${mp4Ok === false ? "WEBM" : mp4Ok ? "MP4 FOR X" : "…"})`} ]</button>
            <button className="btn-term-ghost" disabled={recording} onClick={() => void postToX()}>[ 𝕏 POST TO X ]</button>
            <input type="range" min={0} max={total} step={0.05} value={time} disabled={recording}
              onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} className="min-w-40 flex-1" aria-label="Timeline" />
            <span className="text-muted-foreground">{time.toFixed(1)}s / {total.toFixed(0)}s</span>
          </div>
          <div className="mt-3"><CinemaSubmitPanel episode={episode} /></div>
          <div className="mt-3"><ReleasePanel episode={episode} file={lastFile} onAspect={(a) => load({ ...episode, aspect: a })} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="label text-signal">ART STYLE</span>
            {TOON_STYLES.map((s) => (
              <button key={s.id} disabled={recording} aria-pressed={(episode.style ?? "classic") === s.id}
                className={(episode.style ?? "classic") === s.id ? "btn-term" : "btn-term-ghost"}
                onClick={() => { const n = { ...episode, style: s.id as ToonStyle }; setEpisode(n); setScript(JSON.stringify(n, null, 2)); }}>[ {s.label} ]</button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="label text-signal">SOUND</span>
            <button className="btn-term-ghost" disabled={recording} onClick={() => setMuted((m) => !m)}>[ {muted ? "🔇 SOUND OFF" : "🔊 SOUND ON"} ]</button>
            <label className="flex items-center gap-1 text-muted-foreground">MUSIC
              <select className="border border-border bg-background px-2 py-1" value={episode.music ?? "adventure"} disabled={recording}
                onChange={(e) => { const n = { ...episode, music: e.target.value as Music }; setEpisode(n); setScript(JSON.stringify(n, null, 2)); }}>
                {MUSIC.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-muted-foreground">
              <input type="checkbox" checked={episode.voices !== false} disabled={recording}
                onChange={(e) => { const n = { ...episode, voices: e.target.checked }; setEpisode(n); setScript(JSON.stringify(n, null, 2)); }} /> GUARDIAN VOICES
            </label>
          </div>
          {note && <p className="mt-2 font-mono text-[11px] text-signal">&gt; {note}</p>}
        </div>

        <aside className="space-y-4">
          <div id="episode-machine"><EpisodeMachine disabled={recording} onEpisode={(e) => { load(e); setPlaying(true); }} /></div>
          <ToonLibraryPanel episode={episode} onOpen={load} onCharacters={setCharacters} onNotes={setNotes} />
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="label text-signal">EPISODE GENERATOR</div>
            <div className="mt-3 flex gap-2 font-mono text-xs">
              <input value={hero} onChange={(e) => setHero(e.target.value.replace(/\D/g, ""))} aria-label="Hero BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Hero block" />
              <input value={rival} onChange={(e) => setRival(e.target.value.replace(/\D/g, ""))} aria-label="Rival BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Rival block" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-term" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0))}>[ WRITE EPISODE ]</button>
              <button className="btn-term-ghost" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0, Math.floor(Math.random() * 1e9)))}>[ NEW TAKE ]</button>
              <button className="btn-term-ghost" disabled={recording} onClick={() => {
                if (window.confirm("Replace your current episode with the Guardians of the Citadel teaser? Unsaved changes to this episode will be lost.")) load(structuredClone(CITADEL_TEASER));
              }}>[ LOAD TEASER ]</button>
              <button className="btn-term-ghost" disabled={recording} onClick={() => {
                if (window.confirm("Replace your current episode with the BITMAP Pixels: Coming Home trailer? Unsaved changes to this episode will be lost.")) load(structuredClone(PIXELS_HOMECOMING));
              }}>[ PIXELS TRAILER ]</button>
              <button className="btn-term-ghost" disabled={recording} onClick={() => {
                if (window.confirm("Replace your current episode with the 3-minute short Tide of Iron? Unsaved changes to this episode will be lost.")) load(structuredClone(BEACH_LANDING));
              }}>[ TIDE OF IRON · 3 MIN ]</button>
              <button className="btn-term-ghost" disabled={recording} onClick={() => {
                if (window.confirm("Replace your current episode with the portal short Transmission? Unsaved changes to this episode will be lost.")) load(structuredClone(TRANSMISSION));
              }}>[ TRANSMISSION · PORTAL ]</button>
              <button className="btn-term-ghost" disabled={recording} onClick={() => {
                if (window.confirm("Replace your current episode with the Land Forge promo? Unsaved changes to this episode will be lost.")) load(structuredClone(FORGE_PROMO));
              }}>[ LAND FORGE PROMO ]</button>
              <button className="btn-term-ghost" onClick={() => load({ ...episode, aspect: vertical ? "16:9" : "9:16" })}>[ {vertical ? "16:9 TV" : "9:16 REEL"} ]</button>
            </div>
          </section>
          <SceneEditor episode={episode} characters={characters} notes={notes}
            onChange={(e) => { setEpisode(e); setScript(JSON.stringify(e, null, 2)); setScriptError(null); setTime((t) => Math.min(t, episodeLength(e))); }}
            onSeek={(t) => { setPlaying(false); setTime(t + 0.01); }} />
          <EffectsPanel episode={episode} time={time} onChange={(e) => { setEpisode(e); setScript(JSON.stringify(e, null, 2)); setScriptError(null); }} />
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="label text-signal">SCRIPT (JSON · ADVANCED)</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Edit scenes, shots (wide, orbit, dolly, dutch, crane), poses (idle, walk, talk, jump, combat) and lines, then apply.</p>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} spellCheck={false}
              className="mt-2 h-80 w-full border border-border bg-background p-2 font-mono text-[11px]" aria-label="Episode script" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-term" onClick={() => { try { load(parseEpisode(script)); } catch (err) { setScriptError(err instanceof Error ? err.message : "Invalid script."); } }}>[ APPLY SCRIPT ]</button>
              <button className="btn-term-ghost" onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([script], { type: "application/json" }));
                a.download = "episode.toon.json"; a.click();
              }}>[ DOWNLOAD SCRIPT ]</button>
            </div>
            {scriptError && <p className="mt-2 font-mono text-[11px] text-bitcoin">&gt; {scriptError}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
