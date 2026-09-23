import type { LivingCard, PlayProfile } from "@/lib/game/types";

export function playSummary(profile: PlayProfile) {
  const cards = Object.values(profile.cards);
  const most = [...cards].sort((a, b) => b.plays - a.plays)[0];
  const strongest = [...cards].sort((a, b) => b.power + b.defense + b.experience / 10 - (a.power + a.defense + a.experience / 10))[0];
  return { cards: cards.length, most: most && most.plays > 0 ? most : null, strongest: strongest ?? null };
}

export function PlayStatsPanel({ profile, title = "MY STATS" }: { profile: PlayProfile; title?: string }) {
  const s = profile.stats;
  const sum = playSummary(profile);
  const name = (c: LivingCard | null) => (c ? c.name : "—");
  return (
    <section className="border border-border bg-card">
      <h2 className="label border-b border-border px-3 py-2 text-bitcoin">{title}</h2>
      <div className="grid grid-cols-4 border-b border-border text-center">
        {[["MATCHES", s.matches], ["WINS", s.wins], ["LOSSES", s.losses], ["STREAK", s.streak]].map(([k, v]) => (
          <div key={k} className="border-r border-border px-1 py-2 last:border-0">
            <div className="display text-lg">{v}</div>
            <div className="label text-[8px] text-muted-foreground">{k}</div>
          </div>
        ))}
      </div>
      <dl className="grid gap-1 px-3 py-2 font-mono text-[10px]">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">CARDS DISCOVERED</dt><dd>{sum.cards}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">MOST USED</dt><dd className="truncate">{name(sum.most)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">STRONGEST</dt><dd className="truncate">{name(sum.strongest)}</dd></div>
      </dl>
    </section>
  );
}
