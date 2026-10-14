/** Guardian Index: analytics + roster for every awakened Guardian (ported from the on-chain World++ viewer). */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { GuardianDna } from "@/lib/bitmon";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { GuardianName } from "@/components/bitmon/GuardianName";
import { guardianTier, powerScore, type Tier } from "@/lib/onchain-guardian";

type G = Pick<GuardianDna, "height" | "rarity" | "hp" | "bite" | "speed" | "armor" | "species"> & { inscriptionId?: string | null };
const RA = ["MYTHIC", "EPIC", "RARE", "COMMON"] as const;
const RA_COL: Record<string, string> = { MYTHIC: "#fbbf24", EPIC: "#c084fc", RARE: "#60a5fa", COMMON: "#94a3b8" };
const TIER_COL: Record<Tier, string> = { S: "#fbbf24", A: "#c084fc", B: "#60a5fa", C: "#34d399", D: "#94a3b8" };
type Tab = "overview" | "stats" | "power" | "roster";
type Filter = "all" | "mythic" | "epic" | "inscribed";
type Sort = "power" | "tier" | "rarity" | "height";

function Radar({ v }: { v: number[] }) {
  const S = 140, c = S / 2, R = S * 0.38, keys = ["HP", "BITE", "SPEED", "ARMOR"];
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i * Math.PI) / 2; return [c + Math.cos(a) * R * r, c + Math.sin(a) * R * r] as const; };
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="mx-auto">
      {[1, 2, 3].map((r) => <polygon key={r} points={[0, 1, 2, 3].map((i) => pt(i, r / 3).join(",")).join(" ")} fill="none" className="stroke-border" />)}
      <polygon points={v.map((x, i) => pt(i, x).join(",")).join(" ")} className="fill-signal/20 stroke-signal" strokeWidth={2} />
      {keys.map((k, i) => { const [x, y] = pt(i, 1.22); return <text key={k} x={x} y={y + 3} textAnchor="middle" className="fill-muted-foreground text-[8px]">{k}</text>; })}
    </svg>
  );
}

export function GuardianIndex({ guardians, onPick }: { guardians: G[]; onPick?: (h: number) => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("power");
  const [q, setQ] = useState("");

  const rows = useMemo(() => guardians.map((g) => ({ g, m: { name: g.species, plan: g.species }, pw: powerScore(g), tier: guardianTier(g) })), [guardians]);
  const list = useMemo(() => {
    const tr = { S: 0, A: 1, B: 2, C: 3, D: 4 };
    let out = rows;
    if (filter === "mythic") out = out.filter((r) => r.g.rarity === "MYTHIC");
    if (filter === "epic") out = out.filter((r) => r.g.rarity === "EPIC");
    if (filter === "inscribed") out = out.filter((r) => !!r.g.inscriptionId);
    const s = q.trim().toLowerCase();
    if (s) out = out.filter((r) => `${r.m.name} ${r.m.plan} ${r.g.rarity} tier ${r.tier} ${r.g.height}`.toLowerCase().includes(s));
    return [...out].sort((a, b) =>
      sort === "tier" ? tr[a.tier] - tr[b.tier] || b.pw - a.pw
      : sort === "rarity" ? RA.indexOf(a.g.rarity) - RA.indexOf(b.g.rarity)
      : sort === "height" ? a.g.height - b.g.height
      : b.pw - a.pw);
  }, [rows, filter, sort, q]);

  const n = rows.length || 1;
  const avg = (k: "hp" | "bite" | "speed" | "armor") => rows.reduce((s, r) => s + r.g[k], 0) / n;
  const maxs = { hp: Math.max(1, ...rows.map((r) => r.g.hp)), bite: Math.max(1, ...rows.map((r) => r.g.bite)), speed: Math.max(1, ...rows.map((r) => r.g.speed)), armor: Math.max(1, ...rows.map((r) => r.g.armor)) };
  const rc = RA.map((r) => [r, rows.filter((x) => x.g.rarity === r).length] as const);
  const tc = (["S", "A", "B", "C", "D"] as Tier[]).map((t) => [t, rows.filter((x) => x.tier === t).length] as const);
  const plans = Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r.m.plan] = (a[r.m.plan] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const top = list[0];

  return (
    <section className="panel mt-8 overflow-hidden rounded-md border border-border border-t-2 border-t-bitcoin">
      <header className="border-b border-border p-4">
        <p className="text-[10px] tracking-[0.3em] text-signal">GUARDIAN INDEX</p>
        <p className="mt-1 text-[10px] text-muted-foreground">DNA from block hash · height · txs. Every portrait is drawn by the inscription's own voxel generator.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, body plan, tier, height…" className="mt-3 w-full rounded-sm border border-border bg-background px-3 py-2 text-xs outline-none focus:border-signal" />
        <div className="mt-3 flex gap-1">
          {(["overview", "stats", "power", "roster"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-sm border px-2 py-1.5 text-[10px] uppercase tracking-widest ${tab === t ? "border-signal/40 bg-signal/10 text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      </header>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {([["AWAKE", rows.length], ["INSCRIBED", rows.filter((r) => r.g.inscriptionId).length], ["AVG POWER", Math.round(rows.reduce((s, r) => s + r.pw, 0) / n)], ["TIER S", tc[0]?.[1] ?? 0]] as const).map(([l, v]) => (
            <div key={l} className="rounded-sm border border-border bg-background/60 p-2 text-center">
              <p className="font-display text-xl text-foreground">{v}</p><p className="text-[8px] tracking-widest text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {top && (
              <button onClick={() => onPick?.(top.g.height)} className="mt-4 flex w-full items-center gap-3 rounded-md border border-signal/30 bg-signal/5 p-3 text-left hover:border-signal/60">
                <GuardianPortrait height={top.g.height} size={64} />
                <div><p className="text-[9px] tracking-widest text-signal">TOP GUARDIAN</p><p className="font-display text-base"><GuardianName height={top.g.height} fallback={top.m.name} /></p>
                  <p className="text-[10px] text-muted-foreground">{top.g.height}.BITMAP · POWER {top.pw} · TIER {top.tier}</p></div>
              </button>
            )}
            <p className="mt-4 text-[10px] tracking-widest text-muted-foreground">RARITY</p>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full border border-border">
              {rc.map(([r, c]) => <span key={r} style={{ width: `${(c / n) * 100}%`, background: RA_COL[r] }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {rc.map(([r, c]) => <span key={r}><i className="mr-1 inline-block size-2 rounded-sm" style={{ background: RA_COL[r] }} />{r} {c}</span>)}
            </div>
          </>
        )}

        {tab === "stats" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-sm border border-border p-3"><p className="text-[10px] tracking-widest text-muted-foreground">AVERAGE PROFILE</p>
              <Radar v={[avg("hp") / maxs.hp, avg("bite") / maxs.bite, avg("speed") / maxs.speed, avg("armor") / maxs.armor]} /></div>
            <div className="rounded-sm border border-border p-3"><p className="text-[10px] tracking-widest text-muted-foreground">BODY PLANS</p>
              {plans.map(([p, c]) => (
                <div key={p} className="mt-1.5 flex items-center gap-2 text-[10px]"><span className="w-20 text-right text-muted-foreground">{p}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-signal" style={{ width: `${(c / (plans[0]?.[1] ?? 1)) * 100}%` }} /></div><span className="w-6 text-right">{c}</span></div>
              ))}
            </div>
          </div>
        )}

        {tab === "power" && (
          <div className="mt-4 space-y-1.5">
            {tc.map(([t, c]) => (
              <div key={t} className="flex items-center gap-2 text-[10px]">
                <span className="w-14 rounded-sm px-1.5 py-0.5 text-center font-bold" style={{ color: TIER_COL[t], background: `${TIER_COL[t]}22`, border: `1px solid ${TIER_COL[t]}55` }}>TIER {t}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${(c / n) * 100}%`, background: TIER_COL[t] }} /></div><span className="w-6 text-right">{c}</span>
              </div>
            ))}
            <p className="pt-2 text-[10px] text-muted-foreground">Power = HP·0.4 + Bite·0.25 + Speed·0.2 + Armor·0.15. Tier S ≥ 85 (or Mythic ≥ 70).</p>
          </div>
        )}

        {tab === "roster" && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(["all", "mythic", "epic", "inscribed"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-[10px] uppercase ${filter === f ? "border-signal/40 bg-signal/10 text-signal" : "border-border text-muted-foreground"}`}>{f}</button>
              ))}
              <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">SORT
                {(["power", "tier", "rarity", "height"] as Sort[]).map((s) => (
                  <button key={s} onClick={() => setSort(s)} className={`rounded-sm border px-2 py-0.5 uppercase ${sort === s ? "border-signal/40 text-signal" : "border-border"}`}>{s}</button>
                ))}
              </span>
            </div>
            <div className="mt-3 max-h-[480px] space-y-1 overflow-auto">
              {list.slice(0, 120).map(({ g, m, pw, tier }) => (
                <div key={g.height} className="flex items-center gap-3 rounded-md p-2 text-[11px] hover:bg-signal/5">
                  <GuardianPortrait height={g.height} size={48} />
                  <button onClick={() => onPick?.(g.height)} className="flex-1 text-left">
                    <p className="font-semibold text-foreground"><GuardianName height={g.height} fallback={m.name} /></p>
                    <p className="text-[10px] text-muted-foreground">{g.height}.BITMAP · {m.plan} · POWER {pw}</p>
                  </button>
                  <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold" style={{ color: TIER_COL[tier], border: `1px solid ${TIER_COL[tier]}55` }}>{tier}</span>
                  <span className="text-[9px]" style={{ color: RA_COL[g.rarity] }}>{g.rarity}</span>
                  {g.inscriptionId ? <Link to="/breed" search={{ sire: g.height }} className="text-[10px] text-signal hover:underline">BREED →</Link> : null}
                  <Link to="/oasis" search={{ height: g.height }} className="text-[10px] text-bitcoin hover:underline">OASIS →</Link>
                </div>
              ))}
              {!list.length && <p className="py-6 text-center text-xs text-muted-foreground">No Guardians match.</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
