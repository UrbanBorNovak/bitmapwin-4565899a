import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, Coins, Compass, Cpu, Hammer, KeyRound, Swords, UserRound } from "lucide-react";
import { timeAgo } from "@/lib/bitmap";
import { eventHref, type ProvenanceEvent } from "@/lib/passport";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
import { shortenAddress } from "@/lib/registry";

/**
 * WORLD PULSE — the live signal panel.
 *
 * Every row is a real persisted provenance record. Nothing here is generated:
 * the panel only reshapes what the stream already returns so a visitor can read
 * kind, place, actor and age at a glance instead of a wall of repeated text.
 */

type Channel = { key: string; label: string; types: readonly string[] };

const CHANNELS: readonly Channel[] = [
  { key: "all", label: "ALL SIGNAL", types: [] },
  { key: "visit", label: "ARRIVALS", types: ["visit"] },
  { key: "build", label: "BUILDS", types: ["build"] },
  { key: "deployment", label: "EXTENDERS", types: ["deployment"] },
  { key: "trade", label: "CHAIN SALES", types: ["trade"] },
  { key: "combat", label: "DUELS", types: ["combat", "lease"] },
];

const KIND = {
  visit: { icon: Compass, tone: "signal", word: "ARRIVAL" },
  build: { icon: Hammer, tone: "bitcoin", word: "BUILD" },
  deployment: { icon: Cpu, tone: "signal", word: "EXTENDER" },
  trade: { icon: Coins, tone: "bitcoin", word: "CHAIN SALE" },
  combat: { icon: Swords, tone: "bitcoin", word: "DUEL" },
  lease: { icon: KeyRound, tone: "signal", word: "BUILD RIGHTS" },
} as const;

function kindOf(event: ProvenanceEvent) {
  return KIND[event.eventType as keyof typeof KIND] ?? { icon: Activity, tone: "signal" as const, word: "RECORD" };
}

/** Heartbeat trace drawn from the real record ages in the window. */
function PulseTrace({ events }: { events: ProvenanceEvent[] }) {
  const path = useMemo(() => {
    const slots = 28;
    const now = Date.now();
    const span = 24 * 3600_000;
    const buckets = new Array<number>(slots).fill(0);
    for (const event of events) {
      const age = now - new Date(event.occurredAt).getTime();
      if (age < 0 || age > span) continue;
      const slot = slots - 1 - Math.min(slots - 1, Math.floor((age / span) * slots));
      buckets[slot] += 1;
    }
    const peak = Math.max(1, ...buckets);
    return buckets
      .map((count, index) => {
        const x = (index / (slots - 1)) * 100;
        const y = 22 - (count / peak) * 18;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [events]);

  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden className="h-6 w-28 shrink-0 sm:w-40">
      <path d="M0 23 L100 23" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LiveBeacon() {
  return (
    <span aria-hidden className="relative grid size-3 place-items-center">
      <span className="absolute size-3 animate-ping rounded-full bg-signal/60" />
      <span className="size-1.5 rounded-full bg-signal" />
    </span>
  );
}

function PulseRow({ event }: { event: ProvenanceEvent }) {
  const kind = kindOf(event);
  const Icon = kind.icon;
  const accent = kind.tone === "bitcoin" ? "text-bitcoin" : "text-signal";
  const frame =
    kind.tone === "bitcoin"
      ? "border-bitcoin/45 bg-bitcoin/10 text-bitcoin"
      : "border-signal/45 bg-signal/10 text-signal";

  return (
    <Link
      to={eventHref(event)}
      className="group relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-border px-3 py-3.5 transition-colors hover:bg-surface sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:px-4"
    >
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center border ${frame}`}>
        <Icon className="size-4" />
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`label text-[9px] ${accent}`}>{kind.word}</span>
          <span aria-hidden className="h-px w-3 bg-border" />
          <span className="display truncate text-sm">{event.title}</span>
        </span>

        <span className="mt-1.5 block break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {event.summary}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-2">
          {event.bitmapHeight !== null ? (
            <span className="label border border-border px-1.5 py-0.5 text-[8px]" data-no-translate>
              #{event.bitmapHeight.toLocaleString("en-US")}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground" data-no-translate>
            <UserRound className="size-3" aria-hidden />
            {event.actorWallet ? shortenAddress(event.actorWallet) : "VERIFIED ACCOUNT"}
          </span>
          <span
            className={`label border px-1.5 py-0.5 text-[8px] ${
              event.proofLevel === "CHAIN" ? "border-bitcoin/50 text-bitcoin" : "border-signal/40 text-signal"
            }`}
          >
            {event.proofLevel}
          </span>
        </span>
      </span>

      <span className="col-start-2 flex items-center gap-2 font-mono text-[9px] text-muted-foreground sm:col-start-3 sm:justify-end">
        <time dateTime={event.occurredAt} data-no-translate>{timeAgo(event.occurredAt)}</time>
        <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </span>
    </Link>
  );
}

export function WorldPulse({ limit = 24, visible = 8 }: { limit?: number; visible?: number }) {
  const [channel, setChannel] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const stream = useQuery(provenanceStreamQuery("all", limit));
  const events = stream.data ?? [];

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: events.length };
    for (const item of CHANNELS) {
      if (item.key === "all") continue;
      map[item.key] = events.filter((event) => item.types.includes(event.eventType)).length;
    }
    return map;
  }, [events]);

  const active = CHANNELS.find((item) => item.key === channel) ?? CHANNELS[0];
  const filtered = active.types.length ? events.filter((event) => active.types.includes(event.eventType)) : events;
  const shown = expanded ? filtered : filtered.slice(0, visible);

  return (
    <section className="glass-panel mt-10 border border-border" aria-label="World pulse">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="size-4 shrink-0 text-signal" aria-hidden />
          <h2 className="display text-xl">WORLD PULSE</h2>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <LiveBeacon />
            <span className="label text-[9px] text-signal">LIVE</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-signal">
          <PulseTrace events={events} />
          <Link to="/stream" className="label text-bitcoin hover:text-foreground">
            FULL STREAM →
          </Link>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2" role="tablist">
        {CHANNELS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={channel === item.key}
            onClick={() => {
              setChannel(item.key);
              setExpanded(false);
            }}
            className={channel === item.key ? "btn-term shrink-0 text-[9px]" : "btn-term-ghost shrink-0 text-[9px]"}
          >
            {item.label} <span data-no-translate>{counts[item.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {stream.isPending ? (
        <p className="p-5 font-mono text-xs text-muted-foreground">&gt; READING WORLD HISTORY…</p>
      ) : shown.length ? (
        <>
          <div>
            {shown.map((event) => (
              <PulseRow key={event.id} event={event} />
            ))}
          </div>
          {filtered.length > visible ? (
            <div className="px-4 py-3">
              <button type="button" onClick={() => setExpanded((value) => !value)} className="btn-term-ghost text-[9px]">
                {expanded ? "[ SHOW LESS ]" : `[ SHOW ALL ${filtered.length} RECORDS ]`}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="p-5 label">NO RECORDS ON THIS CHANNEL YET — ENTER THE OASIS AND MAKE HISTORY.</p>
      )}
    </section>
  );
}
