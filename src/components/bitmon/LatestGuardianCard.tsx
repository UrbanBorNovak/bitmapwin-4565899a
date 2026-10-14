import { lazy, Suspense } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { GuardianName } from "@/components/bitmon/GuardianName";

const Territory3D = lazy(() => import("@/components/BitmapTerritory3D"));

/** Featured Guardian: the newest on-chain inscribed one, else the newest awakened. */
export function LatestGuardianCard() {
  const q = useQuery({ ...allGuardiansQuery(), refetchInterval: 15_000 });
  const list = q.data ?? [];
  const g = list.find((x) => x.inscriptionId) ?? list[0];
  if (!g) return null;
  const box = <div className="aspect-square w-full border border-border bg-background" />;
  return (
    <div className="mt-3 border border-border bg-background p-3">
      <Link to="/bitmap/$block" params={{ block: String(g.height) }} className="block hover:opacity-90">
        <ClientOnly fallback={box}>
          <Suspense fallback={box}>
            <Territory3D height={g.height} guardian={g} />
          </Suspense>
        </ClientOnly>
      </Link>
      <div className={`label mt-3 flex items-center gap-2 ${g.inscriptionId ? "text-bitcoin" : "text-signal"}`}>
        <span className={`size-1.5 ${g.inscriptionId ? "bg-bitcoin" : "bg-signal"}`} aria-hidden="true" />
        {g.inscriptionId ? "FEATURED · INSCRIBED ON-CHAIN" : "LATEST GUARDIAN AWAKENED"}
      </div>
      <div className="display mt-1 truncate text-sm"><GuardianName height={g.height} fallback={g.species} /> · {g.height}.BITMAP</div>
      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
        {g.rarity} · LV {g.level} · HP {g.hp} · BITE {g.bite}
      </div>
      {g.inscriptionId ? (
        <a
          href={`https://ordinals.com/inscription/${g.inscriptionId}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-[10px] text-signal hover:text-foreground"
        >
          INSCRIPTION {g.inscriptionId.slice(0, 8)}…{g.inscriptionId.slice(-4)} ↗
        </a>
      ) : null}
      <a
        href={`/oasis?height=${g.height}`}
        className="mt-2 block border border-bitcoin bg-bitcoin py-1.5 text-center font-mono text-[10px] font-bold text-background hover:opacity-90"
      >
        FIND IN OASIS
      </a>
    </div>
  );
}
