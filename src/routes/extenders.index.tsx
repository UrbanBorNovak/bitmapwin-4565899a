import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExtenderCard } from "@/components/extenders/ExtenderCard";
import { DataBadge } from "@/components/extenders/DataBadge";
import { EXTENDER_CATEGORIES, extenderStatsQuery, extendersQuery, type Extender } from "@/lib/extenders";
import { ExtenderPreviewDialog } from "@/components/extenders/ExtenderPreviewDialog";

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

type Lane = { id: "all" | "assets" | "extenders" | "experiences" | "ai" | "builders"; label: string; categories: string[] | null };

const LANES: Lane[] = [
  { id: "all", label: "ALL", categories: null },
  { id: "assets", label: "ASSETS", categories: ["art", "construction"] },
  { id: "extenders", label: "EXTENDERS", categories: ["world-systems", "combat", "economy", "vehicles", "dev-tools"] },
  { id: "experiences", label: "EXPERIENCES", categories: ["games", "rpg", "cities"] },
  { id: "ai", label: "AI BUILT", categories: null },
  { id: "builders", label: "BUILDERS", categories: null },
];

function ExtenderCatalogue() {
  const [lane, setLane] = useState<Lane["id"]>("all");
  const [category, setCategory] = useState<string>("any");
  const [search, setSearch] = useState("");
  const [previewing, setPreviewing] = useState<Extender | null>(null);
  const aiOnly = lane === "ai";
  const catalogue = useQuery(extendersQuery({ category, search, aiOnly }));
  const stats = useQuery(extenderStatsQuery());
  const activeLane = LANES.find((l) => l.id === lane)!;
  const extenders = (catalogue.data ?? []).filter(
    (e) => !activeLane.categories || activeLane.categories.includes(e.category),
  );

  const builders = new Map<string, { count: number; deployed: number }>();
  for (const e of catalogue.data ?? []) {
    const key = e.creatorAddress ?? "UNLINKED BUILDER";
    const prev = builders.get(key) ?? { count: 0, deployed: 0 };
    builders.set(key, {
      count: prev.count + 1,
      deployed: prev.deployed + (stats.data?.get(e.id)?.activeDeployments ?? 0),
    });
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · EXTENSION LAYER</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDER MARKET</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        An asset is a model. An extender is a package: code, assets, systems, rules, data, dependencies and permissions
        that deploy onto permanent BITMAP land. Creators ship extenders — players enter experiences.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DataBadge kind="live" note="PUBLISHED REGISTRY" />
        <Link to="/extend" className="btn-term">[ EXTEND MY LAND ]</Link>
        <Link to="/studio" search={{ tool: "extenders" }} className="btn-term-ghost">[ OPEN EXTENDER STUDIO ]</Link>
        <Link to="/sdk" className="btn-term-ghost">[ READ THE SDK ]</Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-0 border-b border-border">
        {LANES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setLane(l.id);
              setCategory("any");
            }}
            className={`label -mb-px border-b-2 px-3 py-3 transition-colors ${lane === l.id ? "border-bitcoin text-bitcoin" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {lane === "builders" ? (
        <div className="mt-8">
          {builders.size === 0 ? (
            <p className="font-mono text-sm text-muted-foreground">&gt; NO PUBLISHED BUILDERS YET</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...builders.entries()].map(([address, b]) => (
                <div key={address} className="border border-border bg-surface p-4">
                  <div className="label text-bitcoin">BUILDER</div>
                  <div className="display mt-2 truncate text-lg" data-no-translate>{address}</div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[10px]">
                    <div>
                      <dt className="text-muted-foreground">EXTENDERS</dt>
                      <dd data-no-translate>{b.count}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">LAND DEPLOYED</dt>
                      <dd data-no-translate>{b.deployed}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3 border-b border-border py-4 lg:flex-row lg:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search extenders"
              className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin lg:max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              <FilterChip active={category === "any"} onClick={() => setCategory("any")} label="ANY CATEGORY" />
              {EXTENDER_CATEGORIES.filter((c) => !activeLane.categories || activeLane.categories.includes(c.id)).map((c) => (
                <FilterChip
                  key={c.id}
                  active={category === c.id}
                  onClick={() => setCategory(c.id)}
                  label={`${c.glyph} ${c.label}`}
                />
              ))}
            </div>
          </div>

          {catalogue.isPending ? (
            <p className="mt-10 font-mono text-sm text-muted-foreground">&gt; READING THE EXTENDER REGISTRY…</p>
          ) : extenders.length === 0 ? (
            <div className="mt-10 border border-border bg-surface p-6">
              <div className="display text-xl">NOTHING PUBLISHED HERE YET</div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                The registry is live and empty — nothing here is seeded or faked. The first published package appears the
                moment a builder ships one from the studio.
              </p>
              <Link to="/studio" search={{ tool: "extenders" }} className="btn-term mt-5 inline-flex">[ PUBLISH THE FIRST EXTENDER ]</Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {extenders.map((extender) => (
                <ExtenderCard
                  key={extender.id}
                  extender={extender}
                  stats={stats.data?.get(extender.id)}
                  onPreview={setPreviewing}
                />
              ))}
            </div>
          )}
        </>
      )}
      <ExtenderPreviewDialog extender={previewing} onClose={() => setPreviewing(null)} />
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
