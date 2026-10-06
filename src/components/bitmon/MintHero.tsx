import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/mint-hero.jpg";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";

/** Mint page hero: art + live, real collection counts from the Guardian index. */
export function MintHero() {
  const all = useQuery(allGuardiansQuery());
  const children = useQuery({ queryKey: ["guardian-children-v6"], queryFn: () => getGuardianChildrenFn(), staleTime: 60_000, refetchInterval: 120_000 });
  const list = all.data ?? [];
  const inscribed = children.data && !children.data.unavailable ? children.data.ids.length : null;
  const onChain = new Set(children.data?.ids ?? []);
  const latest = list.slice(0, 6);

  return (
    <section className="relative mb-8 overflow-hidden rounded-md border border-border">
      <img src={hero} alt="A Bitcoin block cracking open to reveal its Guardian" width={1600} height={704} className="h-[300px] w-full object-cover md:h-[380px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
        <p className="label text-signal">OFFICIAL ON-CHAIN COLLECTION · ONE GUARDIAN PER BLOCK, FOREVER</p>
        <p className="display mt-1 text-2xl md:text-4xl">EVERY INSCRIPTION <span className="text-bitcoin">JOINS THE COLLECTION.</span></p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each Guardian is inscribed as a child of your BITMAP and of the BITMAPWIN master parent, so it counts in the collection automatically — provable by anyone with a node.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="panel rounded-sm border border-bitcoin/50 px-2 py-1 text-bitcoin">{all.isLoading ? "…" : list.length} AWAKENED</span>
          <span className="panel rounded-sm border border-signal/50 px-2 py-1 text-signal">{inscribed ?? "…"} INSCRIBED ON-CHAIN</span>
          <span className="font-mono text-[10px] text-muted-foreground">[YOUR BITMAP] + [MASTER PARENT] → [YOUR GUARDIAN]</span>
        </div>
        {latest.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
            <span className="text-muted-foreground">LATEST:</span>
            {latest.map((g) => (
              <span key={g.height} className="border border-border bg-background/70 px-1.5 py-0.5">
                {g.height}.BITMAP · {g.rarity} · {g.inscriptionId && onChain.has(g.inscriptionId) ? "◆ INSCRIBED" : "AWAKE"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
