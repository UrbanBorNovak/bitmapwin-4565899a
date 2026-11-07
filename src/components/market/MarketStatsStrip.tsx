import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { satflowStatsFn } from "@/lib/satflow-stats.functions";

const btc = (sats: number | null) => (sats == null ? "—" : `${(sats / 1e8).toLocaleString("en-US", { maximumFractionDigits: sats >= 1e7 ? 2 : 5 })} ₿`);
const compact = (n: number | null) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** Satflow-style collection stats row. Venue-reported numbers, labelled as such. */
export function MarketStatsStrip() {
  const fn = useServerFn(satflowStatsFn);
  const q = useQuery({ queryKey: ["satflow-stats"], queryFn: () => fn(), staleTime: 60_000, refetchInterval: 120_000 });
  const fees = useQuery({
    queryKey: ["mempool-fees-strip"],
    queryFn: async () => (await (await fetch("https://mempool.space/api/v1/fees/recommended")).json()) as { fastestFee: number },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const s = q.data;
  const pct = s?.floor7dPct ?? null;
  const cells: { label: string; value: string; tone?: string | undefined }[] = [
    { label: "MEMPOOL", value: fees.data ? `${fees.data.fastestFee} SAT/VB` : "—" },
    { label: "FLOOR", value: btc(s?.floorSats ?? null) },
    { label: "7D CHANGE", value: pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, tone: pct == null ? undefined : pct < 0 ? "text-destructive" : "text-signal" },
    { label: "7D VOLUME", value: btc(s?.volume7dSats ?? null) },
    { label: "7D SALES", value: compact(s?.sales7d ?? null) },
    { label: "SUPPLY", value: compact(s?.supply ?? null) },
    { label: "LISTED", value: compact(s?.listed ?? null) },
    { label: "TOP BID", value: btc(s?.topBidSats ?? null) },
    { label: "MARKET CAP", value: s?.marketCapBtc == null ? "—" : `${s.marketCapBtc.toFixed(2)} ₿` },
  ];
  return (
    <section className="mt-6 border border-border bg-card/60 backdrop-blur-md" aria-label="Bitmap market statistics" data-no-translate>
      <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-5 lg:grid-cols-9">
        {cells.map((c) => (
          <div key={c.label} className="bg-card px-3 py-2">
            <p className="label text-muted-foreground">{c.label}</p>
            <p className={`font-mono text-sm font-bold ${c.tone ?? "text-bitcoin"}`}>{q.isPending && c.label !== "MEMPOOL" ? "…" : c.value}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
        COLLECTION-WIDE STATS REPORTED BY <a href="https://www.satflow.com/ordinals/bitmap" target="_blank" rel="noreferrer" className="text-signal hover:underline">SATFLOW ↗</a> · FEES FROM MEMPOOL.SPACE
        {q.isError || (q.isSuccess && !s) ? " · SATFLOW UNAVAILABLE" : ""}
      </p>
    </section>
  );
}
