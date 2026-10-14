import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { morphFromDna } from "@/lib/creature-morph";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { SummonGuardianButton } from "@/components/bitmon/SummonGuardianDialog";

/** Native Guardian status on a BITMAP page: inscribed, awake-only or empty. */
export function BitmapGuardianPanel({ height }: { height: number }) {
  const g = useQuery({ ...guardianQuery(height), refetchInterval: 20_000 });
  const inhabited = useQuery(inhabitedQuery());
  const dna = useQuery(guardianDnaQuery(height));
  const inscriptionId = inhabited.data?.get(height) ?? g.data?.inscriptionId ?? null;
  const name = dna.data ? morphFromDna(dna.data).name : null;
  const state = inscriptionId ? "inscribed" : g.data ? "awake" : "empty";

  return (
    <div className={`mt-8 flex flex-wrap items-center gap-4 border p-4 ${state === "inscribed" ? "border-signal bg-signal/5" : "border-border"}`}>
      {state !== "empty" ? (
        <div className="size-20 shrink-0 border border-border">
          <GuardianPortrait height={height} {...(dna.data ? { dna: dna.data } : {})} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="label text-bitcoin">BLOCK-DNA GUARDIAN</p>
        {state === "inscribed" ? (
          <>
            <p className="font-display text-xl text-foreground">{name ?? "GUARDIAN"}</p>
            <p className="font-mono text-[11px] text-signal">◆ INSCRIBED ON BITCOIN · CHILD OF {height}.BITMAP · PATROLLING IN THE OASIS</p>
            <a href={`https://ordinals.com/inscription/${inscriptionId}`} target="_blank" rel="noreferrer" className="block truncate font-mono text-[10px] text-muted-foreground underline hover:text-signal">
              {inscriptionId} ↗
            </a>
          </>
        ) : state === "awake" ? (
          <>
            <p className="font-display text-xl text-foreground">{name ?? "GUARDIAN"}</p>
            <p className="font-mono text-[11px] text-signal">AWAKE IN THE OASIS · NOT YET INSCRIBED ON BITCOIN</p>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">A creature read from this block's real data. The holder can summon it to patrol this land in the Oasis.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {state !== "empty" ? (
          <Link to="/oasis" search={{ height }} className="border border-bitcoin bg-bitcoin px-3 py-2 font-mono text-xs text-background hover:opacity-90">
            VISIT ITS PATROL →
          </Link>
        ) : null}
        {state !== "inscribed" ? <SummonGuardianButton height={height} /> : null}
      </div>
    </div>
  );
}
