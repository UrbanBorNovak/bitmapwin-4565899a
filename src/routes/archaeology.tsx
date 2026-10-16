import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_OFFICIAL_TRAITS, traitsOf } from "@/lib/traits";
import { ArchaeologyLedger } from "@/components/ArchaeologyLedger";
import { InscribedSpacesArchive } from "@/components/archaeology/InscribedSpacesArchive";
import { FieldNotesDesk } from "@/components/archaeology/FieldNotesDesk";

const TAB_IDS = ["timeline", "spaces", "traits", "ledger"] as const;
type ArchTab = (typeof TAB_IDS)[number];

export const Route = createFileRoute("/archaeology")({
  validateSearch: (s: Record<string, unknown>): { tab?: ArchTab | undefined } => ({
    tab: (TAB_IDS as readonly string[]).includes(String(s["tab"])) ? (s["tab"] as ArchTab) : undefined,
  }),
  head: () => ({ meta: [
    { title: "BITMAP Archaeology — Facts, Traits & Block History — BITMAPWIN" },
    { name: "description", content: "The BITMAP archaeology facts page: every official Bitmap trait definition, the indexed trait catalogue, and a timeline of notable blocks in Bitcoin history." },
    { property: "og:title", content: "BITMAP Archaeology — Facts, Traits & Block History — BITMAPWIN" },
    { property: "og:description", content: "Every official Bitmap trait definition, the indexed trait catalogue, and a timeline of notable blocks in Bitcoin history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ArchaeologyFacts,
});

type TimelineEntry = {
  height: number;
  title: string;
  note: string;
};

const TIMELINE: TimelineEntry[] = [
  { height: 0, title: "GENESIS BLOCK", note: "Satoshi mines the first block. The only MYTHIC BITMAP; its coinbase can never be spent." },
  { height: 9, title: "FIRST SPENDABLE COINBASE", note: "The oldest block whose coinbase reward has been spent. BLOCK 9 trait." },
  { height: 78, title: "HAL FINNEY'S FIRST BLOCK", note: "The first block known to be mined by Hal Finney. BLOCK 78 trait." },
  { height: 170, title: "FIRST P2P TRANSACTION", note: "Satoshi sends 10 BTC to Hal Finney — the first peer-to-peer transfer. FIRST TRANSACTION trait." },
  { height: 57043, title: "THE PIZZA TRANSACTION", note: "10,000 BTC for two pizzas. PIZZA TRANSACTION trait; blocks mined that day carry PIZZA DAY." },
  { height: 210000, title: "FIRST HALVING", note: "Block subsidy drops from 50 to 25 BTC. First EPIC block after genesis." },
  { height: 420000, title: "SECOND HALVING", note: "Subsidy drops to 12.5 BTC. EPIC trait." },
  { height: 481824, title: "SEGWIT ACTIVATION", note: "Segregated Witness activates. Full blocks before this height carry PRE-SEGWIT FULL." },
  { height: 630000, title: "THIRD HALVING", note: "Subsidy drops to 6.25 BTC. EPIC trait." },
  { height: 660000, title: "66 DAO RANGE BEGINS", note: "Blocks 660000–669999 are recognized by 66 DAO." },
  { height: 840000, title: "FOURTH HALVING", note: "Subsidy drops to 3.125 BTC. The most recent EPIC block." },
];

type BlockFact = { block_height: number; block_hash: string; mined_at: string | null; pool_name: string | null };

function ArchaeologyFacts() {
  const tab: ArchTab = Route.useSearch().tab ?? "timeline";
  const supported = ALL_OFFICIAL_TRAITS.filter((t) => t.supported);
  const pending = ALL_OFFICIAL_TRAITS.filter((t) => !t.supported);
  const TABS: { id: ArchTab; label: string; count: number | null }[] = [
    { id: "timeline", label: "BLOCK TIMELINE", count: TIMELINE.length },
    { id: "spaces", label: "HISTORICAL SPACES", count: 100 },
    { id: "traits", label: "TRAITS & GLOSSARY", count: ALL_OFFICIAL_TRAITS.length },
    { id: "ledger", label: "FIELD NOTES & LEDGER", count: null },
  ];

  const factsQuery = useQuery({
    queryKey: ["archaeology-timeline-facts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_facts")
        .select("block_height, block_hash, mined_at, pool_name")
        .in("block_height", TIMELINE.map((t) => t.height));
      if (error) throw error;
      return new Map<number, BlockFact>((data ?? []).map((r) => [Number(r.block_height), r as BlockFact]));
    },
    staleTime: 60_000,
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/traits" className="label hover:text-bitcoin">← OFFICIAL TRAIT INDEX</Link>
      <header className="mt-6 border-l-2 border-bitcoin pl-5">
        <p className="label text-signal">BITMAP ARCHAEOLOGY · FIELD MANUAL</p>
        <h1 className="display mt-2 text-3xl md:text-5xl">FACTS, TRAITS &amp; BLOCK HISTORY</h1>
        <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
          The reference layer of BITMAP archaeology: every official trait definition, the live trait catalogue, and the notable blocks that anchor Bitcoin history. Chain-verified facts only — community field notes live on the trait pages.
        </p>
      </header>

      <nav role="tablist" aria-label="Archaeology sections" className="sticky top-14 z-20 mt-8 flex flex-wrap gap-px border border-border bg-border backdrop-blur">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to="/archaeology"
            search={{ tab: t.id }}
            resetScroll={false}
            role="tab"
            aria-selected={tab === t.id}
            className={`label flex-1 whitespace-nowrap px-4 py-3 text-center transition-colors ${tab === t.id ? "bg-background text-bitcoin" : "bg-card text-muted-foreground hover:text-signal"}`}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ""}
          </Link>
        ))}
      </nav>

      {/* Trait definitions */}
      {tab === "traits" && (<>
      <section className="mt-12">
        <p className="label text-bitcoin">01 · OFFICIAL TRAIT DEFINITIONS</p>
        <h2 className="display mt-2 text-xl md:text-2xl">THE GLOSSARY</h2>
        <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          {ALL_OFFICIAL_TRAITS.length} definitions from the Bitmap.Community Blocktributes glossary. {supported.length} are provable from indexed block data today; {pending.length} await index data.
        </p>
        <div className="mt-6 grid gap-px border border-border bg-border md:grid-cols-2">
          {ALL_OFFICIAL_TRAITS.map((trait) => (
            <Link
              key={trait.id}
              to="/traits/$trait"
              params={{ trait: trait.id }}
              className="group flex items-start justify-between gap-3 bg-card p-4 hover:bg-background"
            >
              <div className="min-w-0">
                <p className="font-mono text-[9px] text-muted-foreground">{trait.sourceKey}</p>
                <p className="display mt-1 text-sm group-hover:text-bitcoin">{trait.label}</p>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{trait.description}</p>
              </div>
              <span className={`label shrink-0 ${trait.supported ? "text-bitcoin" : "text-muted-foreground"}`}>
                {trait.supported ? "INDEXED" : "PENDING"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trait catalogue */}
      <section className="mt-12">
        <p className="label text-bitcoin">02 · TRAIT CATALOGUE</p>
        <h2 className="display mt-2 text-xl md:text-2xl">BROWSE INDEXED BITMAPS BY TRAIT</h2>
        <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          Every supported trait opens a paginated catalogue of real indexed BITMAP inscriptions, with listings, traced sales and the archaeological record.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {supported.map((trait) => (
            <article key={trait.id} className="border border-bitcoin/70 bg-card p-5">
              <h3 className="display text-lg">{trait.label}</h3>
              <p className="mt-2 min-h-10 font-mono text-[11px] leading-relaxed text-muted-foreground">{trait.description}</p>
              <Link to="/traits/$trait" params={{ trait: trait.id }} className="btn-term-ghost mt-4 inline-flex">OPEN CATALOGUE →</Link>
            </article>
          ))}
        </div>
      </section>

      </>)}

      {/* Block history timeline */}
      {tab === "timeline" && (<>
      <section className="mt-12">
        <p className="label text-bitcoin">03 · BLOCK HISTORY TIMELINE</p>
        <h2 className="display mt-2 text-xl md:text-2xl">BLOCKS THAT ANCHOR THE RECORD</h2>
        <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          The notable heights behind the rarest traits. Where the block indexer has reached a block, its stored hash and mined time are shown.
        </p>
        <ol className="mt-6 border-l border-border">
          {TIMELINE.map((entry) => {
            const fact = factsQuery.data?.get(entry.height);
            const localTraits = traitsOf(entry.height);
            return (
              <li key={entry.height} className="relative border-b border-border py-5 pl-6">
                <span className="absolute -left-[5px] top-6 h-2.5 w-2.5 border border-bitcoin bg-background" />
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Link to="/bitmap/$block" params={{ block: String(entry.height) }} className="display text-lg text-bitcoin hover:underline">
                    {entry.height.toLocaleString("en-US")}
                  </Link>
                  <p className="label">{entry.title}</p>
                </div>
                <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">{entry.note}</p>
                {localTraits.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {localTraits.map((t) => (
                      <Link key={t.id} to="/traits/$trait" params={{ trait: t.id }} className="label border border-border px-2 py-1 hover:border-bitcoin hover:text-bitcoin">
                        {t.label}
                      </Link>
                    ))}
                  </div>
                )}
                {fact ? (
                  <div className="mt-3 border border-border bg-card p-3">
                    <p className="label text-signal">CHAIN VERIFIED · INDEXED</p>
                    <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">HASH {fact.block_hash}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {fact.mined_at ? `MINED ${new Date(fact.mined_at).toUTCString()}` : "MINED TIME PENDING"}
                      {fact.pool_name ? ` · POOL ${fact.pool_name}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">BLOCK RECORD PENDING — THE INDEXER HAS NOT REACHED THIS HEIGHT YET.</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      </>)}

      {tab === "spaces" && <InscribedSpacesArchive />}

      {tab === "ledger" && <><FieldNotesDesk /><ArchaeologyLedger /></>}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/traits" className="btn-term-ghost">OFFICIAL TRAIT INDEX →</Link>
        <a href="https://docs.bitmap.community/bitmap.community/trait-definitions" target="_blank" rel="noreferrer" className="btn-term-ghost">OFFICIAL SOURCE ↗</a>
      </div>
    </main>
  );
}
