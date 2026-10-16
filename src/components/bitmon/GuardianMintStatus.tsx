import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { morphFromDna } from "@/lib/creature-morph";

/** Guardian status for one BITMAP: INHABITED (inscribed on-chain), AWAKE, or UNINHABITED. */
export function GuardianMintStatus({ height, className = "" }: { height: number; className?: string }) {
  const g = useQuery({ ...guardianQuery(height), refetchInterval: 15_000 });
  const inhabited = useQuery(inhabitedQuery());
  const child = inhabited.data?.get(height) ?? null;
  // The canonical name is the one the on-chain Guardian renders from its block hash.
  const dna = useQuery({ ...guardianDnaQuery(height), enabled: Boolean(child || g.data) });
  const name = dna.data ? morphFromDna(dna.data).name : null;
  if (child) {
    return (
      <a
        href={`https://ordinals.com/inscription/${child}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Guardian inscribed on Bitcoin as a child of this BITMAP"
        className={`inline-flex items-center gap-2 border border-signal bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold text-signal hover:bg-signal/20 ${className}`}
      >
        <span className="size-1.5 bg-signal" aria-hidden="true" />
        INHABITED{name ? <span data-no-translate>{` · ${name}`}</span> : null} ↗
      </a>
    );
  }
  if (g.isPending || inhabited.isPending) return <div className={`font-mono text-[10px] text-muted-foreground ${className}`}>◆ GUARDIAN · CHECKING…</div>;
  if (g.data) {
    return (
      <div className={`flex items-center gap-2 font-mono text-[10px] text-signal ${className}`}>
        <span className="size-1.5 border border-signal" aria-hidden="true" />
        GUARDIAN AWAKE{name ? <span data-no-translate>{` · ${name}`}</span> : null} · NOT YET INSCRIBED
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 font-mono text-[10px] text-muted-foreground ${className}`}>
      <span className="size-1.5 border border-border" aria-hidden="true" />
      UNINHABITED
    </div>
  );
}
