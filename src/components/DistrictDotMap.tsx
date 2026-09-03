import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { clubOf } from "@/lib/clubs";

const GRID = 10_000; // 10,000 x 10,000 dots = 100,000,000 districts of land

export type DistrictDotMapProps = {
  /** highest block that exists on chain — dots above it are unmined land */
  tipHeight: number;
  /** heights to mark on the map (e.g. bitmaps you hold) */
  highlight?: number[];
  className?: string;
};

type View = { x: number; y: number; scale: number };

const heightOf = (col: number, row: number) => row * GRID + col;

/**
 * A canvas map of the whole bitmap land: one dot per district, laid out on a
 * 10,000 x 10,000 grid in block order (left-to-right, top-to-bottom). Only the
 * dots inside the viewport are drawn, so panning and zooming stay smooth even
 * though the grid holds 100 million cells.
 */
export function DistrictDotMap({ tipHeight, highlight = [], className }: DistrictDotMapProps) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 0.06 });
  const [hover, setHover] = useState<{ height: number; sx: number; sy: number } | null>(null);
  const [zoomLabel, setZoomLabel] = useState(0.06);

  const highlightSet = useRef<Set<number>>(new Set());
  highlightSet.current = new Set(highlight);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue("--background").trim() || "#000";
    const fg = css.getPropertyValue("--foreground").trim() || "#fff";
    const accent = css.getPropertyValue("--bitcoin").trim() || "#f7931a";
    const border = css.getPropertyValue("--border").trim() || "#333";

    const color = (v: string) => (v.startsWith("oklch") || v.startsWith("#") || v.startsWith("rgb") ? v : `oklch(${v})`);
    ctx.fillStyle = color(bg);
    ctx.fillRect(0, 0, w, h);


    const { x, y, scale } = viewRef.current;
    const colFrom = Math.max(0, Math.floor(-x / scale));
    const rowFrom = Math.max(0, Math.floor(-y / scale));
    const colTo = Math.min(GRID - 1, Math.ceil((-x + w) / scale));
    const rowTo = Math.min(GRID - 1, Math.ceil((-y + h) / scale));

    const dot = Math.max(0.6, scale * 0.7);
    const fgCol = color(fg);
    const accentCol = color(accent);
    const borderCol = color(border);

    // Zoomed far out a single pixel covers many cells, so the mined land is
    // painted as blocks of rows instead of 100M individual rects.
    if (scale < 1.2) {
      const tipRow = Math.floor(tipHeight / GRID);
      const tipCol = tipHeight % GRID;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = borderCol;
      ctx.fillRect(x, y, GRID * scale, GRID * scale);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fgCol;
      if (tipRow > 0) ctx.fillRect(x, y, GRID * scale, tipRow * scale);
      ctx.fillRect(x, y + tipRow * scale, (tipCol + 1) * scale, Math.max(1, scale));
      ctx.globalAlpha = 1;
      ctx.fillStyle = accentCol;
      for (const height of highlightSet.current) {
        if (height > tipHeight) continue;
        const hx = x + (height % GRID) * scale;
        const hy = y + Math.floor(height / GRID) * scale;
        ctx.fillRect(hx, hy, Math.max(2, scale), Math.max(2, scale));
      }
      ctx.globalAlpha = 1;
      return;
    }

    for (let row = rowFrom; row <= rowTo; row++) {
      const sy = y + row * scale;
      for (let col = colFrom; col <= colTo; col++) {
        const height = heightOf(col, row);
        const sx = x + col * scale;
        const isHighlight = highlightSet.current.has(height);
        if (height > tipHeight) {
          ctx.fillStyle = borderCol;
        } else {
          ctx.fillStyle = isHighlight ? accentCol : fgCol;
        }
        ctx.globalAlpha = height > tipHeight ? 0.35 : isHighlight ? 1 : 0.8;
        ctx.fillRect(sx, sy, isHighlight ? Math.max(dot, 2) : dot, isHighlight ? Math.max(dot, 2) : dot);
      }
    }
    ctx.globalAlpha = 1;
  }, [tipHeight]);


  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const clamp = (v: View, w: number, h: number): View => {
    const span = GRID * v.scale;
    const minX = Math.min(0, w - span);
    const minY = Math.min(0, h - span);
    return {
      scale: v.scale,
      x: Math.min(0, Math.max(minX, v.x)),
      y: Math.min(0, Math.max(minY, v.y)),
    };
  };

  const setView = (next: View) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    viewRef.current = clamp(next, wrap.clientWidth, wrap.clientHeight);
    setZoomLabel(viewRef.current.scale);
    draw();
  };

  /** whole 10,000 x 10,000 grid in frame */
  const fitAll = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const scale = Math.min(wrap.clientWidth, wrap.clientHeight) / GRID;
    setView({ scale, x: 0, y: 0 });
  };

  /** frame the mined rows — the districts that actually exist today */
  const fitMined = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || tipHeight <= 0) return;
    const rows = Math.floor(tipHeight / GRID) + 1;
    const scale = Math.min(8, Math.max(0.02, wrap.clientHeight / (rows + 1)));
    viewRef.current = clamp({ scale, x: 0, y: 0 }, wrap.clientWidth, wrap.clientHeight);
    setZoomLabel(scale);
    draw();
  }, [tipHeight, draw]);

  useEffect(() => {
    if (tipHeight > 0) fitMined();
  }, [tipHeight, fitMined]);



  const cellAt = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const { x, y, scale } = viewRef.current;
    const col = Math.floor((clientX - r.left - x) / scale);
    const row = Math.floor((clientY - r.top - y) / scale);
    if (col < 0 || row < 0 || col >= GRID || row >= GRID) return null;
    return { height: heightOf(col, row), sx: clientX - r.left, sy: clientY - r.top };
  };

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="btn-term-ghost" onClick={fitMined}>
          [ FIT MINED LAND ]
        </button>
        <button className="btn-term-ghost" onClick={fitAll}>
          [ FIT FULL GRID ]
        </button>
        <button
          className="btn-term-ghost"
          onClick={() => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const scale = 6;
            setView({
              scale,
              x: wrap.clientWidth / 2 - (tipHeight % GRID) * scale,
              y: wrap.clientHeight / 2 - Math.floor(tipHeight / GRID) * scale,
            });
          }}
        >
          [ GO TO TIP ]
        </button>
      </div>
      <div

        ref={wrapRef}
        className="relative h-[70vh] min-h-[380px] w-full cursor-crosshair overflow-hidden border border-border bg-background"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (d) {
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
            d.x = e.clientX;
            d.y = e.clientY;
            const wrap = wrapRef.current!;
            viewRef.current = clamp(
              { ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy },
              wrap.clientWidth,
              wrap.clientHeight,
            );
            draw();
            setHover(null);
            return;
          }
          const cell = cellAt(e.clientX, e.clientY);
          setHover(cell && cell.height <= tipHeight ? cell : null);
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          dragRef.current = null;
          if (d?.moved) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (cell && cell.height <= tipHeight) {
            navigate({ to: "/bitmap/$block", params: { block: String(cell.height) } });
          }
        }}
        onPointerLeave={() => {
          dragRef.current = null;
          setHover(null);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const wrap = wrapRef.current!;
          const r = wrap.getBoundingClientRect();
          const px = e.clientX - r.left;
          const py = e.clientY - r.top;
          const prev = viewRef.current;
          const factor = Math.exp(-e.deltaY * 0.0015);
          const scale = Math.min(24, Math.max(0.02, prev.scale * factor));
          const k = scale / prev.scale;
          viewRef.current = clamp(
            { scale, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k },
            wrap.clientWidth,
            wrap.clientHeight,
          );
          setZoomLabel(scale);
          draw();
        }}
      >
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {hover ? (
          <div
            data-no-translate
            className="pointer-events-none absolute z-10 -translate-y-full border border-bitcoin bg-background/95 px-2 py-1 font-mono text-[10px]"
            style={{ left: Math.min(hover.sx + 8, (wrapRef.current?.clientWidth ?? 0) - 140), top: hover.sy - 6 }}
          >
            {hover.height}.bitmap · {clubOf(hover.height).short}
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span>DRAG TO PAN · SCROLL TO ZOOM · CLICK A DOT</span>
          <span data-no-translate>×{zoomLabel.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
