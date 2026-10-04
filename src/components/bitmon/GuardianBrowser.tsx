/**
 * Browse everyone's Guardians: the live awakened roster plus a preview of the
 * Guardian any block would summon. One 3D viewer is mounted at a time.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery, guardianDnaQuery } from "@/lib/bitmon-queries";
import { SPECIES, type GuardianRarity } from "@/lib/bitmon";
import { CreatureModel3D } from "@/components/codex/CreatureModel3D";

const RARITIES: GuardianRarity[] = ["MYTHIC", "EPIC", "RARE", "COMMON"];
const PAGE = 24;
const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export function GuardianBrowser() {
  const roster = useQuery(allGuardiansQuery());
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<GuardianRarity | "ALL">("ALL");
  const [species, setSpecies] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [probe, setProbe] = useState("");
  const probeHeight = /^\d{1,7}$/.test(probe) ? Number(probe) : null;
  const preview = useQuery({ ...guardianDnaQuery(probeHeight ?? 0), enabled: probeHeight !== null });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (roster.data ?? []).filter(
      (g) =>
        (rarity === "ALL" || g.rarity === rarity) &&
        (species === "ALL" || g.species === species) &&
        (!term || String(g.height).includes(term) || g.owner.toLowerCase().includes(term)),
    );
  }, [roster.data, q, rarity, species]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice(page * PAGE, page * PAGE + PAGE);
  const cur = (roster.data ?? []).find((g) => g.height === selected) ?? null;
  const shown = probeHeight !== null && preview.data ? preview.data : cur;

  return (
    <section className="mt-12">
      <h2 className="display text-xl">BROWSE EVERY GUARDIAN</h2>
      <p className="label mt-1 text-muted-foreground">
        EVERY AWAKENED GUARDIAN, WHOEVER SUMMONED IT · OR PREVIEW THE GUARDIAN ANY BLOCK WOULD SUMMON
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="BLOCK OR OWNER"
              className="w-44 border border-border bg-background px-2 py-1 font-mono text-xs"
            />
            <select value={rarity} onChange={(e) => { setRarity(e.target.value as GuardianRarity | "ALL"); setPage(0); }} className="border border-border bg-background px-2 py-1 font-mono text-xs">
              <option value="ALL">ALL RARITIES</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={species} onChange={(e) => { setSpecies(e.target.value); setPage(0); }} className="border border-border bg-background px-2 py-1 font-mono text-xs">
              <option value="ALL">ALL SPECIES</option>
              {SPECIES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <span className="label ml-auto self-center">{list.length} FOUND · PAGE {page + 1}/{pages}</span>
            <button type="button" className="btn-term-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>PREV</button>
            <button type="button" className="btn-term-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>NEXT</button>
          </div>

          {roster.isPending ? <p className="label mt-4 text-muted-foreground">READING THE ROSTER…</p> : null}
          {!roster.isPending && list.length === 0 ? <p className="label mt-4 text-muted-foreground">NO GUARDIANS MATCH</p> : null}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {view.map((g) => (
              <button
                key={g.height}
                type="button"
                onClick={() => { setSelected(g.height); setProbe(""); }}
                className={`border p-2 text-left backdrop-blur transition-colors ${selected === g.height && probeHeight === null ? "border-bitcoin bg-card" : "border-border bg-card/60 hover:border-signal"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 shrink-0 border border-border" style={{ background: g.body }} />
                  <span className="font-mono text-xs text-foreground" data-no-translate>{g.height}.BITMAP</span>
                </div>
                <div className="label mt-1 truncate text-bitcoin">{g.species}</div>
                <div className="label text-muted-foreground" data-no-translate>{g.rarity} · LV {g.level} · {short(g.owner)}</div>
              </button>
            ))}
          </div>
        </div>

        <aside className="border border-border bg-card/60 p-3 backdrop-blur lg:sticky lg:top-20 lg:self-start">
          <div className="flex gap-2">
            <input
              value={probe}
              onChange={(e) => setProbe(e.target.value.replace(/\D/g, ""))}
              placeholder="PREVIEW ANY BLOCK"
              className="flex-1 border border-border bg-background px-2 py-1 font-mono text-xs"
            />
            {probe ? <button type="button" className="btn-term-ghost" onClick={() => setProbe("")}>CLEAR</button> : null}
          </div>
          <div className="mt-3 aspect-square w-full border border-border bg-background">
            {shown ? (
              <CreatureModel3D
                key={`${shown.height}-${probeHeight !== null ? "p" : "a"}`}
                guardian={{ species: shown.species, rarity: shown.rarity, body: shown.body, accent: shown.accent, height: shown.height }}
                label={`${shown.species} · ${shown.height}.BITMAP`}
              />
            ) : (
              <p className="label grid size-full place-items-center p-4 text-center text-muted-foreground">
                {probeHeight !== null && preview.isFetching ? "READING THE BLOCK…" : probeHeight !== null && preview.isError ? "BLOCK NOT FOUND" : "PICK A GUARDIAN OR TYPE A BLOCK"}
              </p>
            )}
          </div>
          {shown ? (
            <div className="mt-3 font-mono text-xs" data-no-translate>
              <div className="text-foreground">{shown.height}.BITMAP · {shown.species}</div>
              <div className="label mt-1 text-bitcoin">{shown.rarity} · {shown.ability}</div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-muted-foreground">
                {([["HP", shown.hp], ["BITE", shown.bite], ["SPEED", shown.speed], ["ARMOR", shown.armor]] as const).map(([k, v]) => (
                  <div key={k}><div className="label">{k}</div><div className="text-foreground">{v}</div></div>
                ))}
              </div>
              <div className="label mt-2 text-muted-foreground">
                {probeHeight !== null ? "PREVIEW ONLY · NOT SUMMONED" : `AWAKENED BY ${short(cur?.owner ?? "")}`}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/collections/guardians/$height" params={{ height: String(shown.height) }} className="btn-term-ghost">DETAILS</Link>
                <Link to="/bitmap/$block" params={{ block: String(shown.height) }} className="btn-term-ghost">OPEN BITMAP</Link>
                <Link to="/oasis" search={{ height: shown.height }} className="btn-term-ghost">FIND IN OASIS</Link>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
