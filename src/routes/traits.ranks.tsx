import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { OFFICIAL_TRAITS, type TraitId } from "@/lib/traits";
import { fetchTraitBitmaps } from "@/lib/trait-collections";
import { BlockMosaic } from "@/components/BlockMosaic";

const LADDER_SIZE = 5;
const REFRESH_MS = 30_000;

export const Route = createFileRoute("/traits/ranks")({
  head: () => ({ meta: [
    { title: "Official Trait Rank Ladder — BITMAPWIN" },
    { name: "description", content: "Live ladder of the top-ranked BITMAP inscriptions for every provable official Bitmap trait, refreshed from the on-chain index." },
    { property: "og:title", content: "Official Trait Rank Ladder — BITMAPWIN" },
    { property: "og:description", content: "Live ladder of the top-ranked BITMAP inscriptions for every provable official Bitmap trait, refreshed from the on-chain index." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TraitRanks,
});

function TraitRanks() {
  const queries = useQueries({
    queries: OFFICIAL_TRAITS.map((trait) => ({
      queryKey: ["trait-rank-ladder", trait.id],
      queryFn: () => fetchTraitBitmaps(trait.id as TraitId, 0, LADDER_SIZE),
      staleTime: REFRESH_MS,
      refetchInterval: REFRESH_MS,
    })),
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/traits" className="label hover:text-bitcoin">← OFFICIAL TRAIT INDEX</Link>
      <header className="mt-6 border-l-2 border-bitcoin pl-5">
        <p className="label text-signal">LIVE · REFRESHES EVERY 30S FROM THE ON-CHAIN INDEX</p>
        <h1 className="display mt-2 text-3xl md:text-5xl">TRAIT RANK LADDER</h1>
        <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
          The highest-ranked BITMAP inscription for every provable official trait. Rank is deterministic: the earliest block height holding the trait takes the top rung. Only genuine indexed inscriptions appear — no invented holders.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {OFFICIAL_TRAITS.map((trait, index) => {
          const query = queries[index];
          if (!query) return null;
          const items = query.data?.items ?? [];
          return (
            <article key={trait.id} className="border border-border bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="font-mono text-[9px] text-muted-foreground">{trait.sourceKey}</p>
                  <h2 className="display mt-1 text-lg">{trait.label}</h2>
                </div>
                <span className={`label shrink-0 ${query.isFetching ? "text-signal" : "text-muted-foreground"}`}>
                  {query.isFetching ? "UPDATING…" : "LIVE"}
                </span>
              </header>
              {query.isPending ? (
                <p className="p-4 font-mono text-xs text-muted-foreground">&gt; READING INDEX<span className="blink">_</span></p>
              ) : query.isError ? (
                <p className="p-4 font-mono text-xs text-destructive">&gt; INDEX UNAVAILABLE</p>
              ) : items.length === 0 ? (
                <p className="p-4 font-mono text-xs text-muted-foreground">&gt; NO INDEXED INSCRIPTIONS YET</p>
              ) : (
                <ol>
                  {items.map((row, rung) => (
                    <li key={row.inscriptionId} className="flex items-center gap-3 border-b border-border/60 p-3 last:border-b-0">
                      <span className={`display w-8 shrink-0 text-center text-lg ${rung === 0 ? "text-bitcoin" : "text-muted-foreground"}`}>
                        {rung + 1}
                      </span>
                      <div className="w-14 shrink-0"><BlockMosaic height={row.bitmapHeight} /></div>
                      <div className="min-w-0 flex-1">
                        <Link to="/bitmap/$block" params={{ block: String(row.bitmapHeight) }} className="label text-foreground hover:text-bitcoin">
                          {row.bitmapHeight}.BITMAP
                        </Link>
                        <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                          {row.ownerAddress ? `HELD BY ${row.ownerAddress.slice(0, 10)}…` : "HOLDER UNRESOLVED"}
                        </p>
                      </div>
                      {rung === 0 ? <span className="label shrink-0 text-bitcoin">◆ TOP</span> : null}
                    </li>
                  ))}
                </ol>
              )}
              <footer className="border-t border-border p-3">
                <Link to="/traits/$trait" params={{ trait: trait.id }} className="label hover:text-bitcoin">FULL INDEX →</Link>
              </footer>
            </article>
          );
        })}
      </div>
    </main>
  );
}
