import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { parcelOutpost, OUTPOST_STYLES } from "@/lib/parcel-foundry";
import { FIEF_SPLIT } from "@/lib/coins";
import { BLOCKS } from "@/lib/voxel-world";

export const Route = createFileRoute("/kennels")({
  head: () => ({
    meta: [
      { title: "District Parcel Foundry — an Outpost for every transaction | bitmapwin" },
      { name: "description", content: "Every transaction in a block is a parcel of its BITMAP. The Foundry derives one Outpost per parcel, fitted to its own Mondrian ground, ready to place in Land Forge." },
      { property: "og:title", content: "District Parcel Foundry — BITMAPWIN" },
      { property: "og:description", content: "One deterministic voxel Outpost per parcel, clipped to its own tile and built in Land Forge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Foundry,
});

const colour = (k: string) => BLOCKS.find((b) => b.id === k)?.top ?? "#555";

function Foundry() {
  const [input, setInput] = useState("840000");
  const height = /^\d+$/.test(input) ? Number(input) : null;
  const sizes = useQuery({ ...blockSizeMapQuery(height ?? 0), enabled: height !== null });
  const rects = useMemo(() => parcelRects(sizes.data?.classes), [sizes.data]);
  const [pick, setPick] = useState(0);
  const rect = rects[pick] ?? null;
  const outpost = useMemo(() => (rect && height !== null ? parcelOutpost(height, rect) : null), [rect, height]);
  const top = useMemo(() => {
    const m = new Map<number, { y: number; k: string }>();
    for (const b of outpost?.blocks ?? []) { const c = b.dx * 64 + b.dz; const cur = m.get(c); if (!cur || b.dy > cur.y) m.set(c, { y: b.dy, k: b.k }); }
    return m;
  }, [outpost]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 font-mono">
      <header className="space-y-2">
        <p className="text-xs tracking-widest text-accent">LAND FORGE · DISTRICT PARCEL FOUNDRY</p>
        <h1 className="font-display text-3xl font-bold text-foreground">An Outpost for every transaction</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every transaction in a block is a parcel of its BITMAP (<span data-no-translate>&lt;index&gt;.&lt;height&gt;.bitmap</span>). The Foundry derives one Outpost per parcel from the block height and transaction number alone, fitted to that parcel's own ground on the BITMAP floor. Place it in Land Forge and inscribe it on your parcel — nothing is pre-minted, nothing is relocated.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/60 p-4 backdrop-blur">
        <label className="text-[11px] text-muted-foreground">BITMAP
          <input value={input} onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setPick(0); }} className="mt-1 block w-40 rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <p className="text-xs text-muted-foreground">{sizes.isLoading ? "READING THE BLOCK…" : rects.length ? `${rects.length.toLocaleString("en-US")} PARCELS · ONE OUTPOST EACH` : "NO PARCEL LAYOUT FOR THIS BLOCK"}</p>
      </section>

      {rects.length > 0 && height !== null && (
        <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="mb-2 text-[10px] text-muted-foreground">TAP A PARCEL · BRIGHT TILES SHOW THE SELECTED OUTPOST FROM ABOVE</p>
            <svg viewBox="0 0 64 64" className="aspect-square w-full" role="img" aria-label={`Parcel map of ${height}.BITMAP`}>
              <rect width="64" height="64" fill="hsl(var(--background))" />
              {rects.map((r) => (
                <rect key={r.index} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} onClick={() => setPick(r.index)}
                  fill={r.index === pick ? "hsl(var(--primary) / 0.15)" : "transparent"} stroke={r.index === pick ? "hsl(var(--primary))" : "hsl(var(--border))"} strokeWidth={r.index === pick ? 0.4 : 0.15} className="cursor-pointer" />
              ))}
              {[...top].map(([c, v]) => <rect key={c} x={Math.floor(c / 64)} y={c % 64} width={1} height={1} fill={colour(v.k)} opacity={0.5 + Math.min(0.5, v.y / 20)} pointerEvents="none" />)}
            </svg>
          </div>
          <aside className="space-y-3">
            <div className="rounded-lg border border-primary/50 bg-card/60 p-4">
              <p className="text-xs text-primary" data-no-translate>{pick}.{height}.BITMAP</p>
              <p className="mt-1 font-display text-xl text-foreground">{outpost?.style.name}</p>
              <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between"><dt>FOOTPRINT</dt><dd>{rect!.x1 - rect!.x0}×{rect!.z1 - rect!.z0} · {rect!.cells.size} OWNED CELLS</dd></div>
                <div className="flex justify-between"><dt>TOWER</dt><dd>{outpost?.towerHeight} BLOCKS</dd></div>
                <div className="flex justify-between"><dt>VOXELS</dt><dd>{outpost?.blocks.length}</dd></div>
              </dl>
              <input type="number" min={0} max={rects.length - 1} value={pick} onChange={(e) => setPick(Math.max(0, Math.min(rects.length - 1, Number(e.target.value) || 0)))} className="mt-3 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground" aria-label="Parcel number" />
              <Link to="/forge" search={{ height, parcel: pick }} className="mt-3 block rounded bg-primary px-3 py-2 text-center text-xs text-primary-foreground">OPEN IN LAND FORGE →</Link>
              {outpost && outpost.blocks.length === 0 && <p className="mt-2 text-[10px] text-muted-foreground">This parcel is too small to win any ground, so its Outpost is empty.</p>}
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-4 text-[11px] text-muted-foreground">
              <p className="mb-1 text-accent">WHY BUILD ONE</p>
              Valid parcel holders share {FIEF_SPLIT.parcelPercent}% of their BITMAP's daily visitor BIT. An inscribed Outpost makes your parcel a place worth visiting — visits are what fill that pool.
              <p className="mt-2 text-accent">STYLES</p>
              {OUTPOST_STYLES.map((s) => s.name).join(" · ")}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
