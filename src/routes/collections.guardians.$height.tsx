import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { guardianQuery, guardianDnaQuery } from "@/lib/bitmon-queries";
import { guardianFromBlock, esploraFetch, fetchBlockDnaSource, SPECIES, type GuardianDna } from "@/lib/bitmon";
import { guardianLevel } from "@/lib/bitmon";
import { formatBytes, shortId, timeAgoFromUnix } from "@/lib/chain";
import { CreatureModel3D } from "@/components/codex/CreatureModel3D";

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

export const Route = createFileRoute("/collections/guardians/$height")({
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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <Link to="/collections/guardians" className="label text-muted-foreground hover:text-foreground">← ALL GUARDIANS</Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="display text-3xl md:text-4xl" data-no-translate>{height}.BITMAP GUARDIAN</h1>
        {blood ? <span className="label border border-destructive px-2 py-0.5 text-destructive">BLOOD MOON BLOCK</span> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[420px_1fr]">
        {/* 3D + inscription */}
        <div>
          <div className="aspect-square w-full border border-border bg-background">
            {dna ? (
              <CreatureModel3D
                guardian={{ species: dna.species, rarity: dna.rarity, body: dna.body, accent: dna.accent, height: dna.height }}
                label={`${dna.species} · ${dna.height}.BITMAP`}
              />
            ) : (
              <p className="label grid size-full place-items-center p-4 text-center text-muted-foreground">
                {facts.isPending ? "READING THE BLOCK…" : facts.isError ? "BLOCK NOT FOUND" : "…"}
              </p>
            )}
          </div>
          {awakened.data?.inscriptionId ? (
            <div className="mt-3 border border-border bg-card/60 p-2 backdrop-blur">
              <div className="label mb-1 text-muted-foreground">ON-CHAIN INSCRIPTION</div>
              <iframe
                src={`https://ordinals.com/preview/${awakened.data.inscriptionId}`}
                title={`Guardian inscription ${shortId(awakened.data.inscriptionId)}`}
                loading="lazy"
                sandbox="allow-scripts"
                className="aspect-square w-full border-0 bg-muted"
              />
              <a
                href={`https://ordinals.com/inscription/${awakened.data.inscriptionId}`}
                target="_blank"
                rel="noreferrer"
                className="label mt-1 inline-block text-bitcoin hover:underline"
                data-no-translate
              >
                {shortId(awakened.data.inscriptionId)} ↗
              </a>
            </div>
          ) : (
            <p className="label mt-3 text-muted-foreground">
              {awakened.isPending ? "CHECKING INSCRIPTION…" : "NOT INSCRIBED ON CHAIN YET — APP-ONLY UNTIL A DELEGATE MINT CONFIRMS"}
            </p>
          )}
        </div>

        {/* Facts */}
        <div className="space-y-4">
          {dna ? (
            <div className="border border-border bg-card/60 p-3 backdrop-blur">
              <div className="flex flex-wrap items-baseline gap-2" data-no-translate>
                <span className="display text-xl">{dna.species}</span>
                <span className="label text-bitcoin">{dna.rarity} · LV {level}</span>
              </div>
              <div className="label mt-1 text-bitcoin" data-no-translate>{dna.ability}</div>
              <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-xs" data-no-translate>
                {([["HP", dna.hp], ["BITE", dna.bite], ["SPEED", dna.speed], ["ARMOR", dna.armor]] as const).map(([k, v]) => (
                  <div key={k} className="border border-border p-2">
                    <div className="label text-muted-foreground">{k}</div>
                    <div className="mt-1 text-lg text-foreground">{v}</div>
                  </div>
                ))}
              </div>
              <div className="label mt-2 text-muted-foreground" data-no-translate>DNA {dna.dnaHash} · ERA {dna.epoch}</div>
            </div>
          ) : null}

          {/* Block facts */}
          <div className="border border-border bg-card/60 p-3 backdrop-blur" data-no-translate>
            <div className="label text-muted-foreground">BLOCK FACTS</div>
            {facts.data ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs md:grid-cols-3">
                <div><dt className="label text-muted-foreground">HEIGHT</dt><dd className="text-foreground">{facts.data.height}</dd></div>
                <div><dt className="label text-muted-foreground">MINED</dt><dd className="text-foreground">{timeAgoFromUnix(facts.data.timestamp)}</dd></div>
                <div><dt className="label text-muted-foreground">TXS</dt><dd className="text-foreground">{facts.data.txCount.toLocaleString()}</dd></div>
                <div>
                  <dt className="label text-muted-foreground">DIFFICULTY</dt>
                  <dd className="text-foreground">{(facts.data.difficulty / 1e12).toFixed(2)}T · {armorClass(facts.data.difficulty)}</dd>
                </div>
                <div>
                  <dt className="label text-muted-foreground">WEIGHT</dt>
                  <dd className="text-foreground">{formatBytes(facts.data.weight)} · {massClass(facts.data.weight)}</dd>
                </div>
                <div><dt className="label text-muted-foreground">SIZE</dt><dd className="text-foreground">{formatBytes(facts.data.size)}</dd></div>
                <div className="col-span-2 md:col-span-3">
                  <dt className="label text-muted-foreground">HASH</dt>
                  <dd className="break-all text-foreground">{facts.data.hash}</dd>
                </div>
                {crests.length ? (
                  <div className="col-span-2 md:col-span-3">
                    <dt className="label text-muted-foreground">FORK CRESTS</dt>
                    <dd className="text-signal">{crests.join(" · ")}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="label mt-2 text-muted-foreground">{facts.isPending ? "READING…" : "UNAVAILABLE"}</p>
            )}
          </div>

          {/* Live pulse cycle */}
          <div className="border border-border bg-card/60 p-3 backdrop-blur" data-no-translate>
            <div className="flex items-baseline justify-between">
              <div className="label text-muted-foreground">COSMIC PULSE · 4S CYCLE</div>
              <div className="label text-signal">LIVE</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-4">
              {PULSE_PHASES.map((name, i) => (
                <div
                  key={name}
                  className={`border p-2 text-center font-mono text-[10px] ${i === phase ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}
                >
                  {i + 1} · {name}
                </div>
              ))}
            </div>
            <div className="mt-2 h-1.5 w-full border border-border bg-background">
              <div className="h-full bg-signal transition-none" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="label mt-1 text-muted-foreground">
              PHASE {phase + 1}/4 · {(PULSE_MS / 1000 - progress * (PULSE_MS / 1000)).toFixed(1)}S TO NEXT
            </div>
          </div>

          {/* Ownership / awakened state */}
          <div className="border border-border bg-card/60 p-3 backdrop-blur" data-no-translate>
            <div className="label text-muted-foreground">SUMMON STATE</div>
            {awakened.data ? (
              <div className="mt-2 font-mono text-xs">
                <div className="text-foreground">AWAKENED BY {short(awakened.data.owner)}</div>
                <div className="label mt-1 text-muted-foreground">SUMMON TX {shortId(awakened.data.txid)} · {new Date(awakened.data.createdAt).toLocaleDateString()}</div>
              </div>
            ) : (
              <p className="label mt-2 text-muted-foreground">{awakened.isPending ? "CHECKING…" : "NOT SUMMONED YET"}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/bitmap/$block" params={{ block: String(height) }} className="btn-term-ghost">OPEN BITMAP</Link>
              <Link to="/oasis" search={{ height }} className="btn-term-ghost">FIND IN OASIS</Link>
              <Link to="/mint" className="btn-term-ghost">SUMMON</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
