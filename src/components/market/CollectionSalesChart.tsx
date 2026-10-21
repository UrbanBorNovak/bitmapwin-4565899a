import { formatSats } from "@/lib/trades";
import type { CollectionSale } from "@/lib/collection-sales";

type Sale = CollectionSale & { source?: string };

/** Price per confirmed on-chain sale, in block order. */
export function CollectionSalesChart({ sales, pending, unavailable, traced, total }: { sales: Sale[]; pending: boolean; unavailable: boolean; traced?: number | undefined; total?: number | undefined }) {
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
        <span className="label text-foreground" data-no-translate>{pts.length} SALES{volume ? ` · ${formatSats(volume)} VOLUME` : ""}{pts.length ? ` · LAST ${formatSats(pts.at(-1)!.priceSats)}` : ""}</span>
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
      {total ? <p className="label mt-2 text-muted-foreground" data-no-translate>{(traced ?? 0).toLocaleString("en-US")}/{total.toLocaleString("en-US")} ITEMS TRACED ON CHAIN · ALL MARKETPLACES · COVERAGE GROWS AS PEOPLE BROWSE</p> : null}
      {pts.length > 0 && (
        <div className="mt-3 max-h-64 overflow-auto border-t border-border">
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left"><th className="label py-2 font-normal">PRICE</th><th className="label py-2 font-normal">SOURCE</th><th className="label py-2 font-normal">BLOCK</th><th className="label py-2 font-normal">TX</th></tr></thead>
            <tbody>
              {[...pts].reverse().map((s) => (
                <tr key={s.txid} className="border-t border-border">
                  <td className="py-1.5" data-no-translate>{formatSats(s.priceSats)}</td>
                  <td className={`label py-1.5 ${s.source === "BITMAPWIN" ? "text-primary" : "text-signal"}`}>{s.source ?? "BITMAPWIN"}</td>
                  <td className="py-1.5" data-no-translate>{s.blockHeight}</td>
                  <td className="py-1.5"><a href={`https://mempool.space/tx/${s.txid}`} target="_blank" rel="noreferrer" className="hover:text-foreground" data-no-translate>{s.txid.slice(0, 10)}… ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
