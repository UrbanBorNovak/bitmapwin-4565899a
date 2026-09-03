import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paidSalesQuery, tradeTime, type TradeRow } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { hasTrait, TRAIT_FILTERS, type TraitId } from "@/lib/traits";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { ProvenanceScoreCard } from "@/components/ProvenancePanel";
import type { RegistryParcel } from "@/lib/registry";

const NO_DATA = "NO DATA YET";
const DAY = 86_400_000;

type Group = {
  key: string;
  label: string;
  match: (height: number) => boolean;
};

const GROUPS: Group[] = [
  ...TRAIT_FILTERS.map((t) => ({
    key: `trait:${t.id}`,
    label: t.label,
    match: (h: number) => hasTrait(h, t.id as TraitId),
  })),
  ...CLUBS.filter((c) => !c.future).map((c) => ({
    key: `club:${c.id as ClubId}`,
    label: c.short,
    match: (h: number) => inClub(h, c),
  })),
];

type Signal = {
  group: Group;
  /** Lowest confirmed sale in the last 30 days, in sats. */
  floor: number | null;
  /** Lowest confirmed sale in the 30 days before that, in sats. */
  priorFloor: number | null;
  changePct: number | null;
  sales30: number;
  volume30: number;
  /** Median days between consecutive confirmed sales of the same bitmap. */
  windowDays: number | null;
  listedCount: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

function saleWindowDays(rows: TradeRow[]): number | null {
  const byHeight = new Map<number, number[]>();
  for (const row of rows) {
    const list = byHeight.get(row.bitmap_height) ?? [];
    list.push(new Date(tradeTime(row)).getTime());
    byHeight.set(row.bitmap_height, list);
  }
  const gaps: number[] = [];
  for (const stamps of byHeight.values()) {
    if (stamps.length < 2) continue;
    stamps.sort((a, b) => a - b);
    for (let i = 1; i < stamps.length; i += 1) {
      const gap = ((stamps[i] as number) - (stamps[i - 1] as number)) / DAY;
      if (gap > 0) gaps.push(gap);
    }
  }
  const m = median(gaps);
  return m === null ? null : Math.round(m * 10) / 10;
}

function buildSignals(sales: TradeRow[], parcels: RegistryParcel[]): Signal[] {
  const now = Date.now();
  return GROUPS.map((group) => {
    const rows = sales.filter((r) => group.match(r.bitmap_height));
    const recent = rows.filter((r) => new Date(tradeTime(r)).getTime() >= now - 30 * DAY);
    const prior = rows.filter((r) => {
      const t = new Date(tradeTime(r)).getTime();
      return t >= now - 60 * DAY && t < now - 30 * DAY;
    });
    const floor = recent.length ? Math.min(...recent.map((r) => r.price_sats)) : null;
    const priorFloor = prior.length ? Math.min(...prior.map((r) => r.price_sats)) : null;
    return {
      group,
      floor,
      priorFloor,
      changePct:
        floor !== null && priorFloor !== null && priorFloor > 0
          ? ((floor - priorFloor) / priorFloor) * 100
          : null,
      sales30: recent.length,
      volume30: recent.reduce((a, b) => a + b.price_sats, 0),
      windowDays: saleWindowDays(rows),
      listedCount: parcels.filter(
        (p) => p.status === "listed" && (p.listedSats ?? 0) > 0 && group.match(p.bitmapHeight),
      ).length,
    };
  })
    .filter((s) => s.sales30 > 0 || s.listedCount > 0)
    .sort((a, b) => {
      const ac = a.changePct ?? -Infinity;
      const bc = b.changePct ?? -Infinity;
      if (ac !== bc) return bc - ac;
      return b.sales30 - a.sales30;
    });
}

/**
 * A three-stage funnel: an observed trait signal, the live listings that match
 * it, and the observed sale window for that subset. Every number comes from
 * confirmed Bitcoin transactions or open PSBT listings — nothing is estimated.
 */
export function OpportunityFunnel({ parcels }: { parcels: RegistryParcel[] }) {
  const sales = useQuery(paidSalesQuery());
  const [pick, setPick] = useState<string | null>(null);

  const signals = useMemo(
    () => buildSignals(sales.data ?? [], parcels),
    [sales.data, parcels],
  );

  const active = useMemo(
    () => signals.find((s) => s.group.key === pick) ?? signals[0] ?? null,
    [signals, pick],
  );

  const assets = useMemo(() => {
    if (!active) return [];
    return parcels
      .filter(
        (p) =>
          p.status === "listed" && (p.listedSats ?? 0) > 0 && active.group.match(p.bitmapHeight),
      )
      .sort((a, b) => (a.listedSats ?? 0) - (b.listedSats ?? 0))
      .slice(0, 3);
  }, [parcels, active]);

  return (
    <section className="border border-border bg-card">
      <header className="border-b border-border p-5 md:p-6">
        <div className="label text-bitcoin">OPPORTUNITY FUNNEL</div>
        <h2 className="display mt-2 text-lg md:text-xl">SIGNAL → ASSETS → SALE WINDOW</h2>
        <p className="mt-2 max-w-2xl font-mono text-[10px] leading-relaxed text-muted-foreground">
          &gt; STAGE 1 RANKS TRAITS BY 30-DAY OBSERVED FLOOR CHANGE. STAGE 2 LISTS THE CHEAPEST OPEN
          LISTINGS IN THAT SUBSET. STAGE 3 IS THE MEDIAN OBSERVED GAP BETWEEN CONFIRMED SALES OF THE
          SAME BITMAP.
        </p>
      </header>

      {sales.isPending ? (
        <p className="p-5 font-mono text-xs text-muted-foreground md:p-6">
          &gt; READING CONFIRMED SALES<span className="blink">_</span>
        </p>
      ) : signals.length === 0 ? (
        <p className="p-5 font-mono text-xs text-muted-foreground md:p-6">
          {NO_DATA} — NO CONFIRMED SALES OR OPEN LISTINGS TO RANK YET.
        </p>
      ) : (
        <div className="grid lg:grid-cols-3">
          {/* Stage 1 — signal */}
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <div className="label mb-3 text-muted-foreground">01 · OBSERVED SIGNAL</div>
            <ul className="space-y-1">
              {signals.slice(0, 8).map((s) => {
                const on = active?.group.key === s.group.key;
                return (
                  <li key={s.group.key}>
                    <button
                      type="button"
                      onClick={() => setPick(s.group.key)}
                      aria-pressed={on}
                      className={`flex w-full items-center justify-between gap-2 border px-2 py-2 text-left ${
                        on ? "border-bitcoin" : "border-border hover:border-bitcoin"
                      }`}
                    >
                      <span className="label">{s.group.label}</span>
                      <span
                        className={`font-mono text-[10px] ${
                          s.changePct === null
                            ? "text-muted-foreground"
                            : s.changePct >= 0
                              ? "text-bitcoin"
                              : "text-muted-foreground"
                        }`}
                      >
                        {s.changePct === null
                          ? NO_DATA
                          : `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Stage 2 — actionable assets */}
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <div className="label mb-3 text-muted-foreground">02 · ACTIONABLE ASSETS</div>
            {active && assets.length > 0 ? (
              <div className="space-y-2">
                {assets.map((p) => (
                  <ProvenanceScoreCard
                    key={p.bitmapHeight}
                    height={p.bitmapHeight}
                    ownerAddress={p.ownerAddress}
                    priceSats={p.listedSats}
                  />
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10px] text-muted-foreground">
                {NO_DATA} — NO OPEN LISTING MATCHES {active?.group.label ?? "THIS SIGNAL"}.
              </p>
            )}
          </div>

          {/* Stage 3 — sale window */}
          <div className="p-4">
            <div className="label mb-3 text-muted-foreground">03 · SALE WINDOW</div>
            {active ? (
              <dl className="space-y-3">
                <Row
                  k="MEDIAN GAP BETWEEN SALES"
                  v={active.windowDays === null ? NO_DATA : `${active.windowDays} DAYS`}
                />
                <Row
                  k="OBSERVED FLOOR · 30D"
                  v={active.floor === null ? NO_DATA : formatSats(active.floor)}
                />
                <Row
                  k="PRIOR FLOOR · 30-60D"
                  v={active.priorFloor === null ? NO_DATA : formatSats(active.priorFloor)}
                />
                <Row
                  k="CONFIRMED SALES · 30D"
                  v={active.sales30 ? active.sales30.toLocaleString("en-US") : NO_DATA}
                />
                <Row
                  k="SALE VOLUME · 30D"
                  v={active.volume30 ? formatSats(active.volume30) : NO_DATA}
                />
                <Row
                  k="OPEN LISTINGS"
                  v={active.listedCount ? active.listedCount.toLocaleString("en-US") : NO_DATA}
                />
              </dl>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-border pb-2 last:border-b-0">
      <dt className="label text-muted-foreground">{k}</dt>
      <dd className="mt-1 font-mono text-xs">{v}</dd>
    </div>
  );
}
