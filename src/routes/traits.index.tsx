import { createFileRoute, Link } from "@tanstack/react-router";
import { ALL_OFFICIAL_TRAITS } from "@/lib/traits";

export const Route = createFileRoute("/traits/")({
  head: () => ({ meta: [
    { title: "BITMAP Archaeology & Official Traits — BITMAPWIN" },
    { name: "description", content: "Excavate official Bitmap traits through verified chain facts, indexed inscriptions and community-nominated field records." },
    { property: "og:title", content: "BITMAP Archaeology & Official Traits — BITMAPWIN" },
    { property: "og:description", content: "Excavate official Bitmap traits through verified chain facts, indexed inscriptions and community-nominated field records." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TraitsIndex,
});

function TraitsIndex() {
  const supported = ALL_OFFICIAL_TRAITS.filter((trait) => trait.supported).length;
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/collections" className="label hover:text-bitcoin">← COLLECTIONS</Link>
      <header className="mt-6 border-l-2 border-bitcoin pl-5">
        <p className="label text-signal">BITMAP ARCHAEOLOGY · BITMAP.COMMUNITY BLOCKTRIBUTES</p>
        <h1 className="display mt-2 text-3xl md:text-5xl">OFFICIAL TRAIT INDEX</h1>
        <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
          Every definition in the official glossary. {supported} height-derived traits are matched to genuine indexed BITMAP inscriptions now; traits needing transaction, miner, date, fee, hash or community data remain visible without invented matches.
        </p>
      </header>

      <section className="mt-8 grid border border-border bg-card md:grid-cols-3">
        <div className="p-5 md:col-span-2 md:p-6">
          <p className="label text-bitcoin">READ THE BLOCK AS AN ARTIFACT</p>
          <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
            BITMAP Archaeology connects a block's verifiable Bitcoin record, its first valid BITMAP inscription and its ownership provenance with attributed community field notes. Nominate discoveries inside any trait; three accepted records can be featured per category.
          </p>
        </div>
        <div className="border-t border-border p-5 md:border-l md:border-t-0 md:p-6">
          <p className="label text-signal">CHAIN VERIFIED</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">DETERMINISTIC BLOCK, INSCRIPTION OR INDEX FACT</p>
          <p className="label mt-4 text-bitcoin">COMMUNITY FIELD NOTE</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">ATTRIBUTED INTERPRETATION · NEVER A VALUE CLAIM</p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <span className="label border border-bitcoin px-3 py-2 text-bitcoin">PROVABLE NOW · {supported}</span>
        <span className="label border border-border px-3 py-2">INDEX DATA REQUIRED · {ALL_OFFICIAL_TRAITS.length - supported}</span>
        <Link to="/traits/ranks" className="btn-term-ghost">TRAIT RANK LADDER →</Link>
        <Link to="/archaeology" className="btn-term-ghost">ARCHAEOLOGY FACTS →</Link>
        <a href="https://docs.bitmap.community/bitmap.community/trait-definitions" target="_blank" rel="noreferrer" className="btn-term-ghost">OFFICIAL SOURCE ↗</a>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ALL_OFFICIAL_TRAITS.map((trait) => (
          <article key={trait.id} className={`border bg-card p-5 ${trait.supported ? "border-bitcoin/70" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] text-muted-foreground">{trait.sourceKey}</p>
                <h2 className="display mt-1 text-lg">{trait.label}</h2>
              </div>
              <span className={`label shrink-0 ${trait.supported ? "text-bitcoin" : "text-muted-foreground"}`}>
                {trait.supported ? "INDEXED" : "INDEX DATA REQUIRED"}
              </span>
            </div>
            <p className="mt-4 min-h-10 font-mono text-[11px] leading-relaxed text-muted-foreground">{trait.description}</p>
            <div className="mt-4 border-t border-border pt-3">
              <p className="label">MARKETPLACE USE</p>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{trait.marketplaceUse}</p>
            </div>
            <Link to="/traits/$trait" params={{ trait: trait.id }} className="btn-term-ghost mt-4 inline-flex">{trait.supported ? "VIEW INSCRIPTIONS →" : "VIEW DEFINITION →"}</Link>
          </article>
        ))}
      </div>
    </main>
  );
}