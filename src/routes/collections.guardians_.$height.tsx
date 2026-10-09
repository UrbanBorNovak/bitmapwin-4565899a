import { createFileRoute, Link } from "@tanstack/react-router";
import { SeasonalMutationPanel } from "@/components/bitmon/SeasonalMutationPanel";
import { useEffect, useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { allGuardiansQuery, guardianQuery } from "@/lib/bitmon-queries";
import { guardianFromBlock, esploraFetch, RARITY_TONE, type GuardianDna } from "@/lib/bitmon";
import { guardianLevel } from "@/lib/bitmon";
import { formatBytes, shortId, timeAgoFromUnix } from "@/lib/chain";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";
import { morphFromDna } from "@/lib/creature-morph";

/** The shared 4-second cosmic pulse the V7 master runs on. */
const PULSE_MS = 4000;
const PULSE_PHASES = ["EYE FLARE", "PARCEL SHOCKWAVE", "ROAR + LIGHTNING", "SPINE CURRENT"] as const;

/** Blood Moon is a deterministic block-height event in the V7 master. */
const isBloodMoon = (height: number) => height % 144 === 0;

type BlockFacts = {
  height: number;
  hash: string;
  txCount: number;
  size: number;
  weight: number;
  timestamp: number;
  difficulty: number;
};

const blockFactsQuery = (height: number) =>
  queryOptions({
    queryKey: ["block-facts", height],
    queryFn: async (): Promise<BlockFacts> => {
      const hash = (await (await esploraFetch(`/block-height/${height}`)).text()).trim();
      const b = (await (await esploraFetch(`/block/${hash}`)).json()) as {
        tx_count: number;
        size: number;
        weight: number;
        timestamp: number;
        difficulty: number;
      };
      return { height, hash, txCount: b.tx_count, size: b.size, weight: b.weight, timestamp: b.timestamp, difficulty: b.difficulty };
    },
    staleTime: Infinity,
    retry: 1,
  });

/** Difficulty-derived armor class, matching the V7 thermodynamic density trait. */
function armorClass(difficulty: number): string {
  const t = difficulty / 1e12;
  if (t >= 100) return "ADAMANT";
  if (t >= 10) return "FORTIFIED";
  if (t >= 1) return "PLATED";
  return "LIGHT";
}

/** Weight-derived mass class: ultra-dense Titan vs ethereal Wraith. */
function massClass(weight: number): string {
  if (weight >= 3_900_000) return "TITAN";
  if (weight <= 500_000) return "WRAITH";
  return "STANDARD";
}

function forkCrests(height: number): string[] {
  const crests: string[] = [];
  if (height >= 709_632) crests.push("TAPROOT");
  else if (height >= 481_824) crests.push("SEGWIT");
  return crests;
}

function usePulse() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const phase = Math.floor((now % (PULSE_MS * PULSE_PHASES.length)) / PULSE_MS);
  const progress = (now % PULSE_MS) / PULSE_MS;
  return { phase, progress };
}

export const Route = createFileRoute("/collections/guardians_/$height")({
  head: ({ params }) => {
    const title = `Guardian of ${params.height}.BITMAP — BITMAPWIN`;
    const desc = `Block-DNA Guardian of block ${params.height}: inscription, difficulty, weight and live pulse cycle.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: GuardianDetails,
});

const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function GuardianDetails() {
  const { height: heightParam } = Route.useParams();
  const height = Number(heightParam);
  const valid = Number.isInteger(height) && height >= 0 && height < 1_000_000;

  const facts = useQuery({ ...blockFactsQuery(height), enabled: valid });
  const dna: GuardianDna | null = useMemo(
    () => (facts.data ? guardianFromBlock({ ...facts.data }) : null),
    [facts.data],
  );
  const awakened = useQuery({ ...guardianQuery(height), enabled: valid });
  const all = useQuery(allGuardiansQuery());
  const [view, setView] = useState<"3D" | "INSCRIPTION">("3D");
  const { phase, progress } = usePulse();

  if (!valid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="label text-destructive">NOT A VALID BLOCK HEIGHT</p>
        <Link to="/collections/guardians" className="btn-term-ghost mt-4 inline-block">← ALL GUARDIANS</Link>
      </div>
    );
  }

  const level = dna ? guardianLevel(dna) : null;
  const blood = isBloodMoon(height);
  const crests = forkCrests(height);
  const morph = dna ? morphFromDna(dna) : null;
  const heights = [...new Set((all.data ?? []).map((g) => g.height))].sort((a, b) => a - b);
  const idx = heights.indexOf(height);
  const prev = idx > 0 ? heights[idx - 1] : heights.length && idx < 0 ? heights[heights.length - 1] : undefined;
  const next = idx >= 0 && idx < heights.length - 1 ? heights[idx + 1] : undefined;
  const stats = dna ? ([["HP", dna.hp], ["BITE", dna.bite], ["SPEED", dna.speed], ["ARMOR", dna.armor]] as const) : [];
  const peak = Math.max(100, ...stats.map(([, v]) => Number(v) || 0));
  const role = dna ? combatRole(dna) : null;
  const inscriptionId = awakened.data?.inscriptionId ?? null;

  return (
    <div className="relative">
      {/* Atmospheric hero backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-24 size-[620px] -translate-x-1/2 rounded-full bg-bitcoin/10 blur-3xl" />
        <div className="absolute right-[10%] top-10 size-[280px] rounded-full bg-signal/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
        <nav className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <Link to="/collections/guardians" className="text-muted-foreground hover:text-foreground">← ALL GUARDIANS</Link>
          <div className="flex items-center gap-2">
            {prev !== undefined ? <Link to="/collections/guardians/$height" params={{ height: String(prev) }} className="btn-term-ghost px-2 py-1">‹ {prev}</Link> : null}
            {heights.length ? <span className="text-muted-foreground">{idx >= 0 ? `${idx + 1} / ${heights.length}` : `${heights.length} AWAKE`}</span> : null}
            {next !== undefined ? <Link to="/collections/guardians/$height" params={{ height: String(next) }} className="btn-term-ghost px-2 py-1">{next} ›</Link> : null}
          </div>
        </nav>

        {/* Title block */}
        <header className="mt-6">
          <p className="label text-signal">BLOCK-DNA GUARDIAN · READ FROM BITCOIN</p>
          <h1 className="display mt-2 text-4xl leading-none md:text-6xl" data-no-translate>
            {morph ? morph.name : <span className="animate-pulse text-muted-foreground">READING…</span>}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" data-no-translate>
            <span className="rounded-sm border border-bitcoin/60 bg-bitcoin/10 px-2 py-0.5 text-bitcoin">{height}.BITMAP</span>
            {dna ? <span className={`rounded-sm border border-border px-2 py-0.5 ${RARITY_TONE[dna.rarity]}`}>{dna.rarity}</span> : null}
            {dna ? <span className="rounded-sm border border-border px-2 py-0.5 text-foreground">LV {level} · ERA {dna.epoch}</span> : null}
            {role ? <span className="rounded-sm border border-signal/50 px-2 py-0.5 text-signal">{role}</span> : null}
            {crests.map((c) => <span key={c} className="rounded-sm border border-signal/40 px-2 py-0.5 text-signal">{c} CREST</span>)}
            {blood ? <span className="rounded-sm border border-destructive px-2 py-0.5 text-destructive">BLOOD MOON</span> : null}
            {inscriptionId ? <span className="rounded-sm border border-signal px-2 py-0.5 text-signal">● INSCRIBED</span>
              : awakened.data ? <span className="rounded-sm border border-bitcoin/50 px-2 py-0.5 text-bitcoin">● AWAKE</span>
              : <span className="rounded-sm border border-border px-2 py-0.5 text-muted-foreground">○ DORMANT</span>}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* 3D stage */}
          <section className="panel relative overflow-hidden rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[10px]">
              <span className="text-signal">● LIVE STAGE</span>
              <div className="flex gap-1">
                {(["3D", "INSCRIPTION"] as const).map((v) => (
                  <button key={v} type="button" disabled={v === "INSCRIPTION" && !inscriptionId} onClick={() => setView(v)}
                    className={`rounded-sm border px-2 py-0.5 transition-colors disabled:opacity-40 ${view === v ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {v === "3D" ? "3D MODEL" : "ON-CHAIN"}
                  </button>
                ))}
              </div>
            </div>
            {view === "INSCRIPTION" && inscriptionId ? (
              <iframe src={`https://ordinals.com/preview/${inscriptionId}`} title={`Guardian inscription ${shortId(inscriptionId)}`}
                loading="lazy" sandbox="allow-scripts" className="h-[460px] w-full border-0 bg-background md:h-[560px]" />
            ) : dna ? (
              <GuardianTurntable dna={dna} className="h-[460px] md:h-[560px] border-0" />
            ) : (
              <div className="grid h-[460px] place-items-center font-mono text-xs text-muted-foreground md:h-[560px]">
                {facts.isError ? "✕ BLOCK NOT FOUND" : <span className="animate-pulse">&gt; READING BLOCK DNA…</span>}
              </div>
            )}
            {/* Pulse ticker */}
            <div className="border-t border-border px-3 py-2" data-no-translate>
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-muted-foreground">COSMIC PULSE · <span className="text-bitcoin">{PULSE_PHASES[phase]}</span></span>
                <span className="text-signal">{(PULSE_MS / 1000 - progress * (PULSE_MS / 1000)).toFixed(1)}S</span>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {PULSE_PHASES.map((n, i) => (
                  <div key={n} className="h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-signal" style={{ width: i < phase ? "100%" : i === phase ? `${Math.round(progress * 100)}%` : "0%" }} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Combat HUD */}
          <div className="space-y-4">
            <section className="panel rounded-md border border-border p-4" data-no-translate>
              <p className="label text-muted-foreground">COMBAT READINESS</p>
              {dna ? (
                <>
                  <p className="mt-1 font-mono text-[11px] text-signal">ABILITY · {dna.ability}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{dna.species} LINE{morph ? ` · ${morph.plan} · ${morph.code}` : ""}</p>
                  <div className="mt-4 space-y-3">
                    {stats.map(([k, v]) => (
                      <div key={k}>
                        <div className="flex items-baseline justify-between font-mono">
                          <span className="text-[10px] text-muted-foreground">{k}</span>
                          <span className="text-xl font-bold text-foreground">{v}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-bitcoin shadow-[0_0_12px_color-mix(in_oklab,var(--bitcoin)_70%,transparent)] transition-all duration-1000"
                            style={{ width: `${Math.min(100, (Number(v) / peak) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">DNA {dna.dnaHash}</p>
                </>
              ) : <p className="mt-2 animate-pulse font-mono text-xs text-muted-foreground">READING…</p>}
            </section>
            {morph ? <SeasonalMutationPanel height={height} seed={morph.seed} /> : null}


            <section className="panel rounded-md border border-border p-4" data-no-translate>
              <p className="label text-muted-foreground">PROVENANCE</p>
              {awakened.data ? (
                <div className="mt-2 space-y-1 font-mono text-xs">
                  <p className="text-foreground">AWAKENED BY <span className="text-bitcoin">{short(awakened.data.owner)}</span></p>
                  <p className="text-[10px] text-muted-foreground">SUMMON TX {shortId(awakened.data.txid)} · {new Date(awakened.data.createdAt).toLocaleDateString()}</p>
                  {inscriptionId ? (
                    <a href={`https://ordinals.com/inscription/${inscriptionId}`} target="_blank" rel="noreferrer" className="inline-block text-[11px] text-signal hover:underline">
                      INSCRIPTION {shortId(inscriptionId)} ↗
                    </a>
                  ) : <p className="text-[10px] text-muted-foreground">NOT INSCRIBED YET — APP-ONLY UNTIL THE HOLDER INSCRIBES IT</p>}
                </div>
              ) : <p className="mt-2 font-mono text-xs text-muted-foreground">{awakened.isPending ? "CHECKING…" : "NOT SUMMONED YET — THIS GUARDIAN IS STILL DORMANT IN ITS BLOCK"}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {awakened.data ? (
                  <>
                    <Link to="/oasis" search={{ height }} className="btn-term py-2 text-center">FIND IN OASIS</Link>
                    <Link to="/command" className="btn-term-ghost py-2 text-center">COMMAND</Link>
                  </>
                ) : (
                  <Link to="/mint" search={{ height }} className="btn-term col-span-2 py-2 text-center">◆ SUMMON THIS GUARDIAN</Link>
                )}
                <Link to="/bitmap/$block" params={{ block: String(height) }} className="btn-term-ghost py-2 text-center">OPEN BITMAP</Link>
                {facts.data ? <a href={`https://mempool.space/block/${facts.data.hash}`} target="_blank" rel="noreferrer" className="btn-term-ghost py-2 text-center">BLOCK ↗</a> : null}
              </div>
            </section>
          </div>
        </div>

        {/* Block matrix */}
        <section className="panel mt-5 rounded-md border border-border" data-no-translate>
          <div className="border-b border-border px-4 py-2"><p className="label text-muted-foreground">BLOCK MATRIX · WHERE EVERY TRAIT COMES FROM</p></div>
          {facts.data ? (
            <dl className="grid grid-cols-2 divide-border md:grid-cols-6 md:divide-x">
              {([
                ["HEIGHT", facts.data.height.toLocaleString()],
                ["MINED", timeAgoFromUnix(facts.data.timestamp)],
                ["TRANSACTIONS", facts.data.txCount.toLocaleString()],
                ["DIFFICULTY", `${(facts.data.difficulty / 1e12).toFixed(2)}T · ${armorClass(facts.data.difficulty)}`],
                ["WEIGHT", `${formatBytes(facts.data.weight)} · ${massClass(facts.data.weight)}`],
                ["SIZE", formatBytes(facts.data.size)],
              ] as const).map(([k, v]) => (
                <div key={k} className="border-b border-border p-4 md:border-b-0">
                  <dt className="label text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-mono text-sm text-foreground">{v}</dd>
                </div>
              ))}
              <div className="col-span-2 border-t border-border p-4 md:col-span-6">
                <dt className="label text-muted-foreground">BLOCK HASH</dt>
                <dd className="mt-1 break-all font-mono text-xs text-bitcoin">{facts.data.hash}</dd>
              </div>
            </dl>
          ) : <p className="p-4 font-mono text-xs text-muted-foreground">{facts.isPending ? "READING…" : "UNAVAILABLE"}</p>}
        </section>
      </div>
    </div>
  );
}

/** Role label from the Guardian's strongest real stat. */
function combatRole(d: GuardianDna): string {
  const top = ([["HEAVY VANGUARD", d.armor], ["APEX STRIKER", d.bite], ["AGILE RAIDER", d.speed], ["IRON WARDEN", d.hp]] as const)
    .reduce((a, b) => (Number(b[1]) > Number(a[1]) ? b : a));
  return top[0];
}
