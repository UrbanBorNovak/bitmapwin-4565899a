import { Link } from "@tanstack/react-router";
import type { LivingCard } from "@/lib/game/types";
import { combatBase, freeXp } from "@/lib/game/workshop";

/** Exact stats this card brings into a match: base + Oasis builds + workshop upgrades. */
export function MatchStats({ card, workshopLink = true }: { card: LivingCard; workshopLink?: boolean }) {
  const s = combatBase(card);
  const rows: [string, number, number, number, number][] = [
    ["POWER", card.power, s.build.atk, s.upgrades.power, s.atk],
    ["DEFENSE", card.defense, s.build.hp, s.upgrades.defense, s.hp],
    ["COST", card.energy, 0, -s.upgrades.efficiency, s.cost],
  ];
  return (
    <section className="border border-border bg-card" aria-label="Match stats">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="label">IN-MATCH STATS</h2>
        <span className="font-mono text-[10px] text-muted-foreground">{s.build.builds} OASIS BUILD{s.build.builds === 1 ? "" : "S"} · {freeXp(card)} XP TO SPEND</span>
      </div>
      <div className="label grid grid-cols-[minmax(0,1fr)_3rem_3.5rem_3.5rem_3.5rem] gap-2 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>STAT</span><span className="text-right">BASE</span><span className="text-right">BUILDS</span><span className="text-right">FORGED</span><span className="text-right">MATCH</span>
      </div>
      {rows.map(([k, base, b, f, total]) => (
        <div key={k} className="grid grid-cols-[minmax(0,1fr)_3rem_3.5rem_3.5rem_3.5rem] gap-2 border-t border-border/60 px-3 py-1.5 font-mono text-xs">
          <span>{k}</span>
          <span className="text-right text-muted-foreground">{base}</span>
          <span className={`text-right ${b ? "text-signal" : "text-muted-foreground"}`}>{b ? `+${b}` : "—"}</span>
          <span className={`text-right ${f ? "text-bitcoin" : "text-muted-foreground"}`}>{f ? (f > 0 ? `+${f}` : f) : "—"}</span>
          <span className="text-right text-bitcoin">{total}</span>
        </div>
      ))}
      <p className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
        Every Oasis build on this BITMAP adds +1 defense (max 3), every 2 builds +1 power (max 2), and unlocks another workshop level.
        {workshopLink && <> <Link to="/play/workshop" search={{ card: card.id }} className="text-bitcoin">OPEN WORKSHOP →</Link></>}
      </p>
    </section>
  );
}
