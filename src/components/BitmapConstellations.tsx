import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * BitmapConstellations — ambient background layer for the home hero.
 *
 * A field of tiny bitmap squares. Constellations of squares held by one
 * address light up and run the full life cycle:
 *   CLAIMED -> BUILT ON -> EARNING -> LEASED / SOLD
 * Rarer constellations are brighter, larger and arrive alone; common ones can
 * appear up to three at a time. In parallel, a second holder (a different
 * shade of Bitcoin orange) fills a 9x9 block cell by cell and the whole square
 * flashes the moment it is closed.
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

type Block = {
  origin: Cell;
  born: number;
  life: number;
  order: number[];
};

const CELL = 9; // px per bitmap square (including gap)
const DOT = 5; // painted size of a square
const BLOCK = 9; // a full 9x9 square of land

const SHADE_A = "oklch(0.74 0.17 56)"; // core bitcoin orange
const SHADE_B = "oklch(0.85 0.13 78)"; // second holder, lighter shade
const SHADE_MONEY = "oklch(0.9 0.12 92)";

const RARITY = [
  { size: [3, 5], life: 9000, alpha: 0.55, max: 3 },
  { size: [5, 8], life: 11000, alpha: 0.8, max: 2 },
  { size: [8, 13], life: 13000, alpha: 1, max: 1 },
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
  let x = 2 + Math.floor(Math.random() * Math.max(1, cols - 4));
  let y = 3 + Math.floor(Math.random() * Math.max(1, rows - 6));
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push({ x, y });
    }
    const jump = Math.random() < 0.28 ? 3 : 1;
    x = Math.min(cols - 1, Math.max(0, x + (Math.floor(Math.random() * 3) - 1) * jump));
    y = Math.min(rows - 2, Math.max(1, y + (Math.floor(Math.random() * 3) - 1) * jump));
  }
  return {
    cells,
    rarity,
    born: now,
    life: spec.life,
    exit: Math.random() < 0.5 ? "LEASED" : "SOLD",
    builds: Math.max(1, Math.round(cells.length * 0.6)),
  };
}

function makeBlock(cols: number, rows: number, now: number): Block {
  const order = Array.from({ length: BLOCK * BLOCK }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return {
    origin: {
      x: 1 + Math.floor(Math.random() * Math.max(1, cols - BLOCK - 2)),
      y: 2 + Math.floor(Math.random() * Math.max(1, rows - BLOCK - 4)),
    },
    born: now,
    life: 12000,
    order,
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
    let block: Block | null = null;
    let raf = 0;
    let nextSpawn = 0;
    let nextBlock = 2500;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      cols = Math.max(1, Math.floor(rect.width / CELL));
      rows = Math.max(1, Math.floor(rect.height / CELL));
      live = [];
      block = null;
      nextSpawn = 0;
      nextBlock = 2500;
    }

    function caption(text: string, cx: number, cy: number, alpha: number, color: string) {
      if (!text) return;
      ctx!.globalAlpha = alpha * 0.9;
      ctx!.fillStyle = color;
      ctx!.font = "9px ui-monospace, SFMono-Regular, monospace";
      ctx!.fillText(text, cx, cy);
    }

    function drawConstellation(c: Constellation, now: number) {
      const spec = RARITY[c.rarity];
      const t = (now - c.born) / c.life;
      const env = t < 0.12 ? t / 0.12 : t > 0.86 ? (1 - t) / 0.14 : 1;
      const alpha = Math.max(0, Math.min(1, env)) * spec.alpha;
      const size = DOT + c.rarity;
      const phaseIndex = PHASES.findIndex((p) => t <= p.until);
      const phase = Math.max(0, phaseIndex);
      const shade = phase >= 3 ? SHADE_B : SHADE_A;

      // links between the holder's squares
      ctx!.strokeStyle = shade;
      ctx!.globalAlpha = alpha * 0.3;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 1; i < c.cells.length; i++) {
        const a = c.cells[i - 1]!;
        const b = c.cells[i]!;
        ctx!.moveTo(a.x * CELL + size / 2, a.y * CELL + size / 2);
        ctx!.lineTo(b.x * CELL + size / 2, b.y * CELL + size / 2);
      }
      ctx!.stroke();

      // the land itself
      ctx!.fillStyle = shade;
      for (let i = 0; i < c.cells.length; i++) {
        const cell = c.cells[i]!;
        const twinkle = reduced ? 1 : 0.72 + 0.28 * Math.sin(now / 420 + i * 1.7);
        ctx!.globalAlpha = alpha * twinkle;
        ctx!.shadowColor = shade;
        ctx!.shadowBlur = 6 + c.rarity * 5;
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
          const h = (2 + (i % 3) * 2) * grow;
          ctx!.fillRect(cell.x * CELL + 1, cell.y * CELL - h, size - 2, h);
        }
      }

      // 03 — attention and value rise off the builds
      if (phase >= 2 && !reduced) {
        ctx!.fillStyle = SHADE_MONEY;
        ctx!.font = "8px ui-monospace, SFMono-Regular, monospace";
        for (let i = 0; i < c.builds; i++) {
          const cell = c.cells[i]!;
          const p = ((now / 1400 + i * 0.37) % 1);
          ctx!.globalAlpha = alpha * (1 - p) * 0.9;
          ctx!.fillText("$", cell.x * CELL, cell.y * CELL - 6 - p * 14);
        }
        // pulse ring of attention around the group
        const cx = c.cells.reduce((s, v) => s + v.x, 0) / c.cells.length;
        const cy = c.cells.reduce((s, v) => s + v.y, 0) / c.cells.length;
        const pulse = (now / 1600) % 1;
        ctx!.globalAlpha = alpha * (1 - pulse) * 0.35;
        ctx!.strokeStyle = SHADE_A;
        ctx!.beginPath();
        ctx!.arc(cx * CELL, cy * CELL, 10 + pulse * 34, 0, Math.PI * 2);
        ctx!.stroke();
      }

      const first = c.cells[0]!;
      const label = phase >= 3 ? c.exit : PHASES[phase]!.label;
      caption(label, first.x * CELL, first.y * CELL - 12, alpha, phase >= 3 ? SHADE_B : SHADE_A);
    }

    function drawBlock(b: Block, now: number) {
      const t = (now - b.born) / b.life;
      const fillT = Math.min(1, t / 0.72);
      const filled = Math.floor(fillT * b.order.length);
      const complete = filled >= b.order.length;
      const out = t > 0.9 ? (1 - t) / 0.1 : 1;
      const alpha = Math.max(0, Math.min(1, out));
      const flash = complete && !reduced ? 0.6 + 0.4 * Math.sin(now / 140) : 1;

      const taken = new Set(b.order.slice(0, filled));
      ctx!.fillStyle = SHADE_B;
      for (let i = 0; i < b.order.length; i++) {
        if (!taken.has(i)) continue;
        const gx = b.origin.x + (i % BLOCK);
        const gy = b.origin.y + Math.floor(i / BLOCK);
        ctx!.globalAlpha = alpha * (complete ? flash : 0.85);
        ctx!.shadowColor = SHADE_B;
        ctx!.shadowBlur = complete ? 10 : 4;
        ctx!.fillRect(gx * CELL, gy * CELL, DOT, DOT);
      }
      ctx!.shadowBlur = 0;

      // outline snaps closed when the 9x9 square is complete
      ctx!.globalAlpha = alpha * (complete ? flash : 0.25);
      ctx!.strokeStyle = SHADE_B;
      ctx!.lineWidth = complete ? 1.5 : 1;
      ctx!.strokeRect(
        b.origin.x * CELL - 2,
        b.origin.y * CELL - 2,
        BLOCK * CELL + 2,
        BLOCK * CELL + 2,
      );

      caption(
        complete ? "9x9 SQUARE CLOSED" : `ASSEMBLING ${filled}/${b.order.length}`,
        b.origin.x * CELL - 2,
        b.origin.y * CELL - 7,
        alpha,
        SHADE_B,
      );
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
        if (live.length < 3) {
          const candidate = makeConstellation(cols, rows, now);
          const spec = RARITY[candidate.rarity];
          const sameOrRarer = live.filter((c) => c.rarity >= candidate.rarity).length;
          const rarestLive = live.some((c) => c.rarity === 2);
          if (!rarestLive && sameOrRarer < spec.max) live.push(candidate);
        }
        nextSpawn = now + 1400 + Math.random() * 2600;
      }
      if (!block && now >= nextBlock && cols > BLOCK + 3 && rows > BLOCK + 5) {
        block = makeBlock(cols, rows, now);
      }

      live = live.filter((c) => now - c.born < c.life);
      if (block && now - block.born >= block.life) {
        block = null;
        nextBlock = now + 6000 + Math.random() * 6000;
      }

      for (const c of live) drawConstellation(c, now);
      if (block) drawBlock(block, now);

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
