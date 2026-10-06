import { useEffect, useState } from "react";
import { MUTATIONS, loadoutFor, mutationFor, writeSeasonOverride, type MutationId } from "@/lib/guardian-mutations";
import { useSeasonOverride } from "@/components/bitmon/GuardianGear";

const PREVIEW: MutationId[] = ["HALLOWEEN", "WHITEPAPER", "WINTER", "GENESIS", "PIZZA", "BLOOD_MOON", "HALVING_EVE"];

export function SeasonalMutationPanel({ height, seed }: { height: number; seed: string }) {
  const override = useSeasonOverride();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const live = now ? mutationFor(height, now) : MUTATIONS.NONE;
  const shown = mutationFor(height, now ?? new Date(0), override);
  const gear = loadoutFor(seed, height);
  return (
    <section className="rounded-md border border-border bg-card/60 p-4 backdrop-blur">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground">TEMPORAL CHAMBER · SEASONAL MUTATIONS</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="font-display text-xl text-bitcoin">{shown.label}</span>
        {override ? <span className="font-mono text-[10px] text-signal">PREVIEW ON THIS DEVICE</span> : <span className="font-mono text-[10px] text-signal">LIVE TODAY</span>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{shown.blurb}</p>
      <p className="mt-3 font-mono text-[11px] text-foreground">
        GADGETS · HEAD {gear.head} · BACK {gear.back}{gear.drone ? " · SCOUT DRONE" : ""}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground">Gadgets come from the block hash. Seasons follow the calendar (UTC). Looks only — stats never change.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={() => writeSeasonOverride(null)} className={`rounded-sm border px-2 py-1 font-mono text-[10px] ${!override ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
          TODAY · {live.label}
        </button>
        {PREVIEW.map((id) => (
          <button key={id} onClick={() => writeSeasonOverride(id)} className={`rounded-sm border px-2 py-1 font-mono text-[10px] ${override === id ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {MUTATIONS[id].label}
          </button>
        ))}
      </div>
    </section>
  );
}
