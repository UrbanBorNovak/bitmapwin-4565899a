import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import atlasHd from "@/assets/oasis-atlas-storybook.jpg";
import { ATLAS_CAPACITY, ATLAS_SIDE, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";
import { atlasPlace } from "@/lib/atlas-places";
import { useQuery } from "@tanstack/react-query";
import { builtWorldQuery } from "@/lib/built-bitmaps";

/** Same painted atlas as /map, shrunk into an Oasis HUD overlay. Click to travel. */
export function OasisAtlasMinimap({ height, tipHeight }: { height?: number | undefined; tipHeight: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const built = useQuery(builtWorldQuery());

  const here = height !== undefined && height >= 0 ? blockToAtlas(height) : null;
  const tip = tipHeight > 0 && tipHeight < ATLAS_CAPACITY ? blockToAtlas(tipHeight) : null;
  const pct = (value: number) => `${((value + 0.5) / ATLAS_SIDE) * 100}%`;

  const travel = (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * ATLAS_SIDE;
    const y = ((event.clientY - box.top) / box.height) * ATLAS_SIDE;
    const block = atlasToBlock(x, y);
    void navigate({ to: "/oasis", search: { height: block } });
  };

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-20 w-[42vw] max-w-[220px] border border-border bg-background/85 backdrop-blur-sm sm:w-[220px]">
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1">
        <span className="font-mono text-[10px] tracking-widest text-signal">ATLAS</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Hide atlas mini-map" : "Show atlas mini-map"}
          className="font-mono text-[10px] text-muted-foreground hover:text-bitcoin"
        >
          {open ? "—" : "+"}
        </button>
      </div>
      {open && (
        <>
          <button
            type="button"
            onClick={travel}
            aria-label="Travel to a district on the atlas"
            className="relative block aspect-square w-full overflow-hidden"
          >
            <img src={atlasHd} alt="Hand-painted atlas of the Oasis" loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 saturate-[1.05]" />
            {(built.data?.built ?? []).map((b) => {
              const p = blockToAtlas(b.height);
              return <span key={b.height} aria-hidden className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 border border-signal bg-signal/50" style={{ left: pct(p.x), top: pct(p.y) }} />;
            })}
            {tip && (
              <span
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_6px_var(--color-signal)]"
                style={{ left: pct(tip.x), top: pct(tip.y) }}
              />
            )}
            {here && (
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-bitcoin"
                style={{ left: pct(here.x), top: pct(here.y) }}
              />
            )}
          </button>
          <p className="px-2 py-1 font-mono text-[9px] leading-tight text-muted-foreground">
            {here ? `HERE · ${atlasPlace(height ?? 0).localName} · ${here.x},${here.y}` : "TAP THE ATLAS TO TRAVEL"}
          </p>
        </>
      )}
    </div>
  );
}
