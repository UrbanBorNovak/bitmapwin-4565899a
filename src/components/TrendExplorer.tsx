import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paidSalesQuery, tradeTime, type TradeRow } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { hasTrait, TRAIT_FILTERS, type TraitId } from "@/lib/traits";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { ProvenanceScoreCard } from "@/components/ProvenancePanel";
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
  const stamps = rows.map((r) => new Date(tradeTime(r)).getTime());
  const now = Date.now();
  const from = days ? now - days * 86_400_000 : Math.min(...stamps);
  const span = Math.max(1, now - from);
  const bucketMs = span / 12;
  const map = new Map<number, { sum: number; min: number; count: number }>();
  rows.forEach((row, i) => {
    const t = stamps[i] as number;
    if (t < from) return;
    const idx = Math.min(11, Math.floor((t - from) / bucketMs));
    const cur = map.get(idx) ?? { sum: 0, min: Infinity, count: 0 };
    cur.sum += row.price_sats;
    cur.min = Math.min(cur.min, row.price_sats);
    cur.count += 1;
    map.set(idx, cur);
  });
  const out: Bucket[] = [];
  for (const [idx, v] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    const start = from + idx * bucketMs;
    out.push({
      start,
      label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      floor: v.min,
      avg: Math.round(v.sum / v.count),
      count: v.count,
    });
  }
  return out;
}

function path(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/**
 * Trait- and timeframe-filtered price trends built only from confirmed on-chain
 * sales, paired with provenance score cards for the cheapest live listings in
 * the same subset.
 */
export function TrendExplorer({ parcels }: { parcels: RegistryParcel[] }) {
  const [trait, setTrait] = useState<TraitId | "any">("any");
  const [club, setClub] = useState<ClubId | "any">("any");
  const [frame, setFrame] = useState<Frame>(FRAMES[1] as Frame);
  const [hover, setHover] = useState<number | null>(null);

  const sales = useQuery(paidSalesQuery());

  const matches = (height: number) => {
    if (trait !== "any" && !hasTrait(height, trait)) return false;
    if (club !== "any") {
      const def = CLUBS.find((c) => c.id === club);
      if (def && !inClub(height, def)) return false;
    }
    return true;
  };

  const subset = useMemo(
    () => (sales.data ?? []).filter((row) => matches(row.bitmap_height)),
    [sales.data, trait, club],
  );

  const buckets = useMemo(() => bucketSales(subset, frame.days), [subset, frame]);

  const listed = useMemo(
    () =>
      parcels
        .filter((p) => p.status === "listed" && (p.listedSats ?? 0) > 0 && matches(p.bitmapHeight))
        .sort((a, b) => (a.listedSats ?? 0) - (b.listedSats ?? 0))
        .slice(0, 3),
    [parcels, trait, club],
  );

  const inFrame = useMemo(() => {
    if (!frame.days) return subset;
    const from = Date.now() - frame.days * 86_400_000;
    return subset.filter((r) => new Date(tradeTime(r)).getTime() >= from);
  }, [subset, frame]);

  const floor = inFrame.length ? Math.min(...inFrame.map((r) => r.price_sats)) : null;
  const volume = inFrame.reduce((a, b) => a + b.price_sats, 0);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const change =
    first && last && first.floor > 0 ? ((last.floor - first.floor) / first.floor) * 100 : null;

  const W = 720;
  const H = 220;
  const PAD = { l: 8, r: 8, t: 16, b: 26 };
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.floor, b.avg)));
  const min = Math.min(...buckets.map((b) => Math.min(b.floor, b.avg)), max);
  const range = Math.max(1, max - min);
  const x = (i: number) =>
    PAD.l + (buckets.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (buckets.length - 1));
  const y = (v: number) => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);

  const active = hover !== null ? buckets[hover] : null;

  return (
    <section className="border border-border bg-card">
      <header className="flex flex-col gap-4 border-b border-border p-5 md:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="label text-bitcoin">PRICE TRENDS</div>
            <h2 className="display mt-2 text-lg md:text-xl">FLOOR HISTORY BY TRAIT</h2>
            <p className="mt-2 max-w-xl font-mono text-[10px] leading-relaxed text-muted-foreground">
              &gt; OBSERVED FLOOR IS THE LOWEST CONFIRMED SALE IN EACH PERIOD. ONLY SETTLED BITCOIN
              TRANSACTIONS COUNT — NOTHING IS ESTIMATED.
            </p>
          </div>
          <div className="flex gap-1">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame(f)}
                className={`label border px-2 py-1 ${
                  f.id === frame.id
                    ? "border-bitcoin bg-bitcoin text-black"
                    : "border-border text-muted-foreground hover:border-bitcoin"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Chip on={trait === "any" && club === "any"} onClick={() => { setTrait("any"); setClub("any"); }}>
            ALL BITMAPS
          </Chip>
          {TRAIT_FILTERS.map((t) => (
            <Chip key={t.id} on={trait === t.id} onClick={() => setTrait(trait === t.id ? "any" : t.id)}>
              {t.label}
            </Chip>
          ))}
          {CLUBS.filter((c) => !c.future).map((c) => (
            <Chip key={c.id} on={club === c.id} onClick={() => setClub(club === c.id ? "any" : c.id)}>
              {c.short}
            </Chip>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        <Stat k="SALES IN RANGE" v={inFrame.length ? inFrame.length.toLocaleString("en-US") : NO_DATA} />
        <Stat k="OBSERVED FLOOR" v={floor ? formatSats(floor) : NO_DATA} />
        <Stat k="SALE VOLUME" v={volume ? formatSats(volume) : NO_DATA} />
        <Stat
          k="FLOOR CHANGE"
          v={change === null ? NO_DATA : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
        />
      </div>

      <div className="p-5 md:p-6">
        {sales.isPending ? (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; READING CONFIRMED SALES<span className="blink">_</span>
          </p>
        ) : buckets.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            {NO_DATA} — NO CONFIRMED SALE MATCHES THIS FILTER AND TIMEFRAME.
          </p>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Floor price trend">
              {[0, 0.5, 1].map((f) => (
                <line
                  key={f}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={PAD.t + f * (H - PAD.t - PAD.b)}
                  y2={PAD.t + f * (H - PAD.t - PAD.b)}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                />
              ))}
              <path
                d={path(buckets.map((b, i) => [x(i), y(b.avg)]))}
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <path
                d={path(buckets.map((b, i) => [x(i), y(b.floor)]))}
                fill="none"
                stroke="currentColor"
                className="text-bitcoin"
                strokeWidth="2"
              />
              {buckets.map((b, i) => (
                <g key={b.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect
                    x={x(i) - 14}
                    y={PAD.t}
                    width={28}
                    height={H - PAD.t - PAD.b}
                    fill="transparent"
                  />
                  <rect x={x(i) - 2.5} y={y(b.floor) - 2.5} width={5} height={5} className="fill-bitcoin" />
                </g>
              ))}
              {buckets.map((b, i) =>
                i % Math.ceil(buckets.length / 6) === 0 ? (
                  <text
                    key={`t-${b.start}`}
                    x={x(i)}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 9 }}
                  >
                    {b.label.toUpperCase()}
                  </text>
                ) : null,
              )}
            </svg>
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-bitcoin" aria-hidden /> OBSERVED FLOOR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-muted-foreground" aria-hidden /> AVERAGE SALE
              </span>
              {active ? (
                <span className="text-foreground">
                  {active.label.toUpperCase()} · FLOOR {formatSats(active.floor)} · AVG{" "}
                  {formatSats(active.avg)} · {active.count} SALE{active.count === 1 ? "" : "S"}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border p-5 md:p-6">
        <div className="label text-bitcoin">ACTIONABLE ASSETS</div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          &gt; CHEAPEST LIVE LISTINGS MATCHING THIS FILTER, SCORED ON REAL PROVENANCE.
        </p>
        {listed.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {NO_DATA} — NOTHING LISTED IN THIS SUBSET RIGHT NOW.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {listed.map((p) => (
              <ProvenanceScoreCard
                key={p.bitmapHeight}
                height={p.bitmapHeight}
                ownerAddress={p.ownerAddress}
                priceSats={p.listedSats}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`label border px-2 py-1 ${
        on ? "border-bitcoin bg-bitcoin text-black" : "border-border text-muted-foreground hover:border-bitcoin"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-border p-4 [&:not(:first-child)]:border-l">
      <div className="label">{k}</div>
      <div className={`display mt-1 text-sm ${v === NO_DATA ? "text-muted-foreground" : ""}`}>{v}</div>
    </div>
  );
}
