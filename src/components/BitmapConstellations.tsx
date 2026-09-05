import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * BitmapConstellations — ambient background layer for the home hero.
 *
 * A field of tiny bitmap squares. Constellations of squares held by one
 * address light up and run the full life cycle:
 *   CLAIMED -> WATCHED -> BUILT ON -> EARNING -> LEASED / SOLD
 * People and AI agents gather around a lit constellation, watch it, then start
 * building on it. Rarer constellations are brighter, larger and arrive alone;
 * common ones can appear up to three at a time. All constellations share the
 * same Bitcoin orange shade.
 */

type Rarity = 0 | 1 | 2;
type Cell = { x: number; y: number };
type Watcher = { kind: "AI" | "HUMAN"; angle: number; radius: number; speed: number; cell: number };

type Constellation = {
  cells: Cell[];
  rarity: Rarity;
  born: number;
  life: number;
  /** which exit the story takes */
  exit: "LEASED" | "SOLD";
  /** how many of the cells get a build on top */
  builds: number;
  watchers: Watcher[];
};

const CELL = 16; // px per bitmap square (including gap)
const DOT = 11; // painted size of a lit square
const FIELD_DOT = 5; // painted size of an unlit (gray) square

const SHADE = "oklch(0.72 0.169 55)"; // core bitcoin orange
const SHADE_MONEY = "oklch(0.9 0.12 92)";

const RARITY = [
  { size: [8, 14], life: 26000, alpha: 0.55, max: 3 },
  { size: [14, 22], life: 32000, alpha: 0.8, max: 2 },
  { size: [22, 34], life: 40000, alpha: 1, max: 1 },
] as const;

/** life-cycle chapters as fractions of a constellation's life */
const PHASES = [
  { until: 0.2, label: "CLAIMED" },
  { until: 0.42, label: "WATCHED" },
  { until: 0.62, label: "BUILT ON" },
  { until: 0.82, label: "EARNING" },
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
  const builds = Math.max(1, Math.round(cells.length * 0.55));
  const watcherCount = 2 + Math.floor(Math.random() * 3);
  const watchers: Watcher[] = Array.from({ length: watcherCount }, (_, i) => ({
    kind: i % 2 === 0 ? "AI" : "HUMAN",
    angle: Math.random() * Math.PI * 2,
    radius: 26 + Math.random() * 26 + rarity * 6,
    speed: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.05),
    cell: Math.floor(Math.random() * builds),
  }));
  return {
    cells,
    rarity,
    born: now,
    life: spec.life,
    exit: Math.random() < 0.5 ? "LEASED" : "SOLD",
    builds,
    watchers,
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

    /** centre of a grid cell — lit squares sit exactly over the grey field squares */
    function cx(x: number) {
      return x * CELL + CELL / 2;
    }
    function cy(y: number) {
      return y * CELL + CELL / 2;
    }

    function caption(text: string, x: number, y: number, alpha: number, color: string) {
      if (!text) return;
      ctx!.globalAlpha = alpha * 0.9;
      ctx!.fillStyle = color;
      ctx!.font = "11px ui-monospace, SFMono-Regular, monospace";
      ctx!.fillText(text, x, y);
    }

    function drawWatchers(c: Constellation, now: number, alpha: number, phase: number) {
      const gx = c.cells.reduce((s, v) => s + v.x, 0) / c.cells.length;
      const gy = c.cells.reduce((s, v) => s + v.y, 0) / c.cells.length;
      const building = phase >= 2;
      for (let i = 0; i < c.watchers.length; i++) {
        const w = c.watchers[i]!;
        let px: number;
        let py: number;
        if (building) {
          // they move in and work on one of the builds
          const target = c.cells[w.cell % c.cells.length]!;
          const bob = reduced ? 0 : Math.sin(now / 900 + i) * 2;
          px = cx(target.x) + (i % 2 === 0 ? -9 : 9);
          py = cy(target.y) - 10 + bob;
        } else {
          const a = w.angle + (reduced ? 0 : (now / 1000) * w.speed);
          px = cx(gx) + Math.cos(a) * w.radius;
          py = cy(gy) + Math.sin(a) * w.radius * 0.6;
        }

        ctx!.globalAlpha = alpha * 0.85;
        if (w.kind === "AI") {
          ctx!.strokeStyle = SHADE;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.moveTo(px, py - 4);
          ctx!.lineTo(px + 3.6, py + 3);
          ctx!.lineTo(px - 3.6, py + 3);
          ctx!.closePath();
          ctx!.stroke();
        } else {
          ctx!.strokeStyle = foreground;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx!.stroke();
        }

        // sight line while watching, tool spark while building
        ctx!.globalAlpha = alpha * (building ? 0.5 : 0.22);
        ctx!.strokeStyle = w.kind === "AI" ? SHADE : foreground;
        ctx!.beginPath();
        ctx!.moveTo(px, py);
        if (building) {
          const target = c.cells[w.cell % c.cells.length]!;
          ctx!.lineTo(cx(target.x), cy(target.y) - 4);
        } else {
          ctx!.lineTo(cx(gx), cy(gy));
        }
        ctx!.stroke();
      }

      if (c.watchers.length) {
        const ai = c.watchers.filter((w) => w.kind === "AI").length;
        const people = c.watchers.length - ai;
        caption(
          building ? `${ai} AI · ${people} PEOPLE BUILDING` : `${ai} AI · ${people} PEOPLE WATCHING`,
          cx(gx) - 40,
          cy(gy) + 34,
          alpha * 0.8,
          building ? SHADE : foreground,
        );
      }
    }

    function drawConstellation(c: Constellation, now: number) {
      const spec = RARITY[c.rarity];
      const t = (now - c.born) / c.life;
      const env = t < 0.12 ? t / 0.12 : t > 0.86 ? (1 - t) / 0.14 : 1;
      const alpha = Math.max(0, Math.min(1, env)) * spec.alpha;
      const size = DOT + c.rarity * 2;
      const half = size / 2;
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
        ctx!.moveTo(cx(a.x), cy(a.y));
        ctx!.lineTo(cx(b.x), cy(b.y));
      }
      ctx!.stroke();

      // the land itself — drawn on top of the grey field squares
      ctx!.fillStyle = SHADE;
      for (let i = 0; i < c.cells.length; i++) {
        const cell = c.cells[i]!;
        const twinkle = reduced ? 1 : 0.78 + 0.22 * Math.sin(now / 1400 + i * 1.7);
        ctx!.globalAlpha = alpha * twinkle;
        ctx!.shadowColor = SHADE;
        ctx!.shadowBlur = 8 + c.rarity * 7;
        ctx!.fillRect(cx(cell.x) - half, cy(cell.y) - half, size, size);
      }
      ctx!.shadowBlur = 0;

      // 02 / 03 — watchers gather, then start building
      if (phase >= 1) drawWatchers(c, now, alpha, phase);

      // 03 — something gets built on the land
      if (phase >= 2) {
        const grow = Math.min(1, (t - 0.42) / 0.16);
        ctx!.globalAlpha = alpha * 0.95;
        ctx!.fillStyle = foreground;
        for (let i = 0; i < c.builds; i++) {
          const cell = c.cells[i]!;
          const h = (4 + (i % 3) * 4) * grow;
          ctx!.fillRect(cx(cell.x) - half + 1, cy(cell.y) - half - h, size - 2, h);
        }
      }

      // 04 — attention and value rise off the builds
      if (phase >= 3 && !reduced) {
        ctx!.fillStyle = SHADE_MONEY;
        ctx!.font = "11px ui-monospace, SFMono-Regular, monospace";
        for (let i = 0; i < c.builds; i++) {
          const cell = c.cells[i]!;
          const p = (now / 3200 + i * 0.37) % 1;
          ctx!.globalAlpha = alpha * (1 - p) * 0.9;
          ctx!.fillText("$", cx(cell.x) - half, cy(cell.y) - half - 8 - p * 18);
        }
        // pulse ring of attention around the group
        const gx = c.cells.reduce((s, v) => s + v.x, 0) / c.cells.length;
        const gy = c.cells.reduce((s, v) => s + v.y, 0) / c.cells.length;
        const pulse = (now / 3600) % 1;
        ctx!.globalAlpha = alpha * (1 - pulse) * 0.35;
        ctx!.strokeStyle = SHADE;
        ctx!.beginPath();
        ctx!.arc(cx(gx), cy(gy), 16 + pulse * 60, 0, Math.PI * 2);
        ctx!.stroke();
      }

      const first = c.cells[0]!;
      const label = phase >= 4 ? c.exit : PHASES[phase]!.label;
      caption(label, cx(first.x) - half, cy(first.y) - half - 16, alpha, SHADE);
    }

    function paint(now: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // dim field of unlit bitmaps
      ctx!.fillStyle = foreground;
      ctx!.globalAlpha = 0.05;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          ctx!.fillRect(cx(x) - FIELD_DOT / 2, cy(y) - FIELD_DOT / 2, FIELD_DOT, FIELD_DOT);
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
        nextSpawn = now + 4000 + Math.random() * 6000;
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
