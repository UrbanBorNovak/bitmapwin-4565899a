import { useMemo, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, TrendingUp } from "lucide-react";
import { paidSalesQuery, tradeTime, type TradeRow } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { hasTrait, TRAIT_FILTERS, type TraitId } from "@/lib/traits";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { ProvenanceScoreCard } from "@/components/ProvenancePanel";
import { Button } from "@/components/ui/button";
import type { RegistryParcel } from "@/lib/registry";

const NO_DATA = "NO DATA YET";

type Frame = { id: string; label: string; days: number | null };

const FRAMES: Frame[] = [
  { id: "30", label: "30D", days: 30 },
  { id: "90", label: "90D", days: 90 },
  { id: "365", label: "1Y", days: 365 },
  { id: "all", label: "ALL", days: null },
];

type Bucket = { start: number; label: string; floor: number; avg: number; count: number };

function bucketSales(rows: TradeRow[], days: number | null): Bucket[] {
  if (rows.length === 0) return [];
  const stamps = rows.map((row) => new Date(tradeTime(row)).getTime());
  const now = Date.now();
  const from = days ? now - days * 86_400_000 : Math.min(...stamps);
  const span = Math.max(1, now - from);
  const bucketMs = span / 12;
  const map = new Map<number, { sum: number; min: number; count: number }>();

  rows.forEach((row, index) => {
    const timestamp = stamps[index] ?? 0;
    if (timestamp < from) return;
    const bucketIndex = Math.min(11, Math.floor((timestamp - from) / bucketMs));
    const current = map.get(bucketIndex) ?? { sum: 0, min: Infinity, count: 0 };
    current.sum += row.price_sats;
    current.min = Math.min(current.min, row.price_sats);
    current.count += 1;
    map.set(bucketIndex, current);
  });

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketIndex, value]) => {
      const start = from + bucketIndex * bucketMs;
      return {
        start,
        label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        floor: value.min,
        avg: Math.round(value.sum / value.count),
        count: value.count,
      };
    });
}

function path(points: Array<[number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** Confirmed-sale trend analysis with compact trait and collection controls. */
export function TrendExplorer({ parcels }: { parcels: RegistryParcel[] }) {
  const [trait, setTrait] = useState<TraitId | "any">("any");
  const [club, setClub] = useState<ClubId | "any">("any");
  const [frameId, setFrameId] = useState("90");
  const [hover, setHover] = useState<number | null>(null);
  const sales = useQuery(paidSalesQuery());

  const frame = FRAMES.find((item) => item.id === frameId) ?? FRAMES[1];
  const activeTrait = TRAIT_FILTERS.find((item) => item.id === trait);
  const activeClub = CLUBS.find((item) => item.id === club);
  const hasFilters = trait !== "any" || club !== "any";

  const matches = (height: number) => {
    if (trait !== "any" && !hasTrait(height, trait)) return false;
    if (activeClub && !inClub(height, activeClub)) return false;
    return true;
  };

  const subset = useMemo(
    () => (sales.data ?? []).filter((row) => matches(row.bitmap_height)),
    [sales.data, trait, club],
  );
  const buckets = useMemo(() => bucketSales(subset, frame?.days ?? null), [subset, frame?.days]);
  const listed = useMemo(
    () =>
      parcels
        .filter((parcel) => parcel.status === "listed" && (parcel.listedSats ?? 0) > 0 && matches(parcel.bitmapHeight))
        .sort((a, b) => (a.listedSats ?? 0) - (b.listedSats ?? 0))
        .slice(0, 3),
    [parcels, trait, club],
  );
  const inFrame = useMemo(() => {
    if (!frame?.days) return subset;
    const from = Date.now() - frame.days * 86_400_000;
    return subset.filter((row) => new Date(tradeTime(row)).getTime() >= from);
  }, [subset, frame?.days]);

  const floor = inFrame.length ? Math.min(...inFrame.map((row) => row.price_sats)) : null;
  const volume = inFrame.reduce((total, row) => total + row.price_sats, 0);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const change = first && last && first.floor > 0 ? ((last.floor - first.floor) / first.floor) * 100 : null;

  const W = 920;
  const H = 290;
  const PAD = { l: 14, r: 14, t: 22, b: 34 };
  const max = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.floor, bucket.avg)));
  const min = Math.min(...buckets.map((bucket) => Math.min(bucket.floor, bucket.avg)), max);
  const range = Math.max(1, max - min);
  const x = (index: number) =>
    PAD.l + (buckets.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (index * (W - PAD.l - PAD.r)) / (buckets.length - 1));
  const y = (value: number) => PAD.t + (1 - (value - min) / range) * (H - PAD.t - PAD.b);
  const active = hover === null ? buckets[buckets.length - 1] : buckets[hover];

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (buckets.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * W;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    buckets.forEach((_, index) => {
      const nextDistance = Math.abs(x(index) - pointerX);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = index;
      }
    });
    setHover(closest);
  };

  const resetFilters = () => {
    setTrait("any");
    setClub("any");
  };

  return (
    <section className="overflow-hidden border border-border bg-card shadow-2xl shadow-background/60">
      <header className="border-b border-border bg-secondary/30 p-5 md:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-bitcoin" aria-hidden />
              <span className="label text-bitcoin">PRICE TRENDS · CONFIRMED SALES</span>
            </div>
            <h2 className="display mt-3 text-xl md:text-3xl">FLOOR HISTORY</h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground md:text-sm">
              Lowest confirmed sale per period. Every point is a settled Bitcoin transaction; nothing is estimated.
            </p>
          </div>

          <div className="grid grid-cols-4 border border-border bg-background" aria-label="Price trend timeframe">
            {FRAMES.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={item.id === frameId ? "terminal" : "ghost"}
                size="sm"
                aria-pressed={item.id === frameId}
                onClick={() => setFrameId(item.id)}
                className="h-10 min-w-14 border-0 border-r border-border px-3 last:border-r-0"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <FilterSelect
            id="trend-trait"
            label="OFFICIAL TRAIT"
            value={trait}
            onChange={(value) => setTrait(value as TraitId | "any")}
          >
            <option value="any">ALL OFFICIAL TRAITS</option>
            {TRAIT_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            id="trend-collection"
            label="COLLECTION"
            value={club}
            onChange={(value) => setClub(value as ClubId | "any")}
          >
            <option value="any">ALL COLLECTIONS</option>
            {CLUBS.filter((item) => !item.future).map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </FilterSelect>
          <Button
            type="button"
            variant="terminalGhost"
            size="sm"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="h-[46px] self-end px-4"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            RESET
          </Button>
        </div>

        <div className="mt-3 flex min-h-5 flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
          <span>VIEWING</span>
          <span className="border border-bitcoin/40 bg-bitcoin/10 px-2 py-1 text-bitcoin">
            {activeTrait?.label ?? "ALL BITMAPS"}
          </span>
          {activeClub ? <span className="border border-signal/40 bg-signal/10 px-2 py-1 text-signal">{activeClub.label}</span> : null}
          <span>· {frame?.label ?? "90D"}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-border md:grid-cols-4">
        <Stat k="CONFIRMED SALES" v={inFrame.length ? inFrame.length.toLocaleString("en-US") : NO_DATA} />
        <Stat k="OBSERVED FLOOR" v={floor ? formatSats(floor) : NO_DATA} emphasis />
        <Stat k="SETTLED VOLUME" v={volume ? formatSats(volume) : NO_DATA} />
        <Stat
          k="FLOOR MOVEMENT"
          v={change === null ? NO_DATA : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
          signal={change !== null}
        />
      </div>

      <div className="p-4 md:p-7">
        <div className="mb-4 flex min-h-11 flex-col justify-between gap-2 border-l-2 border-signal pl-3 sm:flex-row sm:items-center">
          <div>
            <div className="label">MARKET SIGNAL</div>
            <div className="mt-1 font-mono text-xs text-foreground" aria-live="polite">
              {active ? `${active.label.toUpperCase()} · FLOOR ${formatSats(active.floor)} · AVG ${formatSats(active.avg)}` : "WAITING FOR CONFIRMED SALES"}
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase text-muted-foreground">
            {active ? `${active.count} SETTLED SALE${active.count === 1 ? "" : "S"}` : "—"}
          </div>
        </div>

        <div className="min-h-[250px] border border-border bg-background/60 p-2 md:min-h-[330px] md:p-4">
          {sales.isPending ? (
            <div className="grid min-h-[250px] place-items-center font-mono text-xs text-muted-foreground md:min-h-[300px]">
              <span>&gt; READING CONFIRMED SALES<span className="blink">_</span></span>
            </div>
          ) : buckets.length === 0 ? (
            <div className="grid min-h-[250px] place-items-center px-5 text-center md:min-h-[300px]">
              <div>
                <div className="display text-lg text-muted-foreground">NO SETTLED SALES</div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">TRY A LONGER RANGE OR CLEAR THE ACTIVE FILTER.</p>
              </div>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-[250px] w-full touch-none md:h-[300px]"
              preserveAspectRatio="none"
              role="img"
              aria-label="Confirmed floor price and average sale trend"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHover(null)}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <line
                  key={fraction}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={PAD.t + fraction * (H - PAD.t - PAD.b)}
                  y2={PAD.t + fraction * (H - PAD.t - PAD.b)}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={`${path(buckets.map((bucket, index) => [x(index), y(bucket.floor)]))} L${x(buckets.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`} className="fill-bitcoin/10" />
              <path d={path(buckets.map((bucket, index) => [x(index), y(bucket.avg)]))} fill="none" stroke="var(--color-signal)" strokeWidth="1.5" strokeDasharray="5 7" vectorEffect="non-scaling-stroke" />
              <path d={path(buckets.map((bucket, index) => [x(index), y(bucket.floor)]))} fill="none" stroke="var(--color-bitcoin)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              {buckets.map((bucket, index) => (
                <g key={bucket.start}>
                  <circle cx={x(index)} cy={y(bucket.floor)} r={hover === index ? 6 : 3} className="fill-bitcoin" vectorEffect="non-scaling-stroke" />
                  {hover === index ? <line x1={x(index)} x2={x(index)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-signal)" strokeDasharray="3 6" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" /> : null}
                </g>
              ))}
              {buckets.map((bucket, index) => index % Math.max(1, Math.ceil(buckets.length / 5)) === 0 ? (
                <text key={`label-${bucket.start}`} x={x(index)} y={H - 9} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                  {bucket.label.toUpperCase()}
                </text>
              ) : null)}
            </svg>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-bitcoin" aria-hidden /> OBSERVED FLOOR</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-signal" aria-hidden /> AVERAGE SALE</span>
          <span className="ml-auto hidden sm:inline">MOVE ACROSS CHART TO INSPECT</span>
        </div>
      </div>

      <div className="border-t border-border bg-secondary/20 p-5 md:p-7">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="label text-bitcoin">MATCHING MARKET</div>
            <h3 className="display mt-2 text-base">LOWEST LIVE ASKS</h3>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">PROVENANCE-SCORED · CURRENT FILTER</p>
        </div>
        {listed.length === 0 ? (
          <p className="mt-4 border border-border bg-background p-4 font-mono text-xs text-muted-foreground">NO LIVE LISTINGS MATCH THIS VIEW.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {listed.map((parcel) => (
              <ProvenanceScoreCard key={parcel.bitmapHeight} height={parcel.bitmapHeight} ownerAddress={parcel.ownerAddress} priceSats={parcel.listedSats} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="block">
      <span className="label mb-1.5 block">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-[46px] w-full border border-border bg-background px-3 font-mono text-xs uppercase text-foreground outline-none transition-colors focus:border-bitcoin focus:ring-1 focus:ring-bitcoin">
        {children}
      </select>
    </label>
  );
}

function Stat({ k, v, emphasis, signal }: { k: string; v: string; emphasis?: boolean; signal?: boolean }) {
  return (
    <div className="min-w-0 border-b border-r border-border p-4 last:border-r-0 md:border-b-0 md:p-5">
      <div className="label truncate">{k}</div>
      <div className={`display mt-2 truncate text-sm md:text-base ${v === NO_DATA ? "text-muted-foreground" : emphasis ? "text-bitcoin" : signal ? "text-signal" : "text-foreground"}`}>{v}</div>
    </div>
  );
}