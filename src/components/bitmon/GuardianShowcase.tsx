/**
 * Every awakened Guardian, shown one at a time in a single 3D viewer.
 * Only real summoned Guardians from the roster — nothing invented.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { RARITY_TONE } from "@/lib/bitmon";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";
import type { MintLang } from "@/lib/mint-lang";

const short = (a: string) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "—");

const TOUR_COPY = {
  en: {
    label: "THE LIVING ROSTER", titleA: "EVERY GUARDIAN,", titleB: "ONE BY ONE.",
    intro: "These are the real Guardians already woken by holders. Each one is read from its own block — the stats you see are the same numbers anyone gets from that block.",
    prev: "◀ PREV", next: "NEXT ▶", pause: "❚❚ PAUSE TOUR", play: "▶ PLAY TOUR", only: "ONLY INSCRIBED ON-CHAIN", guardians: "GUARDIANS",
    reading: "> READING THE ROSTER…", empty: "NO GUARDIANS MATCH YET", home: "HOME", ability: "ABILITY", summonedBy: "SUMMONED BY",
    inscribed: "◆ INSCRIBED · VIEW ON ORDINALS →", awake: "AWAKE IN THE OASIS · NOT YET INSCRIBED", full: "FULL GUARDIAN PAGE →",
    stats: { HP: "From the block's transaction count", BITE: "From block density (weight ÷ size)", SPEED: "From the block hash", ARMOR: "From block size and era" },
  },
  zh: {
    label: "已觉醒名录", titleA: "每一尊守护者，", titleB: "逐一巡礼。",
    intro: "这里展示持有者已经唤醒的真实守护者。每一尊都读取自其对应区块——你看到的数据，任何人读取同一区块都会得到相同结果。",
    prev: "◀ 上一尊", next: "下一尊 ▶", pause: "❚❚ 暂停巡礼", play: "▶ 播放巡礼", only: "仅显示链上铭刻", guardians: "尊守护者",
    reading: "> 正在读取名录…", empty: "暂无符合条件的守护者", home: "领地", ability: "能力", summonedBy: "召唤者",
    inscribed: "◆ 已铭刻 · 在 ORDINALS 查看 →", awake: "已在绿洲中觉醒 · 尚未铭刻", full: "查看完整守护者页面 →",
    stats: { HP: "来自区块交易数量", BITE: "来自区块密度（重量 ÷ 大小）", SPEED: "来自区块哈希", ARMOR: "来自区块大小与时代" },
  },
} as const;

export function GuardianShowcase({ lang = "en" }: { lang?: MintLang }) {
  const roster = useQuery(allGuardiansQuery());
  // On-chain truth for inscriptions — our own records can lag behind the chain.
  const inhabited = useQuery(inhabitedQuery());
  const [onlyInscribed, setOnlyInscribed] = useState(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const list = useMemo(
    () =>
      (roster.data ?? [])
        .map((g) => {
          const onChain = inhabited.data?.get(g.height);
          return onChain && g.inscriptionId !== onChain ? { ...g, inscriptionId: onChain } : g;
        })
        .filter((g) => !onlyInscribed || g.inscriptionId),
    [roster.data, inhabited.data, onlyInscribed],
  );
  const n = list.length;
  const g = n ? list[((i % n) + n) % n]! : null;
  const copy = TOUR_COPY[lang];

  useEffect(() => {
    if (!auto || n < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 7000);
    return () => clearInterval(t);
  }, [auto, n]);

  return (
    <section className="mt-10">
      <p className="label text-signal">{copy.label}</p>
      <h2 className="display mt-1 text-3xl">{copy.titleA} <span className="text-bitcoin">{copy.titleB}</span></h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {copy.intro}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-term-ghost" disabled={n < 2} onClick={() => { setAuto(false); setI(i - 1); }}>{copy.prev}</button>
        <button type="button" className="btn-term-ghost" disabled={n < 2} onClick={() => { setAuto(false); setI(i + 1); }}>{copy.next}</button>
        <button type="button" className="btn-term-ghost" onClick={() => setAuto(!auto)}>{auto ? copy.pause : copy.play}</button>
        <label className="label flex items-center gap-1">
          <input type="checkbox" checked={onlyInscribed} onChange={(e) => { setOnlyInscribed(e.target.checked); setI(0); }} />
          {copy.only}
        </label>
        <span className="label ml-auto">{n ? `${((i % n) + n) % n + 1} / ${n}` : "0"} {copy.guardians}</span>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="panel rounded-md border border-border">
          {g ? <GuardianTurntable key={g.height} dna={g} className="h-[440px]" /> : (
            <div className="grid h-[440px] place-items-center font-mono text-xs text-muted-foreground">
              {roster.isPending ? copy.reading : copy.empty}
            </div>
          )}
        </div>
        <aside className="panel space-y-3 rounded-md border border-border p-4">
          {g ? (
            <>
              <p className={`font-mono text-[11px] ${RARITY_TONE[g.rarity]}`}>{g.rarity} · LV {g.level}</p>
              <h3 className="display text-2xl">{g.species}</h3>
              <p className="font-mono text-xs text-bitcoin">{copy.home} · {g.height}.BITMAP</p>
              <p className="font-mono text-[11px] text-signal">{copy.ability} · {g.ability || "—"}</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                {([["HP", g.hp], ["BITE", g.bite], ["SPEED", g.speed], ["ARMOR", g.armor]] as const).map(([k, v]) => (
                  <div key={k} className="border border-border p-2">
                    <p className="text-muted-foreground">{k}</p>
                    <p className="text-lg">{v}</p>
                    <p className="text-[9px] text-muted-foreground">{copy.stats[k]}</p>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{copy.summonedBy} {short(g.owner)}</p>
              {g.inscriptionId ? (
                <a href={`https://ordinals.com/inscription/${g.inscriptionId}`} target="_blank" rel="noreferrer" className="block font-mono text-[10px] text-signal underline">{copy.inscribed}</a>
              ) : (
                <p className="font-mono text-[10px] text-muted-foreground">{copy.awake}</p>
              )}
              <Link to="/collections/guardians/$height" params={{ height: String(g.height) }} className="label block text-signal underline">{copy.full}</Link>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
