import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * BitmapConstellations — ambient background layer for the home hero.
 *
 * A field of tiny bitmap squares. Constellations of squares held by one
 * address light up and run the full life cycle:
 *   CLAIMED -> BUILT ON -> EARNING -> LEASED / SOLD
 * Rarer constellations are brighter, larger and arrive alone; common ones can
 * appear up to three at a time. All constellations share the same Bitcoin
 * orange shade.
 */

type Rarity = 0 | 1 | 2;
type Cell = { x: number; y: number };

type Constellation = {
  cells: Cell[];
  rarity: Rarity;
  born: number;
  life: number;
  /** which exit the story takes */
  exit: "LEASED" | "SOLD";
  /** how many of the cells get a build on top */
  builds: number;
};

const CELL = 14; // px per bitmap square (including gap)
const DOT = 9; // painted size of a square

const SHADE = "oklch(0.72 0.169 55)"; // core bitcoin orange
const SHADE_MONEY = "oklch(0.9 0.12 92)";

const RARITY = [
  { size: [5, 9], life: 10000, alpha: 0.55, max: 3 },
  { size: [9, 16], life: 12000, alpha: 0.8, max: 2 },
  { size: [16, 26], life: 15000, alpha: 1, max: 1 },
] as const;

/** life-cycle chapters as fractions of a constellation's life */
const PHASES = [
  { until: 0.24, label: "CLAIMED" },
  { until: 0.48, label: "BUILT ON" },
  { until: 0.74, label: "EARNING" },
  { until: 1, label: "" }, // filled with the exit label
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
  const cells: Cell[] = [];
  let x = 3 + Math.floor(Math.random() * Math.max(1, cols - 6));
  let y = 4 + Math.floor(Math.random() * Math.max(1, rows - 8));
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push({ x, y });
    }
    const jump = Math.random() < 0.3 ? 4 : 1;
    x = Math.min(cols - 1, Math.max(0, x + (Math.floor(Math.random() * 3) - 1) * jump));
    y = Math.min(rows - 2, Math.max(1, y + (Math.floor(Math.random() * 3) - 1) * jump));
  }
  return {
    cells,
    rarity,
    born: now,
    life: spec.life,
    exit: Math.random() < 0.5 ? "LEASED" : "SOLD",
    builds: Math.max(1, Math.round(cells.length * 0.55)),
  };
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

    function caption(text: string, cx: number, cy: number, alpha: number, color: string) {
      if (!text) return;
      ctx!.globalAlpha = alpha * 0.9;
      ctx!.fillStyle = color;
      ctx!.font = "11px ui-monospace, SFMono-Regular, monospace";
      ctx!.fillText(text, cx, cy);
    }

    function drawConstellation(c: Constellation, now: number) {
      const spec = RARITY[c.rarity];
      const t = (now - c.born) / c.life;
      const env = t < 0.12 ? t / 0.12 : t > 0.86 ? (1 - t) / 0.14 : 1;
      const alpha = Math.max(0, Math.min(1, env)) * spec.alpha;
      const size = DOT + c.rarity * 2;
      const phaseIndex = PHASES.findIndex((p) => t <= p.until);
      const phase = Math.max(0, phaseIndex);

      // links between the holder's squares
      ctx!.strokeStyle = SHADE;
      ctx!.globalAlpha = alpha * 0.35;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      for (let i = 1; i < c.cells.length; i++) {
        const a = c.cells[i - 1]!;
        const b = c.cells[i]!;
        ctx!.moveTo(a.x * CELL + size / 2, a.y * CELL + size / 2);
        ctx!.lineTo(b.x * CELL + size / 2, b.y * CELL + size / 2);
      }
      ctx!.stroke();

      // the land itself
      ctx!.fillStyle = SHADE;
      for (let i = 0; i < c.cells.length; i++) {
        const cell = c.cells[i]!;
        const twinkle = reduced ? 1 : 0.72 + 0.28 * Math.sin(now / 420 + i * 1.7);
        ctx!.globalAlpha = alpha * twinkle;
        ctx!.shadowColor = SHADE;
        ctx!.shadowBlur = 8 + c.rarity * 7;
        ctx!.fillRect(cell.x * CELL, cell.y * CELL, size, size);
      }
      ctx!.shadowBlur = 0;

      // 02 — something gets built on the land
      if (phase >= 1) {
        const grow = Math.min(1, (t - 0.24) / 0.14);
        ctx!.globalAlpha = alpha * 0.95;
        ctx!.fillStyle = foreground;
        for (let i = 0; i < c.builds; i++) {
          const cell = c.cells[i]!;
          const h = (3 + (i % 3) * 3) * grow;
          ctx!.fillRect(cell.x * CELL + 1, cell.y * CELL - h, size - 2, h);
        }
      }

      // 03 — attention and value rise off the builds
      if (phase >= 2 && !reduced) {
        ctx!.fillStyle = SHADE_MONEY;
        ctx!.font = "11px ui-monospace, SFMono-Regular, monospace";
        for (let i = 0; i < c.builds; i++) {
          const cell = c.cells[i]!;
          const p = ((now / 1400 + i * 0.37) % 1);
          ctx!.globalAlpha = alpha * (1 - p) * 0.9;
          ctx!.fillText("$", cell.x * CELL, cell.y * CELL - 8 - p * 18);
        }
        // pulse ring of attention around the group
        const cx = c.cells.reduce((s, v) => s + v.x, 0) / c.cells.length;
        const cy = c.cells.reduce((s, v) => s + v.y, 0) / c.cells.length;
        const pulse = (now / 1600) % 1;
        ctx!.globalAlpha = alpha * (1 - pulse) * 0.35;
        ctx!.strokeStyle = SHADE;
        ctx!.beginPath();
        ctx!.arc(cx * CELL, cy * CELL, 16 + pulse * 52, 0, Math.PI * 2);
        ctx!.stroke();
      }

      const first = c.cells[0]!;
      const label = phase >= 3 ? c.exit : PHASES[phase]!.label;
      caption(label, first.x * CELL, first.y * CELL - 16, alpha, SHADE);
    }

    function paint(now: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // dim field of unlit bitmaps
      ctx!.fillStyle = foreground;
      ctx!.globalAlpha = 0.05;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          ctx!.fillRect(cx * CELL, cy * CELL, DOT * 0.55, DOT * 0.55);
        }
      }

      if (now >= nextSpawn) {
        if (live.length < 3) {
          const candidate = makeConstellation(cols, rows, now);
          const spec = RARITY[candidate.rarity];
          const sameOrRarer = live.filter((c) => c.rarity >= candidate.rarity).length;
          const rarestLive = live.some((c) => c.rarity === 2);
          if (!rarestLive && sameOrRarer < spec.max) live.push(candidate);
        }
        nextSpawn = now + 1600 + Math.random() * 2800;
      }

      live = live.filter((c) => now - c.born < c.life);
      for (const c of live) drawConstellation(c, now);

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
