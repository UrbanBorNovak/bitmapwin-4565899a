import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExtenderCard } from "@/components/extenders/ExtenderCard";
import { DataBadge } from "@/components/extenders/DataBadge";
import { EXTENDER_CATEGORIES, extenderStatsQuery, extendersQuery } from "@/lib/extenders";

export const Route = createFileRoute("/extenders/")({
  head: () => {
    const title = "Extenders — Software That Runs on Bitcoin Land";
    const description =
      "Discover extenders: composable packages of code, assets, systems and rules that deploy onto permanently owned BITMAP land.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ExtenderCatalogue,
});

function ExtenderCatalogue() {
  const [category, setCategory] = useState<string>("any");
  const [search, setSearch] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const catalogue = useQuery(extendersQuery({ category, search, aiOnly }));
  const stats = useQuery(extenderStatsQuery());
  const extenders = catalogue.data ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · EXTENSION LAYER</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDERS</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        An asset is a model. An extender is a package: code, assets, systems, rules, data, dependencies and permissions
        that deploy onto permanent BITMAP land. Anything that can run on the bedrock can ship here — including
        experiences built by AI.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DataBadge kind="live" note="PUBLISHED REGISTRY" />
        <Link to="/studio" className="btn-term-ghost">[ OPEN EXTENDER STUDIO ]</Link>
        <Link to="/sdk" className="btn-term-ghost">[ READ THE SDK ]</Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-y border-border py-4 lg:flex-row lg:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search extenders"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin lg:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          <FilterChip active={category === "any"} onClick={() => setCategory("any")} label="ALL" />
          {EXTENDER_CATEGORIES.map((c) => (
            <FilterChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={`${c.glyph} ${c.label}`}
            />
          ))}
          <FilterChip active={aiOnly} onClick={() => setAiOnly((v) => !v)} label="🤖 AI BUILT" />
        </div>
      </div>

      {catalogue.isPending ? (
        <p className="mt-10 font-mono text-sm text-muted-foreground">&gt; READING THE EXTENDER REGISTRY…</p>
      ) : extenders.length === 0 ? (
        <div className="mt-10 border border-border bg-surface p-6">
          <div className="display text-xl">NO PUBLISHED EXTENDERS YET</div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The registry is live and empty — nothing here is seeded or faked. The first published package appears the
            moment a builder ships one from the studio.
          </p>
          <Link to="/studio" className="btn-term mt-5 inline-flex">[ PUBLISH THE FIRST EXTENDER ]</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {extenders.map((extender) => (
            <ExtenderCard key={extender.id} extender={extender} stats={stats.data?.get(extender.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`label border px-2 py-1.5 transition-colors ${active ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
