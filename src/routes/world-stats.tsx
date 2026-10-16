import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { worldStatsQuery, formatCount } from "@/lib/world-stats";
import { formatBit } from "@/lib/coins";

export const Route = createFileRoute("/world-stats")({
  component: WorldStatsPage,
  head: () => ({
    meta: [
      { title: "World Stats — BIT Supply, Prices & Daily Mining" },
      {
        name: "description",
        content:
          "Live growth numbers for the Oasis: total BIT in circulation, average trading post price, ore mined each day, rigs running, builds raised and sats shared.",
      },
      { property: "og:title", content: "World Stats — BIT Supply, Prices & Daily Mining" },
      {
        property: "og:description",
        content:
          "Track the world's economy: BIT in circulation, average goods price and daily mining output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function WorldStatsPage() {
  const stats = useQuery(worldStatsQuery());
  const t = stats.data?.totals;
  const daily = stats.data?.daily ?? [];
  const series = daily.map((day) => ({
    label: day.day.slice(5),
    minted: day.bitMinted,
    mined: day.mined,
    volume: day.tradeVolume,
    trades: day.trades,
  }));
  const today = series[series.length - 1];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">WORLD STATS</h1>
        <p className="label mt-3">THE WHOLE WORLD IN NUMBERS — SUPPLY, PRICES AND MINING</p>
      </header>

      {stats.isLoading && (
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          &gt; READING THE LEDGER<span className="blink">_</span>
        </p>
      )}
      {stats.isError && (
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          &gt; COULD NOT READ THE WORLD RIGHT NOW — TRY AGAIN IN A MOMENT
        </p>
      )}

      {t && (
        <>
          <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-3">
            <Stat k="BIT IN CIRCULATION" v={formatBit(t.bitCirculating)} note={`${formatCount(t.holders)} HOLDERS`} />
            <Stat
              k="AVERAGE GOODS PRICE"
              v={`${formatCount(t.avgGoodsPrice)} BIT`}
              note={`${formatCount(t.goodsTracked)} GOODS TRACKED`}
            />
            <Stat
              k="MINED LAST 24H"
              v={formatBit(t.mined24h)}
              note={`${formatCount(t.rigs)} RIGS · ${formatCount(t.miners24h)} MINERS`}
            />
            <Stat k="BIT EVER EARNED" v={formatBit(t.bitEarnedTotal)} note={`+${formatBit(t.bitMinted24h)} LAST 24H`} />
            <Stat
              k="TRADE VOLUME 24H"
              v={formatBit(t.goodsVolume24h)}
              note={`${formatCount(t.goodsTrades24h)} TRADES · ${formatCount(t.openListings)} LISTINGS`}
            />
            <Stat
              k="SATS SHARED"
              v={`${formatCount(t.donatedSats)} SATS`}
              note={`PAID OUT ${formatBit(t.donatedBits)}`}
            />
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <Panel title="BIT CREATED PER DAY" note={today ? `TODAY ${formatBit(today.minted)}` : ""}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="mintFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-bitcoin)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-bitcoin)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--color-border)" interval="preserveStartEnd" />
                  <YAxis width={44} tick={AXIS_TICK} stroke="var(--color-border)" />
                  <Tooltip contentStyle={TOOLTIP} formatter={(value: number) => [`${formatCount(value)} BIT`, "CREATED"]} />
                  <Area
                    type="monotone"
                    dataKey="minted"
                    stroke="var(--color-bitcoin)"
                    strokeWidth={1.5}
                    fill="url(#mintFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="ORE MINED PER DAY" note={today ? `TODAY ${formatBit(today.mined)}` : ""}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--color-border)" interval="preserveStartEnd" />
                  <YAxis width={44} tick={AXIS_TICK} stroke="var(--color-border)" />
                  <Tooltip contentStyle={TOOLTIP} formatter={(value: number) => [`${formatCount(value)} BIT`, "MINED"]} />
                  <Bar dataKey="mined" fill="var(--color-bitcoin)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel
              title="TRADING POST VOLUME PER DAY"
              note={today ? `TODAY ${formatCount(today.trades)} TRADES` : ""}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--color-border)" interval="preserveStartEnd" />
                  <YAxis width={44} tick={AXIS_TICK} stroke="var(--color-border)" />
                  <Tooltip contentStyle={TOOLTIP} formatter={(value: number) => [`${formatCount(value)} BIT`, "VOLUME"]} />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="var(--color-foreground)"
                    strokeWidth={1.5}
                    fill="url(#volFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="WORLD ACTIVITY" note={`${formatCount(t.builds24h)} BUILDS RAISED IN 24H`}>
              <ul className="space-y-2 p-4 font-mono text-[11px] text-muted-foreground">
                <li className="flex justify-between">
                  <span>BUILDS STANDING</span>
                  <span className="text-foreground">{formatCount(t.builds)}</span>
                </li>
                <li className="flex justify-between">
                  <span>MINING RIGS RUNNING</span>
                  <span className="text-foreground">{formatCount(t.rigs)}</span>
                </li>
                <li className="flex justify-between">
                  <span>GOODS IN STOCK</span>
                  <span className="text-foreground">{formatCount(t.goodsStock)}</span>
                </li>
                <li className="flex justify-between">
                  <span>ORE MINED ALL TIME</span>
                  <span className="text-foreground">{formatBit(t.minedTotal)}</span>
                </li>
              </ul>
            </Panel>
          </section>

          <p className="label mt-8">
            <Link to="/trading-post" className="text-bitcoin hover:underline">
              TRADING POST
            </Link>
            {" · "}
            <Link to="/donate" className="text-bitcoin hover:underline">
              SHARE & FUEL FOR BIT
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

const AXIS_TICK = { fontSize: 9, fontFamily: "monospace" } as const;
const TOOLTIP = {
  background: "var(--color-background)",
  border: "1px solid var(--color-border)",
  fontFamily: "monospace",
  fontSize: 10,
} as const;

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label">{title}</span>
        {note ? <span className="label text-bitcoin">{note}</span> : null}
      </header>
      <div className="h-40 w-full px-1 py-2">{children}</div>
    </div>
  );
}

function Stat({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="border-b border-r border-border p-4">
      <div className="label">{k}</div>
      <div className="display mt-1 text-lg">{v}</div>
      {note ? <div className="label mt-1 text-muted-foreground">{note}</div> : null}
    </div>
  );
}
