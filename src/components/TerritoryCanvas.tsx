import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { blockSizeMapQuery } from "@/lib/block-bytes";

export type Parcel = { index: number; size: number; x: number; y: number };

const PALETTE = ["#ffb45a", "#f7931a", "#e6810e", "#c96d08", "#a95a06"];

/** shelf-pack every transaction as a square sized by its real vbyte class */
function shelfPack(classes: number[], maxWidth: number) {
  const parcels: Parcel[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 1;

  classes.forEach((size, index) => {
    const s = Math.max(1, Math.min(5, size));
    if (cursorX + s > maxWidth) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 1;
    }
    parcels.push({ index, size: s, x: cursorX, y: cursorY });
    cursorX += s;
    rowHeight = Math.max(rowHeight, s);
  });

  const extentX = parcels.reduce((m, p) => Math.max(m, p.x + p.size), 1);
  const extentY = parcels.reduce((m, p) => Math.max(m, p.y + p.size), 1);
  return { parcels, extentX, extentY };
}

export function packParcels(classes: number[]) {
  const area = classes.reduce((sum, c) => sum + Math.max(1, Math.min(5, c)) ** 2, 0);
  const base = Math.max(8, Math.ceil(Math.sqrt(area)));
  // widen the shelf until the packed block is no taller than it is wide (square territory)
  let best = shelfPack(classes, base);
  for (let i = 0; i < 24 && best.extentY > best.extentX; i += 1) {
    best = shelfPack(classes, Math.ceil(base * (1 + (i + 1) * 0.12)));
  }
  return { parcels: best.parcels, grid: Math.max(best.extentX, best.extentY) };
}


export function TerritoryCanvas({
  height,
  className,
  hideTitle = false,
}: {
  height: number;
  className?: string;
  hideTitle?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<Parcel | null>(null);
  const { data, isError } = useQuery(blockSizeMapQuery(height));

  const packed = useMemo(() => (data?.classes?.length ? packParcels(data.classes) : null), [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !packed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 576;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, size, size);

    const glow = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
    glow.addColorStop(0, "rgba(247,147,26,.08)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const unit = size / packed.grid;
    for (const parcel of packed.parcels) {
      const x = parcel.x * unit;
      const y = parcel.y * unit;
      const w = parcel.size * unit;
      ctx.fillStyle = PALETTE[parcel.index % PALETTE.length] ?? "#f7931a";
      ctx.fillRect(x + 0.8, y + 0.8, Math.max(1, w - 1.6), Math.max(1, w - 1.6));
      if (w > 7) {
        ctx.strokeStyle = "rgba(0,0,0,.46)";
        ctx.lineWidth = 0.7;
        ctx.strokeRect(x + 0.8, y + 0.8, w - 1.6, w - 1.6);
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,.13)";
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(247,147,26,.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    if (hover) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(hover.x * unit + 0.4, hover.y * unit + 0.4, hover.size * unit - 0.8, hover.size * unit - 0.8);
    }
  }, [packed, hover]);

  if (!packed) {
    return (
      <div
        className={`flex aspect-square w-full items-center justify-center border border-border bg-background font-mono text-[10px] text-muted-foreground ${className ?? ""}`}
        role="img"
        aria-label={`On-chain transaction parcels for block ${height}`}
      >
        {isError ? "INDEX BUSY" : "SYNC"}
      </div>
    );
  }

  const onMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = ((event.clientX - rect.left) / rect.width) * packed.grid;
    const gy = ((event.clientY - rect.top) / rect.height) * packed.grid;
    const found =
      packed.parcels.find((p) => gx >= p.x && gx < p.x + p.size && gy >= p.y && gy < p.y + p.size) ?? null;
    setHover(found);
  };

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {hideTitle ? null : (
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>TERRITORY // TX PARCELS</span>
          <span>{packed.parcels.length.toLocaleString("en-US")} PARCELS</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="aspect-square w-full border border-primary/40 bg-background [image-rendering:pixelated]"
        role="img"
        aria-label={`Block ${height} rendered as ${packed.parcels.length} transaction parcels`}
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {hover
          ? `TX #${hover.index + 1} · SIZE CLASS ${hover.size}/5 · PLOT ${hover.x},${hover.y}`
          : "HOVER A PARCEL TO INSPECT ITS TRANSACTION"}
      </div>
    </div>
  );
}
