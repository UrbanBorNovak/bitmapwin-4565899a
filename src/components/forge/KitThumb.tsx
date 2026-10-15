/** Isometric voxel picture of a kit, drawn straight from its blueprint blocks. */
import { useEffect, useRef } from "react";
import { blockColor } from "@/lib/voxel-world";
import { blueprintBlocks, type Blueprint } from "@/lib/forge-blueprints";

export function KitThumb({ bp, upTo, className = "" }: { bp: Blueprint; upTo?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = (c.width = 360), H = (c.height = 220);
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    const all = blueprintBlocks(bp);
    const shown = blueprintBlocks(bp, upTo ?? bp.steps.length);
    if (!all.length) return;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, maxY = 0;
    for (const b of all) { minX = Math.min(minX, b.dx); maxX = Math.max(maxX, b.dx); minZ = Math.min(minZ, b.dz); maxZ = Math.max(maxZ, b.dz); maxY = Math.max(maxY, b.dy); }
    const span = maxX - minX + maxZ - minZ + 2;
    const s = Math.min((W - 20) / span, (H - 20) / (span / 2 + maxY + 2)); // half-width of a tile
    const ox = W / 2 - ((maxX - minX) - (maxZ - minZ)) * s / 2;
    const oy = H - 10 - ((maxX - minX) + (maxZ - minZ) + 2) * s / 2;
    const sorted = [...shown].sort((a, b) => (a.dx + a.dz) - (b.dx + b.dz) || a.dy - b.dy);
    for (const b of sorted) {
      const x = b.dx - minX, z = b.dz - minZ;
      const px = ox + (x - z) * s, py = oy + (x + z) * s / 2 - b.dy * s;
      const col = blockColor(b.k);
      const poly = (pts: number[], fill: string) => { g.beginPath(); g.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!); g.closePath(); g.fillStyle = fill; g.fill(); };
      poly([px, py, px + s, py + s / 2, px, py + s, px - s, py + s / 2], col.top);
      poly([px - s, py + s / 2, px, py + s, px, py + 2 * s, px - s, py + 1.5 * s], col.side);
      g.globalAlpha = 0.75;
      poly([px + s, py + s / 2, px, py + s, px, py + 2 * s, px + s, py + 1.5 * s], col.side);
      g.globalAlpha = 1;
    }
  }, [bp, upTo]);
  return <canvas ref={ref} aria-label={`${bp.name} preview`} className={`h-auto w-full ${className}`} />;
}
