import { useQuery } from "@tanstack/react-query";
import { guardianQuery } from "@/lib/bitmon-queries";

/** Live Guardian status for one BITMAP: awake (summoned) or open to mint. */
export function GuardianMintStatus({ height, className = "" }: { height: number; className?: string }) {
  const g = useQuery({ ...guardianQuery(height), refetchInterval: 15_000 });
  if (g.isPending) return <div className={`font-mono text-[10px] text-muted-foreground ${className}`}>◆ GUARDIAN · CHECKING…</div>;
  if (g.data) {
    return (
      <div className={`flex items-center gap-2 font-mono text-[10px] text-signal ${className}`}>
        <span className="size-1.5 bg-signal" aria-hidden="true" />
        GUARDIAN MINTED · {g.data.species}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 font-mono text-[10px] font-bold text-bitcoin ${className}`}>
      <span className="size-1.5 animate-pulse bg-bitcoin" aria-hidden="true" />
      GUARDIAN · MINTING NOW
    </div>
  );
}
