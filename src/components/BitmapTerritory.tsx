import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { TerritoryCanvas } from "@/components/TerritoryCanvas";
import { blockSizeMapQuery } from "@/lib/block-bytes";

const BitmapTerritory3D = lazy(() =>
  import("@/components/BitmapTerritory3D").then((m) => ({ default: m.BitmapTerritory3D })),
);

const Fallback = () => (
  <div className="flex aspect-square w-full items-center justify-center border border-border bg-background font-mono text-[10px] text-muted-foreground">
    LOADING 3D TERRITORY…
  </div>
);

/**
 * The block's real transaction parcels, in the same window as the bitmap image:
 * a flat inspectable map, or the same plots extruded into orbitable land.
 */
export function BitmapTerritory({ height, className }: { height: number; className?: string }) {
  const [view, setView] = useState<"2d" | "3d">("2d");
  const { data } = useQuery(blockSizeMapQuery(height));
  const parcels = data?.classes?.length ?? 0;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>TERRITORY // TX PARCELS</span>
        <div className="flex items-center gap-3">
          <span data-no-translate>{parcels.toLocaleString("en-US")} PARCELS</span>
          <div className="flex border border-border">
            {(["2d", "3d"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  view === mode
                    ? "bg-bitcoin text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span data-no-translate>{mode.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "2d" ? (
        <TerritoryCanvas height={height} hideTitle />
      ) : (
        <ClientOnly fallback={<Fallback />}>
          <Suspense fallback={<Fallback />}>
            <BitmapTerritory3D height={height} />
          </Suspense>
        </ClientOnly>
      )}

      {view === "3d" ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          DRAG TO ORBIT · SCROLL TO ZOOM · PLOT HEIGHT = REAL TRANSACTION WEIGHT
        </div>
      ) : null}
    </div>
  );
}
