import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BOSSES, RARITY_COLOR, STRIKE_COOLDOWN_MIN } from "@/lib/epic-bosses";
import { bossesStateFn, strikeBossFn } from "@/lib/epic-bosses.functions";
import { RaidSquad } from "@/components/command/RaidSquad";

export function BossRaids({ guardians }: { guardians: { height: number }[] }) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["epic-bosses"], queryFn: () => bossesStateFn(), refetchInterval: 15_000 });
  const strike = useServerFn(strikeBossFn);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const g = pick ?? guardians[0]?.height ?? null;
  const st = new Map((state.data?.bosses ?? []).map((b) => [b.slug, b]));

  async function hit(slug: string) {
    if (g == null) return;
    setBusy(slug);
    try {
      const r = await strike({ data: { height: g, boss: slug } });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`#${g} hit for ${r.damage} (${r.hits} hits) · took ${r.counter}${r.killed ? " · BOSS SLAIN" : ""}`);
        for (const l of r.loot.filter((l) => l.guardian === g)) toast(`LOOT: ${l.item}${l.bit ? ` +${l.bit} BIT` : ""}`);
      }
      qc.invalidateQueries({ queryKey: ["epic-bosses"] });
      qc.invalidateQueries({ queryKey: ["raid-squad", slug] });
    } finally { setBusy(null); }
  }

  return (
    <section className="mt-12">
      <h2 className="text-[10px] tracking-[0.3em] text-signal">EPIC & RAID BOSSES</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Send a Guardian to strike. Every Guardian can strike once per {STRIKE_COOLDOWN_MIN} min; when a boss falls, loot is split by damage dealt — the top hitter takes the boss jewel, BIT lands on each Guardian's BITMAP.
      </p>
      {guardians.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
          {guardians.map((x) => (
            <button key={x.height} onClick={() => setPick(x.height)}
              className={`border px-2 py-1 ${x.height === g ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
              #{x.height}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {BOSSES.map((b) => {
          const s = st.get(b.slug);
          const hp = s?.hp ?? b.maxHp;
          const pct = Math.max(0, Math.min(100, (hp / b.maxHp) * 100));
          return (
            <div key={b.slug} className="border border-border bg-background/70 p-3 backdrop-blur">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-base text-foreground">{b.name}</p>
                <span className={`text-[9px] tracking-[0.2em] ${b.tier === "epic" ? "text-bitcoin" : "text-signal"}`}>{b.tier.toUpperCase()} · LV {b.level}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{b.lair} · drops {b.jewel}</p>
              <div className="mt-2 h-1.5 w-full bg-muted"><div className="h-full bg-bitcoin" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{s?.respawnAt ? `RESPAWNS ${new Date(s.respawnAt).toLocaleString()}` : `${hp} / ${b.maxHp} HP`}</span>
                <span>{s?.kills ?? 0} kills</span>
              </div>
              <button disabled={g == null || !!s?.respawnAt || busy === b.slug} onClick={() => hit(b.slug)}
                className="mt-2 w-full border border-bitcoin px-2 py-1 text-[10px] tracking-[0.2em] text-bitcoin hover:bg-bitcoin/10 disabled:opacity-40">
                {busy === b.slug ? "STRIKING…" : g == null ? "SUMMON A GUARDIAN FIRST" : `STRIKE WITH #${g}`}
              </button>
              <RaidSquad boss={b.slug} guardian={g} mine={guardians.map((x) => x.height)} />
            </div>
          );
        })}
      </div>
      <h3 className="mt-6 text-[10px] tracking-[0.3em] text-signal">RECENT LOOT</h3>
      <div className="mt-2 grid gap-1 text-xs">
        {(state.data?.loot ?? []).length === 0 && <p className="text-muted-foreground">No boss has fallen yet.</p>}
        {(state.data?.loot ?? []).map((l) => (
          <p key={l.id}><span className="text-muted-foreground">#{l.guardian_height} ·</span> <span className={RARITY_COLOR[l.rarity]}>{l.item}</span> <span className="text-muted-foreground">from {BOSSES.find((b) => b.slug === l.boss_slug)?.name}</span></p>
        ))}
      </div>
    </section>
  );
}
