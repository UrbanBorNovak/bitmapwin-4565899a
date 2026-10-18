import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { episodeLength, generateEpisode, parseEpisode, sceneAt, type ToonEpisode } from "@/lib/toon-script";

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

/** Draws title card, captions and comic bubbles onto a 2D context (shared by screen + recording). */
function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, ep: ToonEpisode, t: number) {
  ctx.clearRect(0, 0, w, h);
  const { index, local } = sceneAt(ep, t);
  const s = ep.scenes[index];
  if (!s) return;
  const u = Math.min(w, h) / 600;
  ctx.textBaseline = "middle";
  // Title card on the first two seconds.
  if (t < 2.2) {
    ctx.globalAlpha = Math.min(1, (2.2 - t) * 2);
    ctx.fillStyle = "rgba(10,14,20,0.75)";
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    ctx.fillStyle = "#f7931a";
    ctx.font = `bold ${36 * u}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(ep.title.toUpperCase(), w / 2, h / 2);
    ctx.globalAlpha = 1;
  }
  for (const l of s.lines) {
    if (local < l.at || local > l.at + l.dur) continue;
    const pop = Math.min(1, (local - l.at) * 6);
    const left = l.speaker % 2 === 0;
    ctx.font = `bold ${22 * u}px 'DM Sans', sans-serif`;
    ctx.textAlign = "left";
    const words = l.text.split(" "), lines: string[] = [], maxW = w * 0.38;
    let cur = "";
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = word; } else cur = next;
    }
    lines.push(cur);
    const lh = 28 * u, bw = Math.max(...lines.map((x) => ctx.measureText(x).width)) + 36 * u, bh = lines.length * lh + 28 * u;
    const bx = left ? w * 0.06 : w * 0.94 - bw, by = h * 0.12;
    ctx.save();
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + bw / 2), -(by + bh / 2));
    ctx.fillStyle = l.style === "shout" ? "#fff3c4" : "#ffffff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, l.style === "thought" ? bh / 2 : 14 * u);
    ctx.fill(); ctx.stroke();
    // tail
    const tx = left ? bx + bw * 0.3 : bx + bw * 0.7;
    ctx.beginPath();
    ctx.moveTo(tx - 14 * u, by + bh - 2); ctx.lineTo(tx + (left ? 20 : -20) * u, by + bh + 34 * u); ctx.lineTo(tx + 14 * u, by + bh - 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111";
    lines.forEach((x, i) => ctx.fillText(x, bx + 18 * u, by + 14 * u + lh * (i + 0.5)));
    const who = s.cast[l.speaker]?.name;
    if (who) { ctx.font = `bold ${13 * u}px 'Space Mono', monospace`; ctx.fillStyle = "#f7931a"; ctx.fillText(who.toUpperCase(), bx + 18 * u, by - 10 * u); }
    ctx.restore();
  }
  if (s.sfx && local > 0.3 && local < 1.6) {
    ctx.save();
    ctx.translate(w * 0.5, h * 0.7);
    ctx.rotate(-0.15);
    ctx.scale(1 + (1.6 - local) * 0.3, 1 + (1.6 - local) * 0.3);
    ctx.font = `900 ${64 * u}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 8 * u;
    ctx.strokeStyle = "#111";
    ctx.strokeText(s.sfx, 0, 0);
    ctx.fillStyle = "#f7931a";
    ctx.fillText(s.sfx, 0, 0);
    ctx.restore();
  }
  ctx.font = `${12 * u}px 'Space Mono', monospace`;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${s.block}.BITMAP · SCENE ${index + 1}/${ep.scenes.length}`, w - 12 * u, h - 16 * u);
}

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
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const total = useMemo(() => episodeLength(episode), [episode]);
  const timeRef = useRef(0);
  timeRef.current = time;

  const load = (e: ToonEpisode) => { setEpisode(e); setScript(JSON.stringify(e, null, 2)); setTime(0); setScriptError(null); };

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) / 1000;
      last = now;
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
    if (ctx) drawOverlay(ctx, c.width, c.height, episode, time);
  }, [episode, time]);

  const record = () => {
    const gl = stageRef.current?.querySelector("canvas");
    if (!gl || typeof MediaRecorder === "undefined") return setNote("VIDEO RECORDING IS NOT SUPPORTED IN THIS BROWSER.");
    const out = document.createElement("canvas");
    out.width = gl.width; out.height = gl.height;
    const ctx = out.getContext("2d")!;
    const over = document.createElement("canvas");
    over.width = gl.width; over.height = gl.height;
    const octx = over.getContext("2d")!;
    const stream = out.captureStream(30);
    const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    let raf = 0;
    const paint = () => {
      ctx.drawImage(gl, 0, 0);
      drawOverlay(octx, over.width, over.height, episode, timeRef.current);
      ctx.drawImage(over, 0, 0);
      if (timeRef.current >= total) { rec.stop(); return; }
      raf = requestAnimationFrame(paint);
    };
    rec.onstop = () => {
      cancelAnimationFrame(raf);
      setRecording(false);
      const blob = new Blob(chunks, { type: type || "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${episode.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setNote("EPISODE SAVED TO YOUR DOWNLOADS.");
    };
    setNote(null);
    setTime(0);
    timeRef.current = 0;
    setRecording(true);
    setPlaying(true);
    rec.start(500);
    raf = requestAnimationFrame(paint);
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
            <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
              <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING STAGE…</div>}>
                <ToonStage3D episode={episode} time={time} />
              </Suspense>
            </ClientOnly>
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
            <button className="btn-term" disabled={recording} onClick={() => { if (time >= total) setTime(0); setPlaying((p) => !p); }}>[ {playing ? "PAUSE" : "▶ PLAY"} ]</button>
            <button className="btn-term-ghost" disabled={recording} onClick={() => { setPlaying(false); setTime(0); }}>[ ⏮ REWIND ]</button>
            <button className="btn-term" disabled={recording} onClick={record}>[ {recording ? "● RECORDING…" : "⏺ RECORD EPISODE"} ]</button>
            <input type="range" min={0} max={total} step={0.05} value={time} disabled={recording}
              onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} className="min-w-40 flex-1" aria-label="Timeline" />
            <span className="text-muted-foreground">{time.toFixed(1)}s / {total.toFixed(0)}s</span>
          </div>
          {note && <p className="mt-2 font-mono text-[11px] text-signal">&gt; {note}</p>}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="label text-signal">EPISODE GENERATOR</div>
            <div className="mt-3 flex gap-2 font-mono text-xs">
              <input value={hero} onChange={(e) => setHero(e.target.value.replace(/\D/g, ""))} aria-label="Hero BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Hero block" />
              <input value={rival} onChange={(e) => setRival(e.target.value.replace(/\D/g, ""))} aria-label="Rival BITMAP" className="w-full border border-border bg-background px-2 py-1" placeholder="Rival block" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-term" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0))}>[ WRITE EPISODE ]</button>
              <button className="btn-term-ghost" onClick={() => load(generateEpisode(Number(hero) || 0, Number(rival) || 0, Math.floor(Math.random() * 1e9)))}>[ NEW TAKE ]</button>
              <button className="btn-term-ghost" onClick={() => load({ ...episode, aspect: vertical ? "16:9" : "9:16" })}>[ {vertical ? "16:9 TV" : "9:16 REEL"} ]</button>
            </div>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="label text-signal">SCRIPT (JSON)</div>
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
