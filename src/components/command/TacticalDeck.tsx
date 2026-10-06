import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { resolveRaid, type Fighter } from "@/lib/guardian-raid";
import { MAX_RANGE, cellDistance } from "@/lib/guardian-dispatch";

type G = { height: number; species: string; rarity: string; level: number; hp: number; bite: number; armor: number; speed: number };

export function combatRole(g: Pick<G, "hp" | "bite" | "armor" | "speed">) {
  const s = [["APEX STRIKER", g.bite * 2], ["IRON WARDEN", g.armor * 2], ["AGILE RAIDER", g.speed * 2], ["HEAVY VANGUARD", g.hp / 5]] as const;
  return [...s].sort((a, b) => b[1] - a[1])[0]![0];
}

/** Replays the real deterministic raid formula over 64 seeds — an estimate, not a promise. */
export function raidOdds(a: Fighter, d: Fighter) {
  let w = 0;
  for (let i = 0; i < 64; i++) if (resolveRaid(a, d, `odds:${a.height}:${d.height}:${i}`).winner === a.height) w++;
  return Math.round((w / 64) * 100);
}

const fighter = (g: G): Fighter => ({ height: g.height, hp: g.hp, bite: g.bite, armor: g.armor, speed: g.speed });

/** Guarded BITMAPs within march range of `me`, ranked by estimated win chance. */
export function TargetRadar({ me, all, onPick }: { me: G; all: G[]; onPick: (h: number) => void }) {
  const targets = useMemo(
    () =>
      all
        .filter((t) => t.height !== me.height && cellDistance(me.height, t.height) <= MAX_RANGE)
        .map((t) => ({ t, dist: cellDistance(me.height, t.height), odds: raidOdds(fighter(me), fighter(t)) }))
        .sort((a, b) => b.odds - a.odds)
        .slice(0, 8),
    [me, all],
  );
  return (
    <div className="mt-3 border border-signal/30 bg-signal/5 p-3">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-signal">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-signal" /></span>
        TARGET RADAR · GUARDED BITMAPS ≤ {MAX_RANGE} AWAY
      </div>
      {targets.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">No guarded BITMAPs within range. Patrol or Auto-Farm instead.</p>
      ) : (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {targets.map(({ t, dist, odds }) => (
            <li key={t.height}>
              <button onClick={() => onPick(t.height)} className="flex w-full items-center gap-2 border border-border bg-background/60 px-2 py-1.5 text-left text-[11px] hover:border-bitcoin">
                <span className="text-bitcoin">{t.height}</span>
                <span className="truncate text-muted-foreground">{t.species} · {combatRole(t)}</span>
                <span className="ml-auto text-muted-foreground">{dist}▸</span>
                <span className={`w-12 text-right ${odds >= 60 ? "text-signal" : odds >= 40 ? "text-foreground" : "text-destructive"}`}>{odds}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[9px] text-muted-foreground">Win % replays the real raid formula 64 times with both Guardians' block stats. Click a target to set the march.</p>
    </div>
  );
}

type Round = { round: number; by: number; damage: number; attackerHp?: number; defenderHp?: number };

/** Round-by-round battle replay with HP bars. */
export function BattleReport({ r, maxHp }: { r: { id: string; attacker_height: number; defender_height: number; winner_height: number; spoils: number; log: unknown; resolved_at: string }; maxHp: (h: number) => number | undefined }) {
  const log = (Array.isArray(r.log) ? r.log : []) as Round[];
  const [step, setStep] = useState(log.length);
  const aMax = maxHp(r.attacker_height) ?? Math.max(1, ...log.map((x) => x.attackerHp ?? 0));
  const dMax = maxHp(r.defender_height) ?? Math.max(1, ...log.map((x) => x.defenderHp ?? 0));
  const cur = log[step - 1];
  const aHp = cur?.attackerHp ?? aMax, dHp = cur?.defenderHp ?? dMax;
  const bar = (hp: number, max: number, win: boolean) => (
    <div className="h-1.5 bg-border"><div className={`h-1.5 transition-all duration-300 ${win ? "bg-signal" : "bg-bitcoin"}`} style={{ width: `${Math.max(0, Math.min(100, (hp / max) * 100))}%` }} /></div>
  );
  const peak = Math.max(0, ...log.map((x) => x.damage));
  return (
    <article className="border border-border bg-card/40 p-3 text-xs backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">{new Date(r.resolved_at).toLocaleString()}</span>
        <span className="text-signal">WINNER {r.winner_height}.BITMAP · +{r.spoils} BIT</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <Link to="/bitmap/$block" params={{ block: String(r.attacker_height) }} className="text-bitcoin">{r.attacker_height} · RAIDER</Link>
          {bar(aHp, aMax, r.winner_height === r.attacker_height)}
          <p className="mt-0.5 text-[10px] text-muted-foreground">{aHp}/{aMax} HP</p>
        </div>
        <span className="font-display text-muted-foreground">VS</span>
        <div className="text-right">
          <Link to="/bitmap/$block" params={{ block: String(r.defender_height) }} className="text-bitcoin">DEFENDER · {r.defender_height}</Link>
          {bar(dHp, dMax, r.winner_height === r.defender_height)}
          <p className="mt-0.5 text-[10px] text-muted-foreground">{dHp}/{dMax} HP</p>
        </div>
      </div>
      {log.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <input type="range" min={0} max={log.length} value={step} onChange={(e) => setStep(Number(e.target.value))} className="flex-1 accent-[var(--signal)]" aria-label="Replay round" />
          <span className="w-40 text-right text-[10px] text-muted-foreground">
            {cur ? `R${cur.round} · ${cur.by} ${cur.damage ? `HITS ${cur.damage}${cur.damage === peak ? " · CRIT" : ""}` : "MISSES"}` : "START"}
          </span>
        </div>
      )}
    </article>
  );
}
