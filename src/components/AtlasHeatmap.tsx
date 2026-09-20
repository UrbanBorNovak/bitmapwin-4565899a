import { useMemo } from "react";
import { ATLAS_SIDE, blockToAtlas } from "@/lib/atlas-geometry";
import type { ProvenanceEvent } from "@/lib/passport";

/**
 * ACTIVITY HEATMAP — where history actually happened in the last day.
 *
 * Verified provenance records are binned onto the same Hilbert grid the pins
 * use, so a busy district glows without drowning the painting in labels.
 */
export function AtlasHeatmap({ events, hours = 24 }: { events: ProvenanceEvent[]; hours?: number }) {
  const cells = useMemo(() => {
    const since = Date.now() - hours * 3600_000;
    const divisions = 32;
    const bins = new Map<string, { x: number; y: number; count: number }>();
    for (const event of events) {
      if (event.bitmapHeight === null) continue;
      if (new Date(event.occurredAt).getTime() < since) continue;
      const point = blockToAtlas(event.bitmapHeight);
      const col = Math.floor((point.x / ATLAS_SIDE) * divisions);
      const row = Math.floor((point.y / ATLAS_SIDE) * divisions);
      const key = `${col}:${row}`;
      const found = bins.get(key);
      if (found) found.count += 1;
      else bins.set(key, { x: col / divisions, y: row / divisions, count: 1 });
    }
    const list = [...bins.values()];
    const peak = list.reduce((max, cell) => Math.max(max, cell.count), 1);
    return list.map((cell) => ({ ...cell, weight: cell.count / peak }));
  }, [events, hours]);

  if (cells.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-screen">
      {cells.map((cell) => (
        <span
          key={`${cell.x}-${cell.y}`}
          className="absolute rounded-full blur-[6px]"
          style={{
            left: `${cell.x * 100}%`,
            top: `${cell.y * 100}%`,
            width: "6%",
            height: "6%",
            background: `radial-gradient(circle, color-mix(in oklab, var(--color-bitcoin) 80%, var(--color-signal)) 0%, transparent 70%)`,
            opacity: 0.18 + cell.weight * 0.5,
          }}
        />
      ))}
    </div>
  );
}
