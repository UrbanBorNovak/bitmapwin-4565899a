import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { allGuardiansQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { GUARDIAN_PRICE_SATS, type GuardianRarity } from "@/lib/bitmon";

type Sale = { txid: string; priceSats: number; blockHeight: number | null };
const RARITIES: GuardianRarity[] = ["COMMON", "RARE", "EPIC", "MYTHIC"];
const RARITY_VAR: Record<GuardianRarity, string> = {
  COMMON: "var(--muted-foreground)",
  RARE: "var(--signal)",
  EPIC: "var(--bitcoin)",
  MYTHIC: "var(--bitcoin)",
};
const DAY = 86_400_000;

/** Short FM chime; louder sweep for MYTHIC/EPIC. Only plays after the user opts in. */
function chime(big: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const notes = big ? [523, 659, 784, 1047] : [784, 1175];
    notes.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ac.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
    setTimeout(() => ac.close(), 1500);
  } catch { /* audio unavailable */ }
}

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}S`;
  if (s < 3600) return `${Math.round(s / 60)}M`;
  if (s < 86400) return `${Math.round(s / 3600)}H`;
  return `${Math.round(s / 86400)}D`;
}

export function GuardianLiveFloor({ sales, listedFloor }: { sales: Sale[]; listedFloor: number | null }) {
  const q = useQuery({ ...allGuardiansQuery(), refetchInterval: 15_000 });
  const list: AwakeGuardian[] = q.data ?? [];
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState<AwakeGuardian | null>(null);
  const known = useRef<Set<number> | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Detect genuinely new mints between refreshes.
  useEffect(() => {
    if (!q.data) return;
    const ids = new Set(q.data.map((g) => g.height));
    if (known.current) {
      const fresh = q.data.find((g) => !known.current!.has(g.height));
      if (fresh) {
        setFlash(fresh);
        if (sound) chime(fresh.rarity === "MYTHIC" || fresh.rarity === "EPIC");
        setTimeout(() => setFlash(null), 6000);
      }
    }
    known.current = ids;
  }, [q.data, sound]);

  const stats = useMemo(() => {
    const now = Date.now();
    const d1 = list.filter((g) => now - new Date(g.createdAt).getTime() < DAY).length;
    const d7 = list.filter((g) => now - new Date(g.createdAt).getTime() < 7 * DAY).length;
    const avg = d7 / 7;
    // Momentum: today's mints vs. the 7-day daily average (real numbers only).
    const charge = list.length === 0 ? 0 : Math.min(100, Math.round((d1 / Math.max(1, avg)) * 50));
    const byRarity = RARITIES.map((r) => {
      const xs = list.filter((g) => g.rarity === r);
      const avg = (k: "hp" | "bite" | "speed" | "armor") => (xs.length ? Math.round(xs.reduce((a, g) => a + g[k], 0) / xs.length) : 0);
      return { r, n: xs.length, pct: list.length ? Math.round((xs.length / list.length) * 1000) / 10 : 0, hp: avg("hp"), bite: avg("bite"), spd: avg("speed"), arm: avg("armor") };
    });
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const cumulative = sorted.map((g, i) => ({ t: g.createdAt.slice(5, 16).replace("T", " "), n: i + 1 }));
    return { d1, d7, charge, byRarity, cumulative };
  }, [list]);

  const salesSeries = useMemo(
    () => [...sales].filter((s) => s.blockHeight).sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0)).map((s) => ({ b: s.blockHeight, p: s.priceSats })),
    [sales],
  );
  // Primary market: every confirmed summon paid the fixed summon price on chain.
  const primary = useMemo(() => {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let sum = 0;
    return sorted.map((g, i) => {
      sum += GUARDIAN_PRICE_SATS;
      return { t: g.createdAt.slice(5, 16).replace("T", " "), p: GUARDIAN_PRICE_SATS, vol: sum, n: i + 1 };
    });
  }, [list]);
  const primaryVolume = list.length * GUARDIAN_PRICE_SATS;
  const secondaryVolume = sales.reduce((n, s) => n + s.priceSats, 0);
  const lastSale = salesSeries.at(-1)?.p ?? null;
  const prevSale = salesSeries.at(-2)?.p ?? null;
  const delta = lastSale && prevSale ? ((lastSale - prevSale) / prevSale) * 100 : null;
  const frenzy = stats.charge >= 100;

  return (
    <section className="mt-12 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-signal">● LIVE FLOOR · REFRESHES EVERY 15S</p>
          <h2 className="display text-3xl">THE GUARDIAN PIT</h2>
        </div>
        <button className="btn-term-ghost text-xs" onClick={() => setSound((s) => !s)} aria-pressed={sound}>
          {sound ? "♪ SOUND ON" : "♪ SOUND OFF"}
        </button>
      </div>

      {/* Ticker */}
      <div className="panel relative overflow-hidden rounded-md border border-border py-2">
        {list.length === 0 ? (
          <p className="px-4 font-mono text-xs text-muted-foreground">WAITING FOR THE FIRST GUARDIAN TO AWAKEN…</p>
        ) : (
          <div className="flex w-max gap-8 whitespace-nowrap font-mono text-xs [animation:guardian-marquee_40s_linear_infinite]">
            {[...list.slice(0, 20), ...list.slice(0, 20)].map((g, i) => (
              <span key={i} data-no-translate>
                <span style={{ color: RARITY_VAR[g.rarity] }}>◆ {g.rarity}</span>{" "}
                {g.height}.BITMAP · {g.species} · LV{g.level} · <span className="text-bitcoin">{GUARDIAN_PRICE_SATS.toLocaleString("en-US")} SATS</span> ·{" "}
                <a href={`https://mempool.space/tx/${g.txid}`} target="_blank" rel="noreferrer" className="text-signal hover:underline">TX {g.txid.slice(0, 6)}</a> · <span className="text-muted-foreground">{ago(g.createdAt)} AGO</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {flash && (
        <div className="panel animate-scale-in rounded-md border-2 border-bitcoin p-4 text-center shadow-[0_0_40px_-5px_var(--bitcoin)]">
          <p className="label text-bitcoin">⚡ NEW GUARDIAN AWAKENED</p>
          <p className="display mt-1 text-2xl" data-no-translate>
            {flash.rarity} · {flash.height}.BITMAP · {flash.species}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Charge meter */}
        <div className={`panel rounded-md border p-5 ${frenzy ? "border-bitcoin animate-pulse" : "border-border"}`}>
          <p className="label text-bitcoin">{frenzy ? "🔥 FRENZY · MINT RATE DOUBLED" : "DNA OVERCHARGE"}</p>
          <p className="display mt-2 text-5xl tabular-nums">{stats.charge}%</p>
          <div className="mt-3 h-3 overflow-hidden rounded-sm bg-muted">
            <div className="h-full bg-bitcoin transition-all duration-1000" style={{ width: `${stats.charge}%`, boxShadow: "0 0 16px var(--bitcoin)" }} />
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {stats.d1} MINTS LAST 24H · {stats.d7} LAST 7D. HITS 100% WHEN TODAY RUNS AT 2× THE WEEKLY PACE.
          </p>
        </div>

        {/* Floor */}
        <div className="panel rounded-md border border-border p-5">
          <p className="label text-signal">{listedFloor ? "ASKING FLOOR" : "MINT FLOOR · PRIMARY"} / LAST PRICE</p>
          <p className="display mt-2 text-4xl tabular-nums">{(listedFloor ?? GUARDIAN_PRICE_SATS).toLocaleString("en-US")} SATS</p>
          <p className="mt-1 font-mono text-sm">
            LAST {lastSale ? `${lastSale.toLocaleString("en-US")} SATS · RESALE` : list.length ? `${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} SATS · SUMMON` : "—"}{" "}
            {delta !== null && <span className={delta >= 0 ? "text-signal" : "text-destructive"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%</span>}
          </p>
          <div className="mt-3 h-24">
            {salesSeries.length > 1 ? (
              <ResponsiveContainer>
                <LineChart data={salesSeries}>
                  <Line type="stepAfter" dataKey="p" stroke="var(--signal)" strokeWidth={2} dot={false} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : primary.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={primary}>
                  <Area type="stepAfter" dataKey="vol" stroke="var(--signal)" fill="var(--signal)" fillOpacity={0.15} strokeWidth={2} />
                  <YAxis hide domain={[0, "auto"]} />
                  <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)" }} formatter={(v: number) => [`${v.toLocaleString("en-US")} SATS`, "SUMMON VOLUME"]} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">NO SUMMONS CONFIRMED YET.</p>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground" data-no-translate>
            SUMMON VOL {primaryVolume.toLocaleString("en-US")} SATS · RESALE VOL {secondaryVolume.toLocaleString("en-US")} SATS · {sales.length} RESALES
          </p>
        </div>

        {/* Rarity */}
        <div className="panel rounded-md border border-border p-5">
          <p className="label">RARITY PULLED SO FAR</p>
          <div className="mt-3 h-36">
            <ResponsiveContainer>
              <BarChart data={stats.byRarity}>
                <XAxis dataKey="r" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  formatter={(v: number, _k, it) => {
                    const x = it.payload as (typeof stats.byRarity)[number];
                    return [`${v} (${x.pct}%) · AVG HP ${x.hp} BITE ${x.bite} SPD ${x.spd} ARM ${x.arm}`, "PULLED"];
                  }}
                />
                <Bar dataKey="n">
                  {stats.byRarity.map((x) => <Cell key={x.r} fill={RARITY_VAR[x.r]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 font-mono text-[10px]" data-no-translate>
            {stats.byRarity.map((x) => (
              <li key={x.r} className="flex justify-between"><span style={{ color: RARITY_VAR[x.r] }}>{x.r}</span><span>{x.n} · {x.pct}%</span></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Cumulative supply */}
      <div className="panel rounded-md border border-border p-5">
        <p className="label">GUARDIANS AWAKENED OVER TIME · {list.length.toLocaleString("en-US")} TOTAL</p>
        <div className="mt-3 h-48">
          {stats.cumulative.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={stats.cumulative}>
                <defs>
                  <linearGradient id="gcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--bitcoin)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--bitcoin)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} width={32} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)" }} />
                <Area type="stepAfter" dataKey="n" stroke="var(--bitcoin)" fill="url(#gcum)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">NO GUARDIANS YET — BE THE FIRST ON THE CHART.</p>
          )}
        </div>
      </div>
    </section>
  );
}
