import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { bitmapsQuery } from "@/lib/bitmap-queries";
import { STATUS_LABEL, formatBtc, type Bitmap } from "@/lib/bitmap";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Bitmap Map — The Bitcoin Land Grid" },
      {
        name: "description",
        content: "Pan and zoom the Bitmap universe. Every square is a Bitcoin block of digital land.",
      },
      { property: "og:title", content: "Bitmap Map — The Bitcoin Land Grid" },
      {
        property: "og:description",
        content: "Pan and zoom the Bitmap universe. Every square is a Bitcoin block of digital land.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bitmapsQuery(200)),
  component: MapPage,
});

const CELL = 96;
const COLS = 20;
const ROWS = 20;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4;

function MapPage() {
  const { data: bitmaps } = useSuspenseQuery(bitmapsQuery(200));
  const byBlock = useMemo(() => {
    const m = new Map<number, Bitmap>();
    bitmaps.forEach((b) => m.set(b.block_height, b));
    return m;
  }, [bitmaps]);
  const topBlock = useMemo(
    () => bitmaps.reduce((max, b) => Math.max(max, b.block_height), 840040),
    [bitmaps],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const zoomAt = useCallback((px: number, py: number, next: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const k = clamped / z;
    setZoom(clamped);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      stateRef.current.zoom * Math.exp(-dy * 0.0015),
    );
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const cells = useMemo(() => {
    const out: { block: number; col: number; row: number }[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        out.push({ block: topBlock - (row * COLS + col), col, row });
      }
    }
    return out;
  }, [topBlock]);

  const selectedBitmap = selected !== null ? byBlock.get(selected) : undefined;

  function zoomButton(dir: 1 | -1) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, stateRef.current.zoom * (dir === 1 ? 1.3 : 1 / 1.3));
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">MAP</h1>
      <p className="label mt-3">THE BITMAP UNIVERSE · DRAG TO PAN · SCROLL TO ZOOM</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative border border-border">
          <div
            ref={containerRef}
            className="relative h-[560px] cursor-grab overflow-hidden bg-background active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              dragRef.current = {
                x: e.clientX,
                y: e.clientY,
                ox: offset.x,
                oy: offset.y,
              };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerLeave={() => {
              dragRef.current = null;
            }}
          >
            <div className="pointer-events-none absolute inset-0 dot-bg" />
            <div
              className="absolute left-0 top-0"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                width: COLS * CELL,
                height: ROWS * CELL,
              }}
            >
              {cells.map(({ block, col, row }) => {
                const bm = byBlock.get(block);
                const isSelected = selected === block;
                return (
                  <button
                    key={block}
                    onClick={() => setSelected(block)}
                    className={`absolute border text-left transition-colors ${
                      isSelected
                        ? "border-foreground bg-secondary"
                        : "border-border hover:border-foreground"
                    }`}
                    style={{
                      left: col * CELL,
                      top: row * CELL,
                      width: CELL,
                      height: CELL,
                    }}
                  >
                    <span className="absolute left-1 top-1 font-mono text-[9px] text-muted-foreground">
                      [{block}]
                    </span>
                    {bm && (
                      <span className="absolute inset-3 top-5 block">
                        <BitmapPixelMap blockHeight={block} animate={false} />
                      </span>
                    )}
                    {bm?.status === "for_sale" && (
                      <span className="absolute bottom-1 right-1 size-1.5 bg-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="label">ZOOM {(zoom * 100).toFixed(0)}%</span>
            <div className="flex gap-2">
              <button className="btn-term-ghost !px-3 !py-1" onClick={() => zoomButton(-1)}>
                −
              </button>
              <button className="btn-term-ghost !px-3 !py-1" onClick={() => zoomButton(1)}>
                +
              </button>
              <button
                className="btn-term-ghost !px-3 !py-1"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                RESET
              </button>
            </div>
          </div>
        </div>

        <aside className="border border-border">
          <div className="border-b border-border px-4 py-3">
            <span className="label">PARCEL INSPECTOR</span>
          </div>
          {selected === null ? (
            <div className="p-4 font-mono text-xs text-muted-foreground">
              &gt; SELECT A PARCEL<span className="blink">_</span>
            </div>
          ) : (
            <div className="p-4">
              <div className="display text-lg">BITMAP #{selected}</div>
              <dl className="mt-4 space-y-2 text-[11px]">
                <Row k="OWNER" v={selectedBitmap?.owner_address ?? "—"} />
                <Row
                  k="STATUS"
                  v={
                    selectedBitmap
                      ? (STATUS_LABEL[selectedBitmap.status] ?? selectedBitmap.status)
                      : "NOT INDEXED"
                  }
                />
                <Row k="PRICE" v={formatBtc(selectedBitmap?.price_btc ?? null)} />
              </dl>
              <div className="mt-4 border border-border p-3">
                <BitmapPixelMap blockHeight={selected} animate={false} />
              </div>
              {selectedBitmap ? (
                <Link
                  to="/bitmap/$block"
                  params={{ block: String(selected) }}
                  className="btn-term mt-4 w-full"
                >
                  [ VIEW BITMAP ]
                </Link>
              ) : (
                <div className="label mt-4">OUTSIDE DEMO REGISTRY RANGE</div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label">{k}</dt>
      <dd className="truncate font-mono text-foreground">{v}</dd>
    </div>
  );
}
