import { formatSats } from "@/lib/trades";
import type { CollectionSale } from "@/lib/collection-sales";

/** Price per confirmed on-chain sale, in block order. */
export function CollectionSalesChart({ sales, pending, unavailable }: { sales: CollectionSale[]; pending: boolean; unavailable: boolean }) {
  const pts = sales.filter((s) => s.priceSats > 0 && s.blockHeight).sort((a, b) => (a.blockHeight! - b.blockHeight!));
  const W = 600, H = 160, P = 8;
  const max = Math.max(1, ...pts.map((s) => s.priceSats));
  const minB = pts[0]?.blockHeight ?? 0, maxB = pts.at(-1)?.blockHeight ?? 1;
  const x = (b: number) => P + ((b - minB) / Math.max(1, maxB - minB)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = pts.map((s, i) => `${i ? "L" : "M"}${pts.length === 1 ? W / 2 : x(s.blockHeight!)},${y(s.priceSats)}`).join(" ");
  const volume = pts.reduce((a, s) => a + s.priceSats, 0);
  return (
    <div className="mt-6 border border-border bg-card/60 p-3 backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label text-muted-foreground">PRICE HISTORY · CONFIRMED ON-CHAIN SALES</span>
        <span className="label text-foreground" data-no-translate>{pts.length} SALES · {formatSats(volume)} VOLUME{pts.length ? ` · LAST ${formatSats(pts.at(-1)!.priceSats)}` : ""}</span>
      </div>
      {pending ? <p className="label mt-3 text-muted-foreground">VERIFYING SALES ON CHAIN…</p>
        : unavailable ? <p className="label mt-3 text-destructive">SALE VERIFICATION UNAVAILABLE — TRY AGAIN LATER</p>
        : pts.length === 0 ? <p className="label mt-3 text-muted-foreground">NO CONFIRMED SALES YET</p>
        : (
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Sale price chart">
            <path d={path} fill="none" className="stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {pts.map((s) => (
              <circle key={s.txid} cx={pts.length === 1 ? W / 2 : x(s.blockHeight!)} cy={y(s.priceSats)} r={3} className="fill-signal">
                <title>{`${formatSats(s.priceSats)} · block ${s.blockHeight}`}</title>
              </circle>
            ))}
          </svg>
        )}
    </div>
  );
}
