import { useEffect, useRef } from "react";

/** Lightweight snowfall canvas; pauses for reduced-motion and hidden tabs. */
export function Snowfall({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, t = 0;
    const resize = () => { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const flakes = Array.from({ length: Math.min(140, Math.round(w / 10)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 2.2, s: 0.3 + Math.random() * 0.9, p: Math.random() * 6.28,
    }));
    const color = getComputedStyle(c).color;
    const tick = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      const wind = Math.sin(t * 0.7) * 0.4;
      for (const f of flakes) {
        f.y += f.s * f.r * 0.6;
        f.x += wind + Math.sin(t + f.p) * 0.3;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x > w + 4) f.x = -4; else if (f.x < -4) f.x = w + 4;
        ctx.globalAlpha = 0.25 + f.r / 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [enabled]);
  if (!enabled) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full text-foreground" />;
}
