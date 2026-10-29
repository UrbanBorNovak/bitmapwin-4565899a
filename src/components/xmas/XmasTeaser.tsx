import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { episodeLength } from "@/lib/toon-script";
import { drawOverlay } from "@/lib/toon-overlay";
import { XMAS_TEASER } from "@/lib/xmas-teaser";

const ToonStage3D = lazy(() => import("@/components/toon/ToonStage3D"));
const TOTAL = episodeLength(XMAS_TEASER);

/** Autoplaying, looping teaser: autumn leaves turn to snow, then the Advent announcement. */
export function XmasTeaser() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = timeRef.current, start = performance.now();
    const tick = () => {
      const next = (t0 + (performance.now() - start) / 1000) % TOTAL;
      timeRef.current = next; setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width)) { c.width = Math.round(r.width); c.height = Math.round(r.height); }
    drawOverlay(ctx, c.width, c.height, XMAS_TEASER, time);
  }, [time]);

  return (
    <section className="border border-border bg-card/60">
      <div className="relative aspect-video overflow-hidden">
        <ClientOnly fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">LOADING…</div>}>
          <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">LOADING…</div>}>
            <ToonStage3D episode={XMAS_TEASER} time={time} />
          </Suspense>
        </ClientOnly>
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <div className="flex items-center gap-3 p-3 text-xs">
        <button className="btn-term" onClick={() => setPlaying((p) => !p)}>[ {playing ? "❚❚ PAUSE" : "▶ PLAY"} ]</button>
        <span className="text-accent">WINTER IS SYNCING · ADVENT TEASER</span>
      </div>
    </section>
  );
}
