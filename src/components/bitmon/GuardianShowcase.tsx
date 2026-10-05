/**
 * Every awakened Guardian, shown one at a time in a single 3D viewer.
 * Only real summoned Guardians from the roster — nothing invented.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { RARITY_TONE } from "@/lib/bitmon";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";

const short = (a: string) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "—");

export function GuardianShowcase() {
  const roster = useQuery(allGuardiansQuery());
  const [onlyInscribed, setOnlyInscribed] = useState(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const list = useMemo(
    () => (roster.data ?? []).filter((g) => !onlyInscribed || g.inscriptionId),
    [roster.data, onlyInscribed],
  );
  const n = list.length;
  const g = n ? list[((i % n) + n) % n]! : null;

  useEffect(() => {
    if (!auto || n < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 7000);
    return () => clearInterval(t);
  }, [auto, n]);

  return (
    <section className="mt-10">
      <p className="label text-signal">THE LIVING ROSTER</p>
      <h2 className="display mt-1 text-3xl">EVERY GUARDIAN, <span className="text-bitcoin">ONE BY ONE.</span></h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        These are the real Guardians already woken by holders. Each one is read from its own block — the stats you see are the same numbers anyone gets from that block.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-term-ghost" disabled={n < 2} onClick={() => { setAuto(false); setI(i - 1); }}>◀ PREV</button>
        <button type="button" className="btn-term-ghost" disabled={n < 2} onClick={() => { setAuto(false); setI(i + 1); }}>NEXT ▶</button>
        <button type="button" className="btn-term-ghost" onClick={() => setAuto(!auto)}>{auto ? "❚❚ PAUSE TOUR" : "▶ PLAY TOUR"}</button>
        <label className="label flex items-center gap-1">
          <input type="checkbox" checked={onlyInscribed} onChange={(e) => { setOnlyInscribed(e.target.checked); setI(0); }} />
          ONLY INSCRIBED ON-CHAIN
        </label>
        <span className="label ml-auto">{n ? `${((i % n) + n) % n + 1} / ${n}` : "0"} GUARDIANS</span>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="panel rounded-md border border-border">
          {g ? <GuardianTurntable key={g.height} dna={g} className="h-[440px]" /> : (
            <div className="grid h-[440px] place-items-center font-mono text-xs text-muted-foreground">
              {roster.isPending ? "> READING THE ROSTER…" : "NO GUARDIANS MATCH YET"}
            </div>
          )}
        </div>
        <aside className="panel space-y-3 rounded-md border border-border p-4">
          {g ? (
            <>
              <p className={`font-mono text-[11px] ${RARITY_TONE[g.rarity]}`}>{g.rarity} · LV {g.level}</p>
              <h3 className="display text-2xl">{g.species}</h3>
              <p className="font-mono text-xs text-bitcoin">HOME · {g.height}.BITMAP</p>
              <p className="font-mono text-[11px] text-signal">ABILITY · {g.ability || "—"}</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                {([["HP", g.hp, "From the block's transaction count"], ["BITE", g.bite, "From block density (weight ÷ size)"], ["SPEED", g.speed, "From the block hash"], ["ARMOR", g.armor, "From block size and era"]] as const).map(([k, v, why]) => (
                  <div key={k} className="border border-border p-2">
                    <p className="text-muted-foreground">{k}</p>
                    <p className="text-lg">{v}</p>
                    <p className="text-[9px] text-muted-foreground">{why}</p>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">SUMMONED BY {short(g.owner)}</p>
              {g.inscriptionId ? (
                <a href={`https://ordinals.com/inscription/${g.inscriptionId}`} target="_blank" rel="noreferrer" className="block font-mono text-[10px] text-signal underline">◆ INSCRIBED · VIEW ON ORDINALS →</a>
              ) : (
                <p className="font-mono text-[10px] text-muted-foreground">AWAKE IN THE OASIS · NOT YET INSCRIBED</p>
              )}
              <Link to="/collections/guardians/$height" params={{ height: String(g.height) }} className="label block text-signal underline">FULL GUARDIAN PAGE →</Link>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
