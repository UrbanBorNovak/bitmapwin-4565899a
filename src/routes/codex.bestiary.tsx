import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CREATURE_GROUPS, SPECIES, type CritterKind } from "@/lib/bestiary";
import { CreatureModel3D } from "@/components/codex/CreatureModel3D";
import { HuntPanel } from "@/components/codex/HuntPanel";
import { useQuery } from "@tanstack/react-query";
import { WORLD_CREATURES } from "@/lib/creature-codex";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import type { GuardianRarity, GuardianSpecies } from "@/lib/bitmon";

export const Route = createFileRoute("/codex/bestiary")({
  head: () => ({
    meta: [
      { title: "Bestiary — Every Creature in the Oasis" },
      { name: "description", content: "Every creature that roams the Oasis: desert wildlife and inscribed on-chain characters, with health, reward, bite and how rare each sighting is." },
      { property: "og:title", content: "Oasis Bestiary — every creature, traced" },
      { property: "og:description", content: "Health, reward, bite and rarity for every creature in the Oasis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bestiary,
});

type Row = {
  id: string;
  name: string;
  origin: "WILDLIFE" | "INSCRIBED";
  hostile: boolean;
  hp: number;
  xp: number;
  bite: number;
  speed: number;
  rarity: string;
  habitat: string;
  inscription?: string;
  kind?: CritterKind;
  yaw?: number | undefined;
  /** Guardians render their procedural body and link to their home BITMAP. */
  height?: number;
  guardian?: { species: GuardianSpecies; rarity: GuardianRarity; body: string; accent: string };
};

const totalWeight = SPECIES.reduce((s, x) => s + x.weight, 0);

const ROWS: Row[] = [
  ...SPECIES.map((s): Row => {
    const pct = (s.weight / totalWeight) * 100;
    return {
      id: s.kind,
      kind: s.kind,
      name: s.kind === "coyote" ? "WIGGLY" : s.kind.toUpperCase(),
      origin: "WILDLIFE",
      // Wiggly the coyote wears the on-chain jackal model.
      ...(s.kind === "coyote"
        ? {
            inscription: "5252a0717cf8c23055b2558585fb24d4038a6281f7d51be4edadb9e16829d46ci0",
            yaw: Math.PI,
          }
        : {}),
      hostile: s.hostile,
      hp: s.hp,
      xp: s.xp,
      bite: s.bite,
      speed: s.speed,
      rarity: pct >= 10 ? "COMMON" : pct >= 3 ? "UNCOMMON" : pct >= 0.5 ? "RARE" : "MYTHIC",
      habitat: s.kind === "vulture" ? "DESERT SKY" : "OPEN DESERT",
    };
  }),
  ...CREATURE_GROUPS.map((g): Row => ({
    id: g.id,
    name: g.label,
    origin: "INSCRIBED",
    hostile: g.hostile,
    hp: g.hp,
    xp: g.xp,
    bite: g.bite,
    speed: g.speed,
    rarity: g.solo ? "ONE OF ONE" : g.count === 0 ? "DORMANT" : g.count <= 3 ? "RARE" : "UNCOMMON",
    habitat: g.airborne ? "SKY" : g.water ? "WATER'S EDGE" : "OASIS",
    inscription: g.inscription,
    yaw: g.modelYaw,
  })),
  ...WORLD_CREATURES.map((c): Row => ({ ...c, origin: "INSCRIBED" })),
];

const FILTERS = ["ALL", "WILDLIFE", "INSCRIBED", "HOSTILE", "PEACEFUL"] as const;

function Bestiary() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(ROWS[0]?.id ?? null);
  const { data: guardians = [] } = useQuery(allGuardiansQuery());
  // Every awakened Guardian joins the codex as soon as it is summoned.
  const all = useMemo<Row[]>(
    () => [
      ...ROWS,
      ...guardians.map((g): Row => ({
        id: `guardian-${g.height}`,
        name: `${g.species} · ${g.height}`,
        origin: "INSCRIBED",
        hostile: false,
        hp: g.hp,
        xp: 0,
        bite: g.bite,
        speed: g.speed,
        rarity: `GUARDIAN · ${g.rarity}`,
        habitat: `PATROLS ${g.height}.BITMAP`,
        height: g.height,
        guardian: { species: g.species, rarity: g.rarity, body: g.body, accent: g.accent },
      })),
    ],
    [guardians],
  );
  const viewing = all.find((r) => r.id === open && (r.inscription || r.kind || r.guardian));
  const rows = useMemo(
    () =>
      all.filter((r) =>
        filter === "ALL" ? true : filter === "HOSTILE" ? r.hostile : filter === "PEACEFUL" ? !r.hostile : r.origin === filter,
      )
        .filter((r) => r.name.includes(q.trim().toUpperCase()))
        .sort((a, b) => b.xp - a.xp),
    [filter, q, all],
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <Link to="/codex" className="label hover:text-bitcoin">← OASIS CODEX</Link>
      <h1 className="display mt-2 text-3xl md:text-4xl">BESTIARY</h1>
      <p className="label mt-2">{all.length} CREATURES · READ FROM THE SAME TABLES THE OASIS SPAWNS FROM</p>
      <HuntPanel />

      {viewing && (
        <section className="mt-6 grid overflow-hidden rounded-md border border-border bg-card/60 backdrop-blur md:grid-cols-[1.4fr_1fr]">
          <div className="h-72 md:h-96">
            <CreatureModel3D key={viewing.id} inscription={viewing.inscription} kind={viewing.kind} guardian={viewing.guardian} yaw={viewing.yaw} label={viewing.name} />
          </div>
          <div className="border-t border-border p-5 md:border-l md:border-t-0">
            <p className="label text-signal">{viewing.inscription ? "ON-CHAIN 3D MODEL" : "OASIS WILDLIFE MODEL"} · DRAG TO TURN</p>
            <h2 className="display mt-1 text-2xl" data-no-translate>{viewing.name}</h2>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{viewing.rarity} · {viewing.habitat}</p>
            <dl className="mt-4 grid grid-cols-4 gap-1 font-mono text-[10px]">
              <Stat k="HP" v={viewing.hp} />
              <Stat k="XP" v={viewing.xp} />
              <Stat k="BITE" v={viewing.bite} />
              <Stat k="SPD" v={viewing.speed.toFixed(1)} />
            </dl>
{viewing.inscription && (
            <a href={`https://ordinals.com/inscription/${viewing.inscription}`} target="_blank" rel="noreferrer" className="mt-4 block break-all font-mono text-[10px] text-muted-foreground hover:text-bitcoin" data-no-translate>
              INSCRIPTION {viewing.inscription.slice(0, 10)}…{viewing.inscription.slice(-4)} ↗
            </a>
            )}
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-3 py-1 font-mono text-[11px] ${filter === f ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SEARCH"
          className="ml-auto w-40 rounded border border-border bg-background px-3 py-1 font-mono text-[11px]"
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <article key={r.id} className="flex gap-4 rounded-md border border-border bg-card/60 p-4 backdrop-blur">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded border border-border bg-background">
              {r.height != null && !r.guardian ? (
                <Link to="/bitmap/$block" params={{ block: String(r.height) }} className="grid size-full place-items-center font-mono text-[10px] text-signal hover:text-bitcoin">
                  VISIT
                </Link>
              ) : (
                <button onClick={() => setOpen(r.id)} className={`size-full font-mono text-[10px] ${open === r.id ? "text-bitcoin" : "text-signal hover:text-bitcoin"}`}>
                  {open === r.id ? "VIEWING" : "VIEW 3D"}
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="display truncate text-base" data-no-translate>{r.name}</h2>
                <span className={`font-mono text-[10px] ${r.hostile ? "text-bitcoin" : "text-signal"}`}>
                  {r.hostile ? "HOSTILE" : "PEACEFUL"}
                </span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{r.origin} · {r.rarity} · {r.habitat}</p>
              <dl className="mt-2 grid grid-cols-4 gap-1 font-mono text-[10px]">
                <Stat k="HP" v={r.hp} />
                <Stat k="XP" v={r.xp} />
                <Stat k="BITE" v={r.bite} />
                <Stat k="SPD" v={r.speed.toFixed(1)} />
              </dl>
            </div>
          </article>
        ))}
      </div>
      {rows.length === 0 && <p className="mt-6 font-mono text-[11px] text-muted-foreground">&gt; NO CREATURE MATCHES</p>}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="rounded border border-border px-1.5 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
