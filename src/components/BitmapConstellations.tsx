import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * BitmapConstellations — ambient background layer for the home hero.
 * A field of tiny bitmap squares; every so often a "constellation" of squares
 * lights up together, standing for a group of BITMAPs held by one address.
 * Rarer constellations are brighter, larger and arrive alone; common ones can
 * appear up to three at a time.
 */

type Rarity = 0 | 1 | 2;

type Constellation = {
  cells: { x: number; y: number }[];
  rarity: Rarity;
  born: number;
  life: number;
};

const CELL = 9; // px per bitmap square (including gap)
const DOT = 5; // painted size of a square

const RARITY = [
  { size: [3, 5], life: 4200, alpha: 0.55, max: 3 },
  { size: [5, 8], life: 5600, alpha: 0.8, max: 2 },
  { size: [8, 13], life: 7200, alpha: 1, max: 1 },
] as const;

function pickRarity(): Rarity {
  const r = Math.random();
  if (r < 0.62) return 0;
  if (r < 0.9) return 1;
  return 2;
}

function makeConstellation(cols: number, rows: number, now: number): Constellation {
  const rarity = pickRarity();
  const spec = RARITY[rarity];
  const count = spec.size[0] + Math.floor(Math.random() * (spec.size[1] - spec.size[0] + 1));
  const cells: { x: number; y: number }[] = [];
  let x = 2 + Math.floor(Math.random() * Math.max(1, cols - 4));
  let y = 2 + Math.floor(Math.random() * Math.max(1, rows - 4));
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push({ x, y });
    }
    // random walk with occasional jumps, so the group reads as a constellation
    const jump = Math.random() < 0.28 ? 3 : 1;
    x = Math.min(cols - 1, Math.max(0, x + (Math.floor(Math.random() * 3) - 1) * jump));
    y = Math.min(rows - 1, Math.max(0, y + (Math.floor(Math.random() * 3) - 1) * jump));
  }
  return { cells, rarity, born: now, life: spec.life };
}

export function BitmapConstellations({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const bitcoin = styles.getPropertyValue("--bitcoin").trim() || "oklch(0.72 0.169 55)";
    const foreground = styles.getPropertyValue("--foreground").trim() || "oklch(0.98 0 0)";

    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let live: Constellation[] = [];
    let raf = 0;
    let nextSpawn = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      cols = Math.max(1, Math.floor(rect.width / CELL));
      rows = Math.max(1, Math.floor(rect.height / CELL));
      live = [];
      nextSpawn = 0;
    }

    function paint(now: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // dim field of unlit bitmaps
      ctx!.fillStyle = foreground;
      ctx!.globalAlpha = 0.05;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          ctx!.fillRect(cx * CELL, cy * CELL, DOT * 0.6, DOT * 0.6);
        }
      }

      if (now >= nextSpawn) {
        const cap = 3;
        if (live.length < cap) {
          const candidate = makeConstellation(cols, rows, now);
          const spec = RARITY[candidate.rarity];
          const sameOrRarer = live.filter((c) => c.rarity >= candidate.rarity).length;
          const rarestLive = live.some((c) => c.rarity === 2);
          if (!rarestLive && sameOrRarer < spec.max) live.push(candidate);
        }
        nextSpawn = now + 900 + Math.random() * 2200;
      }

      live = live.filter((c) => now - c.born < c.life);

      for (const c of live) {
        const spec = RARITY[c.rarity];
        const t = (now - c.born) / c.life;
        // ease in, hold, ease out
        const env = t < 0.18 ? t / 0.18 : t > 0.72 ? (1 - t) / 0.28 : 1;
        const alpha = Math.max(0, Math.min(1, env)) * spec.alpha;
        const size = DOT + c.rarity;

        // faint links between neighbouring squares of the same holder
        ctx!.strokeStyle = bitcoin;
        ctx!.globalAlpha = alpha * 0.28;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        for (let i = 1; i < c.cells.length; i++) {
          const a = c.cells[i - 1]!;
          const b = c.cells[i]!;
          ctx!.moveTo(a.x * CELL + size / 2, a.y * CELL + size / 2);
          ctx!.lineTo(b.x * CELL + size / 2, b.y * CELL + size / 2);
        }
        ctx!.stroke();

        ctx!.fillStyle = bitcoin;
        for (let i = 0; i < c.cells.length; i++) {
          const cell = c.cells[i]!;
          const twinkle = reduced ? 1 : 0.72 + 0.28 * Math.sin(now / 420 + i * 1.7);
          ctx!.globalAlpha = alpha * twinkle;
          ctx!.shadowColor = bitcoin;
          ctx!.shadowBlur = 6 + c.rarity * 5;
          ctx!.fillRect(cell.x * CELL, cell.y * CELL, size, size);
        }
        ctx!.shadowBlur = 0;
      }

      ctx!.globalAlpha = 1;
      raf = window.requestAnimationFrame(paint);
    }

    resize();
    raf = window.requestAnimationFrame(paint);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    />
  );
}
