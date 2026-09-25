import { Link } from "@tanstack/react-router";
import { Activity, ChevronRight, Shield, Swords, Zap } from "lucide-react";
import { CARD_EVOLUTION_STATES, cardStateRank, nextEvolutionMilestone, nextLearningMilestone } from "@/lib/game/growth";
import type { LivingCard } from "@/lib/game/types";

export function PassportCardGrowth({ cards }: { cards: LivingCard[] }) {
  return (
    <div className="grid gap-px bg-[var(--passport-line)] sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <GrowthRecord key={card.id} card={card} />)}
    </div>
  );
}

function GrowthRecord({ card }: { card: LivingCard }) {
  const currentRank = cardStateRank(card.state);
  return (
    <article className="min-w-0 bg-[var(--passport-panel)] p-4">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--passport-line)] pb-3">
        <div className="min-w-0">
          <p className="passport-kicker">{card.type} · {card.bitmap.toLocaleString("en-US")}.BITMAP</p>
          <h3 className="mt-1 truncate font-mono text-base font-bold uppercase text-[var(--passport-paper)]">{card.name}</h3>
        </div>
        <span className="shrink-0 border border-[var(--passport-gold)] px-2 py-1 font-mono text-[9px] text-[var(--passport-gold)]">{card.state}</span>
      </header>

      <div className="mt-4 grid grid-cols-5 gap-1" aria-label={`Evolution path. Current state: ${card.state}`}>
        {CARD_EVOLUTION_STATES.map((state, index) => (
          <div key={state} className="min-w-0">
            <div className={`h-1 ${index <= currentRank ? "bg-[var(--passport-gold)]" : "bg-[var(--passport-line)]"}`} />
            <span className={`mt-1 block truncate font-mono text-[7px] ${index === currentRank ? "text-[var(--passport-gold)]" : index < currentRank ? "text-[var(--passport-paper)]" : "text-[var(--passport-muted)]"}`} title={state}>{state.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[9px] text-[var(--passport-muted)]">NEXT EVOLUTION · {nextEvolutionMilestone(card)}</p>

      <dl className="mt-4 grid grid-cols-4 gap-px bg-[var(--passport-line)]">
        <GrowthMetric icon={<Swords />} value={card.power} label="POWER" />
        <GrowthMetric icon={<Shield />} value={card.defense} label="DEFENSE" />
        <GrowthMetric icon={<Zap />} value={card.energy} label="ENERGY" />
        <GrowthMetric icon={<Activity />} value={card.activity} label="ACTIVITY" />
      </dl>
      <dl className="mt-px grid grid-cols-3 gap-px bg-[var(--passport-line)]">
        <GrowthMetric value={card.experience} label="XP" />
        <GrowthMetric value={card.matches} label="MATCHES" />
        <GrowthMetric value={card.wins} label="WINS" />
      </dl>

      <div className="mt-4">
        <p className="passport-kicker">TRAITS</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {card.traits.map((trait) => <span key={trait} className="border border-[var(--passport-line)] px-1.5 py-1 font-mono text-[8px] text-[var(--passport-paper)]">{trait}</span>)}
        </div>
      </div>
      <div className="mt-4">
        <p className="passport-kicker">LEARNED ADAPTATIONS</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {card.learning.adaptations.length ? card.learning.adaptations.map((adaptation) => (
            <span key={adaptation} className="border border-[var(--passport-gold)] px-1.5 py-1 font-mono text-[8px] text-[var(--passport-gold)]">{adaptation.replace(/_/g, " ")}</span>
          )) : <span className="font-mono text-[9px] text-[var(--passport-muted)]">NONE LEARNED YET</span>}
        </div>
        <p className="mt-2 font-mono text-[9px] text-[var(--passport-muted)]">NEXT LESSON · {nextLearningMilestone(card)}</p>
      </div>

      <Link to="/play/card/$id" params={{ id: String(card.bitmap) }} className="passport-text-link inline-flex items-center gap-1">
        OPEN FULL RECORD <ChevronRight className="size-3" />
      </Link>
    </article>
  );
}

function GrowthMetric({ icon, value, label }: { icon?: React.ReactNode; value: number; label: string }) {
  return (
    <div className="min-w-0 bg-[var(--passport-panel)] p-2">
      <dd className="flex items-center gap-1 font-mono text-sm font-bold text-[var(--passport-paper)] [&>svg]:size-3 [&>svg]:text-[var(--passport-gold)]">{icon}{value}</dd>
      <dt className="mt-1 truncate font-mono text-[7px] text-[var(--passport-muted)]">{label}</dt>
    </div>
  );
}