import { Link } from "@tanstack/react-router";
import { activePfpExtenderForCard } from "@/lib/game/pfpExtenders";
import { nextLearningMilestone } from "@/lib/game/growth";
import type { CardGrowthSnapshot, CardHistoryEntry, LivingCard, PlayVisualSettings } from "@/lib/game/types";

const fmt = (t: number | null) => (t ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export function CardHistory({ card }: { card: LivingCard }) {
  const rows: [string, string][] = [
    ["BORN", `Block ${card.blockHeight.toLocaleString("en-US")}`],
    ["DISCOVERED", fmt(card.discoveredAt)],
    ["FIRST PLAY", fmt(card.firstPlayAt)],
    ["MATCHES", String(card.matches)],
    ["WINS", String(card.wins)],
    ["EXPERIENCE", `${card.experience} XP`],
    ["REMEMBERED ACTIONS", String(card.learning.actions)],
    ["ATTACKS", String(card.learning.attacks)],
    ["ABILITY USES", String(card.learning.abilityUses)],
    ["LAST EVENT", card.lastEvent.replace(/_/g, " ")],
    ["CURRENT STATE", card.state],
  ];
  return (
    <section className="border border-border bg-card">
      <h2 className="label border-b border-border px-3 py-2 text-bitcoin">CARD HISTORY</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-3 py-3 font-mono text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border px-3 py-3">
        <h3 className="label text-signal">LEARNED ADAPTATIONS</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {card.learning.adaptations.length ? card.learning.adaptations.map((adaptation) => (
            <span key={adaptation} className="border border-signal/50 px-1.5 py-1 font-mono text-[9px] text-signal">{adaptation.replace(/_/g, " ")}</span>
          )) : <span className="font-mono text-[9px] text-muted-foreground">PLAY THIS CARD TO TEACH IT</span>}
        </div>
        <p className="mt-2 font-mono text-[9px] text-muted-foreground">
          NEXT · {nextLearningMilestone(card)}
        </p>
      </div>
      <ol className="max-h-56 overflow-y-auto border-t border-border">
        {[...card.history].reverse().map((h, i) => (
          <li key={i} className="flex justify-between gap-3 border-b border-border/60 px-3 py-1.5 font-mono text-[10px]">
            <span>{h.note}</span>
            <span className="shrink-0 text-muted-foreground">{fmt(h.at)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const currentGrowth = (card: LivingCard): CardGrowthSnapshot => ({
  state: card.state,
  traits: card.traits,
  power: card.power,
  defense: card.defense,
  energy: card.energy,
  activity: card.activity,
  experience: card.experience,
  plays: card.plays,
  wins: card.wins,
  buildCount: card.facts.buildCount,
});

function growthChanges(current: CardGrowthSnapshot, previous?: CardGrowthSnapshot) {
  if (!previous) return [];
  const changes: string[] = [];
  if (current.state !== previous.state) changes.push(`${previous.state} → ${current.state}`);
  for (const trait of current.traits) if (!previous.traits.includes(trait)) changes.push(`+ ${trait} TRAIT`);
  const metrics: [keyof Pick<CardGrowthSnapshot, "power" | "defense" | "activity" | "experience" | "plays" | "wins">, string][] = [
    ["power", "POWER"], ["defense", "DEFENSE"], ["activity", "ACTIVITY"],
    ["experience", "XP"], ["plays", "PLAYS"], ["wins", "WINS"],
  ];
  for (const [key, label] of metrics) {
    const delta = current[key] - previous[key];
    if (delta !== 0) changes.push(`${delta > 0 ? "+" : ""}${delta} ${label}`);
  }
  if (current.buildCount !== previous.buildCount && current.buildCount !== null) changes.push(`${current.buildCount} OASIS BUILD${current.buildCount === 1 ? "" : "S"}`);
  return changes;
}

function GrowthStats({ growth }: { growth: CardGrowthSnapshot }) {
  return (
    <dl className="mt-2 grid grid-cols-4 gap-px bg-border sm:grid-cols-7">
      {([
        ["POWER", growth.power], ["DEF", growth.defense], ["ACT", growth.activity], ["XP", growth.experience],
        ["PLAYS", growth.plays], ["WINS", growth.wins], ["BUILDS", growth.buildCount ?? "—"],
      ] as const).map(([label, value]) => (
        <div key={label} className="bg-card px-2 py-1.5">
          <dt className="font-mono text-[8px] text-muted-foreground">{label}</dt>
          <dd className="font-mono text-[11px] text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CardGrowthTimeline({ card }: { card: LivingCard }) {
  const snapshotEntries = card.history.filter((entry): entry is CardHistoryEntry & { growth: CardGrowthSnapshot } => Boolean(entry.growth));
  const points = snapshotEntries.map((entry, index) => ({
    entry,
    changes: growthChanges(entry.growth, snapshotEntries[index - 1]?.growth),
  })).reverse();
  const live = currentGrowth(card);
  const latest = snapshotEntries.at(-1)?.growth;
  const liveChanges = growthChanges(live, latest);
  const currentIsRecorded = latest && JSON.stringify(latest) === JSON.stringify(live);

  return (
    <section className="border border-border bg-card" aria-labelledby="growth-timeline-title">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 id="growth-timeline-title" className="label text-bitcoin">LIVE GROWTH TIMELINE</h2>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">PLAY + OASIS BUILD MEMORY</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-signal"><span className="size-1.5 bg-signal" />LIVE · {card.state}</span>
      </header>
      <ol className="relative px-3 py-3 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-border">
        {!currentIsRecorded && (
          <li className="relative pb-4 pl-7">
            <span className="absolute left-0 top-1 size-3 border border-signal bg-card" />
            <div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="label text-signal">CURRENT SIGNAL</strong><span className="font-mono text-[9px] text-muted-foreground">NOW</span></div>
            {liveChanges.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{liveChanges.map((change) => <span key={change} className="border border-signal/50 px-1.5 py-0.5 font-mono text-[8px] text-signal">{change}</span>)}</div>}
            <GrowthStats growth={live} />
          </li>
        )}
        {points.map(({ entry, changes }, index) => (
          <li key={`${entry.at}-${entry.kind}-${index}`} className="relative pb-4 pl-7 last:pb-0">
            <span className={`absolute left-0 top-1 size-3 border bg-card ${index === 0 ? "border-bitcoin" : "border-border"}`} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="font-mono text-[10px] text-foreground">{entry.note}</strong>
              <time className="font-mono text-[9px] text-muted-foreground" dateTime={new Date(entry.at).toISOString()}>{fmt(entry.at)}</time>
            </div>
            {changes.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{changes.map((change) => <span key={change} className="border border-bitcoin/50 px-1.5 py-0.5 font-mono text-[8px] text-bitcoin">{change}</span>)}</div>}
            <div className="mt-1 flex flex-wrap gap-1">{entry.growth.traits.map((trait) => <span key={trait} className="font-mono text-[8px] text-muted-foreground">#{trait}</span>)}</div>
            <GrowthStats growth={entry.growth} />
          </li>
        ))}
        {points.length === 0 && (
          <li className="relative pl-7">
            <span className="absolute left-0 top-1 size-3 border border-signal bg-card" />
            <strong className="label text-signal">CURRENT RECORD</strong>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">Earlier events predate growth snapshots. New play and build moments will appear here live.</p>
            <GrowthStats growth={live} />
          </li>
        )}
      </ol>
    </section>
  );
}

/** Keeps the three data layers visibly separate. */
export function CardDataLayers({ card, visuals }: { card: LivingCard; visuals?: PlayVisualSettings | null }) {
  const f = card.facts;
  const extender = activePfpExtenderForCard(card, visuals);
  return (
    <section className="grid gap-px border border-border bg-border md:grid-cols-3">
      <div className="bg-card p-3">
        <h3 className="label text-signal">REAL WORLD DATA</h3>
        <dl className="mt-2 space-y-1 font-mono text-[10px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">BLOCK</dt><dd>{f.height.toLocaleString("en-US")}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">OASIS BUILDS</dt><dd>{f.buildCount === null ? "NOT READ YET" : f.buildCount}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">YOUR LAND</dt><dd>{f.ownedByPlayer ? "YES" : "—"}</dd></div>
        </dl>
        {f.source === "unavailable" && <p className="mt-2 font-mono text-[9px] text-muted-foreground">BITMAP DATA UNAVAILABLE — only the height is known.</p>}
      </div>
      <div className="bg-card p-3">
        <h3 className="label text-foreground">DERIVED TRAITS</h3>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Calculated from the block height and world records. Not on-chain.</p>
        <div className="mt-2 flex flex-wrap gap-1">{card.traits.map((t) => <span key={t} className="border border-border px-1.5 font-mono text-[9px]">{t}</span>)}</div>
      </div>
      <div className="bg-card p-3">
        <h3 className="label text-bitcoin">GAME STATE</h3>
        <dl className="mt-2 space-y-1 font-mono text-[10px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">STATE</dt><dd>{card.state}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">POWER / DEF / COST</dt><dd>{card.power} / {card.defense} / {card.energy}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">ACTIVITY</dt><dd>{card.activity}</dd></div>
        </dl>
        <div className="mt-3 border-t border-border pt-2">
          <h3 className="label text-signal">VISUAL EXTENDER</h3>
          {extender ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {extender.name} · {extender.source === "ordinals-image" ? "CHILD IMAGE" : "HTML INSCRIPTION"} · cosmetic only
              {extender.bitmap ? ` · ${extender.bitmap}.BITMAP` : ""}
            </p>
          ) : (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">BASE BITMAP PATTERN</p>
          )}
          <Link to="/play/extenders" className="label mt-2 inline-flex hover:text-bitcoin">MANAGE PFP EXTENDERS →</Link>
        </div>
      </div>
    </section>
  );
}
