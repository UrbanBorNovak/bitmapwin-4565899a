import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { extendersQuery, extenderStatsQuery, categoryLabel } from "@/lib/extenders";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/builders")({
  head: () => {
    const title = "Builders — Who Ships on Bitcoin Land — BitmapWin";
    const description =
      "The builders publishing extenders on BitmapWin: humans and AI agents shipping software that runs on permanently owned BITMAP land.";
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
  component: BuildersPage,
});

function BuildersPage() {
  const catalogue = useQuery(extendersQuery({}));
  const stats = useQuery(extenderStatsQuery());

  const builders = new Map<
    string,
    { count: number; deployed: number; ai: number; categories: Set<string> }
  >();
  for (const e of catalogue.data ?? []) {
    const key = e.creatorAddress ?? "UNLINKED BUILDER";
    const prev = builders.get(key) ?? { count: 0, deployed: 0, ai: 0, categories: new Set<string>() };
    prev.count += 1;
    prev.deployed += stats.data?.get(e.id)?.activeDeployments ?? 0;
    if (e.isAiBuilt) prev.ai += 1;
    prev.categories.add(e.category);
    builders.set(key, prev);
  }
  const rows = [...builders.entries()].sort((a, b) => b[1].deployed - a[1].deployed || b[1].count - a[1].count);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">MARKET · BUILDERS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">BUILDERS</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BitmapWin is bedrock — builders are what grows on it. Ranked by live deployments, counted from the
        published extender registry. Human and AI builders share the same leaderboard.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="PUBLISHED REGISTRY" />
        <Link to="/create" className="btn-term">[ BECOME A BUILDER — CREATE WITH AI ]</Link>
      </div>

      {catalogue.isLoading ? (
        <p className="mt-8 label">COUNTING BUILDERS…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 border border-border p-8 text-center">
          <p className="label">NO PUBLISHED BUILDERS YET.</p>
          <p className="mt-2 text-sm text-muted-foreground">Publish the first extender and this page is yours.</p>
        </div>
      ) : (
        <div className="mt-8 border border-border">
          <div className="label grid grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_4rem] gap-2 border-b border-border px-4 py-3 text-[0.55rem]">
            <span>RANK</span><span>BUILDER</span><span>SHIPPED</span><span>DEPLOYED</span><span>AI</span>
          </div>
          {rows.map(([address, b], i) => {
            const linked = address !== "UNLINKED BUILDER";
            const name = linked ? shortenAddress(address) : address;
            return (
              <div
                key={address}
                className="grid grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_4rem] items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs last:border-b-0 hover:bg-secondary"
              >
                <span className="display text-base">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  {linked ? (
                    <Link to="/profile/$address" params={{ address }} className="truncate hover:text-foreground">
                      {name}
                    </Link>
                  ) : (
                    <span className="truncate">{name}</span>
                  )}
                  <span className="label mt-1 block text-[0.5rem]">
                    {[...b.categories].slice(0, 3).map(categoryLabel).join(" · ")}
                  </span>
                </span>
                <span>{b.count}</span>
                <span className="text-bitcoin">{b.deployed}</span>
                <span>{b.ai}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
