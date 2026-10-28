import { lazy, Suspense, useEffect, useState } from "react";
import { resolvePixelAsset, type PixelAsset } from "@/lib/pixel-texture";

const OwnedPixelModel3D = lazy(() => import("./OwnedPixelModel3D"));

/** Owned Pixel in the seat inspector: shows the real PNG texture behind text/BRC-420 inscriptions. */
export function OwnedPixelCard({ pixelId }: { pixelId: string }) {
  const [a, setA] = useState<PixelAsset | null | undefined>(undefined);
  useEffect(() => {
    let live = true; setA(undefined);
    resolvePixelAsset(pixelId).then((r) => { if (live) setA(r); });
    return () => { live = false; };
  }, [pixelId]);
  return (
    <div className="mt-2 border border-bitcoin/50 bg-background p-1">
      {a?.model && (
        <div className="aspect-square w-full">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">LOADING 3D…</div>}>
            <OwnedPixelModel3D model={a.model} texture={a.texture} />
          </Suspense>
        </div>
      )}
      <a href={`https://ordinals.com/inscription/${pixelId}`} target="_blank" rel="noreferrer" className="block">
        {a === undefined ? (
          <div className="flex aspect-square w-full items-center justify-center text-[10px] text-muted-foreground">LOADING PIXEL…</div>
        ) : a?.model ? null : a?.texture ? (
          <img src={`/api/public/inscription/${a.texture}`} alt={a.name ?? "BITMAP Pixel owned by this wallet"} className="aspect-square w-full object-contain" style={{ imageRendering: "pixelated" }} />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center text-[10px] text-muted-foreground">PIXEL IMAGE UNAVAILABLE</div>
        )}
        {a?.name && <div className="mt-1 truncate text-[10px] text-foreground" data-no-translate>{a.name}</div>}
        <div className="mt-1 text-[10px] text-bitcoin">✓ OWNED BITMAP PIXEL →</div>
      </a>
      {a?.model && (
        <a href={`https://ordinals.com/inscription/${a.model}`} target="_blank" rel="noreferrer" className="block text-[10px] text-signal hover:underline">◆ ON-CHAIN 3D MODEL (GLB) →</a>
      )}
    </div>
  );
}
