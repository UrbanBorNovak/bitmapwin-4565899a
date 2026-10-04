import { useEffect, useMemo, useState } from "react";
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
  guardian?: { species: GuardianSpecies; rarity: GuardianRarity; body: string; accent: string; height?: number };
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
        guardian: { species: g.species, rarity: g.rarity, body: g.body, accent: g.accent, height: g.height },
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

  const idx = Math.max(0, rows.findIndex((r) => r.id === open));
  const cur = viewing ?? rows.find((r) => r.inscription || r.kind || r.guardian) ?? all[0];
  const max = useMemo(() => ({
    hp: Math.max(1, ...all.map((r) => r.hp)),
    xp: Math.max(1, ...all.map((r) => r.xp)),
    bite: Math.max(1, ...all.map((r) => r.bite)),
    speed: Math.max(1, ...all.map((r) => r.speed)),
  }), [all]);
  const step = (d: number) => {
    const viewable = rows.filter((r) => r.inscription || r.kind || r.guardian);
    if (!viewable.length) return;
    const i = viewable.findIndex((r) => r.id === cur?.id);
    const n = viewable[(i + d + viewable.length) % viewable.length];
    if (n) setOpen(n.id);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const threat = cur ? Math.round(((cur.hp / max.hp) * 0.4 + (cur.bite / max.bite) * 0.4 + (cur.speed / max.speed) * 0.2) * 100) : 0;
  const counts = {
    wild: all.filter((r) => r.origin === "WILDLIFE").length,
    inscribed: all.filter((r) => r.origin === "INSCRIBED" && !r.guardian).length,
    guardians: all.filter((r) => r.guardian).length,
    hostile: all.filter((r) => r.hostile).length,
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <Link to="/codex" className="label hover:text-bitcoin">← OASIS CODEX</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-signal">● LIVE DOSSIER · {all.length} ENTRIES</p>
          <h1 className="display text-3xl md:text-4xl">BESTIARY</h1>
        </div>
        <dl className="grid grid-cols-4 gap-1 font-mono text-[10px]" data-no-translate>
          <Stat k="WILD" v={counts.wild} />
          <Stat k="INSCRIBED" v={counts.inscribed} />
          <Stat k="GUARDIANS" v={counts.guardians} />
          <Stat k="HOSTILE" v={counts.hostile} />
        </dl>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* Index */}
        <aside className="panel order-2 flex flex-col rounded-md border border-border lg:order-1 lg:h-[calc(100vh-140px)] lg:sticky lg:top-20">
          <div className="space-y-2 border-b border-border p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH" className="w-full rounded border border-border bg-background px-3 py-1.5 font-mono text-[11px]" />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded border px-2 py-0.5 font-mono text-[10px] ${filter === f ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}>{f}</button>
              ))}
            </div>
          </div>
          <ul className="max-h-[420px] flex-1 overflow-y-auto lg:max-h-none">
            {rows.map((r, i) => {
              const can = !!(r.inscription || r.kind || r.guardian);
              const on = cur?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={!can}
                    onClick={() => setOpen(r.id)}
                    className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors ${on ? "border-bitcoin bg-bitcoin/10" : "border-transparent hover:bg-muted/40"} disabled:opacity-40`}
                  >
                    <span className="w-6 font-mono text-[9px] text-muted-foreground">{String(i + 1).padStart(3, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-mono text-[11px] ${on ? "text-bitcoin" : "text-foreground"}`} data-no-translate>{r.name}</span>
                      <span className="block truncate font-mono text-[9px] text-muted-foreground">{r.guardian ? "GUARDIAN" : r.origin} · {r.rarity}</span>
                    </span>
                    <span className={`size-1.5 shrink-0 rounded-full ${r.hostile ? "bg-bitcoin" : "bg-signal"}`} />
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && <li className="p-3 font-mono text-[11px] text-muted-foreground">&gt; NO CREATURE MATCHES</li>}
          </ul>
        </aside>

        {/* Center stage */}
        <section className="panel relative order-1 overflow-hidden rounded-md border border-border lg:order-2 lg:sticky lg:top-20 lg:h-[calc(100vh-140px)]">
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="absolute left-3 top-3 size-5 border-l border-t border-signal/70" />
            <div className="absolute right-3 top-3 size-5 border-r border-t border-signal/70" />
            <div className="absolute bottom-3 left-3 size-5 border-b border-l border-signal/70" />
            <div className="absolute bottom-3 right-3 size-5 border-b border-r border-signal/70" />
            <p className="absolute left-6 top-5 font-mono text-[10px] text-signal">● SPECIMEN {String(idx + 1).padStart(3, "0")} / {String(rows.length).padStart(3, "0")}</p>
            <p className="absolute right-6 top-5 font-mono text-[10px] text-muted-foreground">DRAG TO TURN · ← → TO BROWSE</p>
            <div className="absolute inset-x-0 h-px animate-[bestiary-scan_4s_linear_infinite] bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
          </div>
          <div className="h-[420px] lg:h-full">
            {cur && (cur.inscription || cur.kind || cur.guardian) ? (
              <CreatureModel3D key={cur.id} inscription={cur.inscription} kind={cur.kind} guardian={cur.guardian} yaw={cur.yaw} label={cur.name} />
            ) : (
              <div className="grid size-full place-items-center font-mono text-xs text-muted-foreground">&gt; SELECT A SPECIMEN</div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-background/90 to-transparent p-5">
            <div className="min-w-0">
              <p className={`font-mono text-[10px] ${cur?.hostile ? "text-bitcoin" : "text-signal"}`}>{cur?.hostile ? "▲ HOSTILE" : "● PEACEFUL"} · {cur?.rarity}</p>
              <h2 className="display truncate text-2xl md:text-3xl" data-no-translate>{cur?.name}</h2>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn-term-ghost" onClick={() => step(-1)} aria-label="Previous creature">←</button>
              <button type="button" className="btn-term-ghost" onClick={() => step(1)} aria-label="Next creature">→</button>
            </div>
          </div>
        </section>

        {/* Dossier */}
        <aside className="panel order-3 space-y-4 rounded-md border border-border p-4 lg:h-[calc(100vh-140px)] lg:sticky lg:top-20 lg:overflow-y-auto">
          {cur && (
            <>
              <div>
                <p className="label text-signal">{cur.guardian ? "BLOCK-DNA GUARDIAN" : cur.inscription ? "ON-CHAIN 3D MODEL" : "OASIS WILDLIFE"}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">HABITAT · {cur.habitat}</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="label">THREAT INDEX</p>
                  <p className="display text-2xl tabular-nums text-bitcoin" data-no-translate>{threat}</p>
                </div>
                <div className="mt-1 grid grid-cols-10 gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={`h-2 rounded-sm ${i < Math.round(threat / 10) ? "bg-bitcoin" : "bg-muted"}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="label">COMBAT PROFILE</p>
                <Bar k="HP" v={cur.hp} max={max.hp} />
                <Bar k="BITE" v={cur.bite} max={max.bite} />
                <Bar k="SPEED" v={cur.speed} max={max.speed} label={cur.speed.toFixed(1)} />
                <Bar k="XP REWARD" v={cur.xp} max={max.xp} />
              </div>
              {cur.guardian && (
                <div className="space-y-1 rounded border border-border p-3 font-mono text-[10px]">
                  <p className="label text-bitcoin">DNA</p>
                  <p>SPECIES · {cur.guardian.species}</p>
                  <p>RARITY · {cur.guardian.rarity}</p>
                  <p className="flex items-center gap-2">BODY <span className="size-3 rounded-sm border border-border" style={{ background: cur.guardian.body }} /> ACCENT <span className="size-3 rounded-sm border border-border" style={{ background: cur.guardian.accent }} /></p>
                  <p className="text-muted-foreground">AWAKE IN THE OASIS · TRADABLE ONLY ONCE INSCRIBED AS A CHILD OF ITS BITMAP</p>
                </div>
              )}
              <div className="space-y-2">
                {cur.height != null && (
                  <Link to="/bitmap/$block" params={{ block: String(cur.height) }} className="btn-term block text-center">VISIT {cur.height}.BITMAP →</Link>
                )}
                {cur.inscription && (
                  <a href={`https://ordinals.com/inscription/${cur.inscription}`} target="_blank" rel="noreferrer" className="btn-term-ghost block break-all text-center" data-no-translate>
                    PROOF {cur.inscription.slice(0, 8)}…{cur.inscription.slice(-4)} ↗
                  </a>
                )}
                {cur.guardian && cur.height != null ? (
                  <Link to="/oasis" search={{ height: cur.height }} className="btn-term-ghost block text-center">TRACK IN OASIS · {cur.height}.BITMAP →</Link>
                ) : (
                  <Link to="/oasis" className="btn-term-ghost block text-center">HUNT IN THE OASIS →</Link>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="mt-8"><HuntPanel /></div>
    </div>
  );
}

function Bar({ k, v, max, label }: { k: string; v: number; max: number; label?: string }) {
  return (
    <div className="font-mono text-[10px]">
      <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span data-no-translate>{label ?? v}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-muted">
        <div className="h-full bg-signal transition-all duration-700" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
      </div>
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
