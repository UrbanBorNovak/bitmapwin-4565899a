import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBlockCircuit } from "@/lib/block-circuit.functions";
import type { AwakeGuardian } from "@/lib/bitmon-queries";

/** The closed loop for one real block: header → inscriptions → parcels → DMT creature. */
export function LiveBlockCircuit({ height, guardian }: { height: number; guardian: AwakeGuardian | null }) {
  const fetchCircuit = useServerFn(getBlockCircuit);
  const q = useQuery({
    queryKey: ["block-circuit", height],
    queryFn: () => fetchCircuit({ data: { height } }),
    staleTime: 5 * 60_000,
  });
  const d = q.data && !("error" in q.data) ? q.data : null;
  const insc = d?.inscriptions;
  const cell = "border border-border bg-background p-3 min-w-0";
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-2 font-mono text-[10px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-foreground">{v}</span>
    </div>
  );

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="label text-signal">LIVE BLOCK · {height}</span>
        <span className="label text-muted-foreground">
          {q.isPending ? "READING CHAIN…" : d ? "REAL CHAIN DATA" : "BLOCK DATA UNAVAILABLE"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cell}>
          <div className="label text-bitcoin">L1 · HEADER</div>
          <div className="mt-2 space-y-1">
            {row("HASH", d ? `${d.hash.slice(0, 6)}…${d.hash.slice(-8)}` : "—")}
            {row("TIME", d ? new Date(d.timestamp * 1000).toISOString().slice(0, 16).replace("T", " ") : "—")}
            {row("SIZE", d ? `${(d.size / 1e6).toFixed(2)} MB` : "—")}
            {row("WEIGHT", d ? `${(d.weight / 1e6).toFixed(2)} MWU` : "—")}
          </div>
        </div>
        <div className={cell}>
          <div className="label text-bitcoin">L2 · INSCRIPTIONS</div>
          <div className="display mt-2 text-lg">
            {insc ? `${insc.ids.length}${insc.more ? "+" : ""}` : "—"}
          </div>
          <div className="mt-1 space-y-0.5">
            {insc?.ids.slice(0, 3).map((id) => (
              <a key={id} href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="block truncate font-mono text-[10px] text-muted-foreground hover:text-bitcoin">
                {id.slice(0, 10)}…{id.slice(-4)}
              </a>
            ))}
            {d && !insc && <div className="font-mono text-[10px] text-muted-foreground">INDEX UNREACHABLE</div>}
          </div>
        </div>
        <div className={cell}>
          <div className="label text-bitcoin">L3 · {height}.BITMAP</div>
          <div className="display mt-2 text-lg">{d ? d.txCount.toLocaleString("en-US") : "—"}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">TX PARCELS · ONE PER TRANSACTION</div>
        </div>
        <div className={cell}>
          <div className="label text-signal">DMT · CREATURE</div>
          {guardian ? (
            <>
              <div className="display mt-2 text-lg">{guardian.species}</div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                {guardian.rarity} · HP {guardian.hp} · BITE {guardian.bite}
              </div>
            </>
          ) : (
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">NO GUARDIAN AWAKE ON THIS BLOCK</div>
          )}
        </div>
      </div>
    </div>
  );
}
