import { Link } from "@tanstack/react-router";
import { activePfpExtenderForCard } from "@/lib/game/pfpExtenders";
import type { LivingCard, PlayVisualSettings } from "@/lib/game/types";

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
          NEXT · {card.plays < 3 ? `${3 - card.plays} MORE PLAY${3 - card.plays === 1 ? "" : "S"} FOR TYPE ADAPTATION` : card.learning.actions < 8 ? `${8 - card.learning.actions} MORE ACTION${8 - card.learning.actions === 1 ? "" : "S"} FOR BATTLE TESTED` : card.wins < 3 ? `${3 - card.wins} MORE WIN${3 - card.wins === 1 ? "" : "S"} FOR VETERAN` : "CONTINUE TOWARD LEGENDARY"}
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
