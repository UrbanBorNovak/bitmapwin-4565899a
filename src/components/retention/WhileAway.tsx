import { useEffect, useState } from "react";

type Raid = { id: string; attacker_height: number; defender_height: number; winner_height: number; spoils: number; resolved_at: string };
const KEY = "bw:command:lastSeen";

/** "While you were away" — raids your Guardians fought since your last visit (device-local bookmark). */
export function WhileAway({ raids, mine }: { raids: Raid[]; mine: number[] }) {
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    const prev = Number(localStorage.getItem(KEY) ?? 0);
    setSince(prev || Date.now() - 86_400_000);
    return () => localStorage.setItem(KEY, String(Date.now()));
  }, []);
  if (since === null || mine.length === 0) return null;
  const set = new Set(mine);
  const ours = raids.filter((r) => new Date(r.resolved_at).getTime() > since && (set.has(r.attacker_height) || set.has(r.defender_height)));
  const won = ours.filter((r) => set.has(r.winner_height));
  const spoils = won.reduce((s, r) => s + Number(r.spoils), 0);
  const defended = won.filter((r) => set.has(r.defender_height)).length;
  return (
    <section className="mt-8 border border-signal/40 bg-card/40 p-4 backdrop-blur" aria-label="While you were away">
      <p className="text-[10px] tracking-[0.3em] text-signal">WHILE YOU WERE AWAY · SINCE {new Date(since).toLocaleString()}</p>
      {ours.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Quiet watch — no raids touched your Guardians. Deploy one on patrol to start earning spoils.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {([["BATTLES", ours.length], ["WON", won.length], ["DEFENDED", defended], ["SPOILS", `+${spoils} BIT`]] as const).map(([l, v]) => (
            <div key={l} className="bg-background/80 px-3 py-2">
              <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{l}</p>
              <p className="font-display text-xl text-bitcoin">{v}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
