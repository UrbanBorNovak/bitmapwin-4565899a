import { useEffect, useState } from "react";

/** bop's on-chain Bitmon pattern module (#73661860) and viewer (#76176391), data by @bitlodo, Mondrian layout by mononaut. */
export const BITMON_MODULE_ID = "55551557695dd82a2bda5ec3497684ec7cbb2cc1752ff5101accff1648666c3ai0";
export const BITMON_VIEWER_ID = "78387255f667a67add30b3c7a65c3e35894e353e802dc19cfcb76adbae490acai0";

type Slot = { position: { x: number; y: number }; size: number };
type BitmonModule = {
  getPattern: (h: number) => string | undefined;
  getPatternArray: (h: number) => number[];
  getPatternArrayData: () => number[];
  getMondrian: (h: number) => { width: number; height: number; slots: Slot[] };
};
type BitmonData = { pattern: string | null; tiers: number[]; firstSeen: number | null; rank: number | null; total: number | null; width: number; height: number; slots: Slot[] };

let modPromise: Promise<BitmonModule> | null = null;
/** Loads the inscribed module itself (browser only) so the result comes straight from chain bytes. */
function loadModule() {
  modPromise ??= import(/* @vite-ignore */ `https://ordinals.com/content/${BITMON_MODULE_ID}`) as Promise<BitmonModule>;
  return modPromise;
}

function readBitmon(mod: BitmonModule, height: number): BitmonData {
  const pattern = mod.getPattern(height) ?? null;
  const tiers = pattern ? mod.getPatternArray(height) : [];
  let firstSeen: number | null = null, rank: number | null = null, total: number | null = null;
  if (pattern) {
    const data = mod.getPatternArrayData();
    const key = data[height];
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== key) continue;
      count++;
      if (firstSeen === null) firstSeen = i;
      if (i === height) rank = count;
    }
    total = count;
  }
  const m = pattern ? mod.getMondrian(height) : { width: 0, height: 0, slots: [] };
  return { pattern, tiers, firstSeen, rank, total, width: m.width, height: m.height, slots: m.slots.map((s) => ({ position: { ...s.position }, size: s.size })) };
}

export function OnchainBitmonPanel({ height }: { height: number }) {
  const [data, setData] = useState<BitmonData | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(false); setHover(null);
    loadModule()
      .then((mod) => { if (alive) setData(readBitmon(mod, height)); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [height]);

  const dim = data ? Math.max(data.width, data.height, 1) : 1;

  return (
    <section className="rounded-md border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label text-accent">ON-CHAIN BITMON PATTERN · EXPERIMENTAL</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The shape of {height}.BITMAP, computed live by the inscribed Bitmon module.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10">
          {open ? "CLOSE 3D VIEWER" : "OPEN 3D VIEWER"}
        </button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
        <div className="aspect-square w-full rounded border border-border bg-background/60 p-2">
          {!data && !error && <p className="grid h-full place-items-center font-mono text-xs text-muted-foreground">READING MODULE FROM CHAIN…</p>}
          {error && <p className="grid h-full place-items-center p-2 text-center font-mono text-xs text-muted-foreground">Could not load the on-chain module right now.</p>}
          {data && !data.pattern && <p className="grid h-full place-items-center font-mono text-xs text-destructive">NOT A BITMON</p>}
          {data && data.pattern && (
            <svg viewBox={`0 0 ${dim} ${dim}`} className="h-full w-full" role="img" aria-label={`Bitmon layout of ${height}.BITMAP`}>
              {data.slots.map((s, i) => (
                <rect
                  key={i}
                  x={s.position.x + (dim - data.width) / 2 + 0.06}
                  y={s.position.y + (dim - data.height) / 2 + 0.06}
                  width={Math.max(0, s.size - 0.12)}
                  height={Math.max(0, s.size - 0.12)}
                  className={hover === i ? "fill-primary" : "fill-primary/70"}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </svg>
          )}
        </div>

        {data && data.pattern && (
          <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-2 font-mono text-xs">
            <dt className="text-muted-foreground">PATTERN</dt><dd className="break-all text-primary">{data.pattern}</dd>
            <dt className="text-muted-foreground">TX TIERS</dt><dd>{data.tiers.length} tx</dd>
            <dt className="text-muted-foreground">FIRST SEEN</dt><dd>{data.firstSeen !== null ? `${data.firstSeen}.BITMAP` : "—"}</dd>
            <dt className="text-muted-foreground">EDITION</dt><dd>{data.rank !== null ? `#${data.rank.toLocaleString()} / ${data.total?.toLocaleString()}` : "—"}</dd>
            <dt className="text-muted-foreground">GRID</dt><dd>{data.width}×{data.height}</dd>
            <dt className="text-muted-foreground">HOVERED</dt><dd className="text-accent">{hover !== null ? `parcel ${hover} · size ${data.slots[hover]?.size}` : "—"}</dd>
          </dl>
        )}
      </div>

      {open && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded border border-border">
          <iframe title={`Bitmon pattern ${height}`} src={`https://ordinals.com/content/${BITMON_VIEWER_ID}#${height}`} sandbox="allow-scripts" className="h-full w-full" loading="lazy" />
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        CREDITS · module &amp; viewer by{" "}
        <a className="underline" href="https://x.com/boppleton" target="_blank" rel="noreferrer">@boppleton</a> · Bitmon data &amp; theory by{" "}
        <a className="underline" href="https://x.com/bitlodo" target="_blank" rel="noreferrer">@bitlodo</a> (<a className="underline" href="https://bitlords.land/bitmon" target="_blank" rel="noreferrer">bitlords.land</a>) · Mondrian layout by{" "}
        <a className="underline" href="https://x.com/mononautical" target="_blank" rel="noreferrer">mononaut</a> ·{" "}
        <a className="underline" href="https://ordinals.com/inscription/73661860" target="_blank" rel="noreferrer">MODULE #73661860</a> ·{" "}
        <a className="underline" href="https://ordinals.com/inscription/76176391" target="_blank" rel="noreferrer">VIEWER #76176391</a>
      </p>
    </section>
  );
}
