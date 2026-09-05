import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { worldDeploymentsQuery, categoryGlyph } from "@/lib/extenders";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/experiences")({
  head: () => {
    const title = "Experiences — Live Worlds Deployed on Bitcoin Land — BitmapWin";
    const description =
      "Every extender currently deployed on a BITMAP: games, cities, systems and AI-built worlds you can walk into right now.";
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
  component: ExperiencesPage,
});

function ExperiencesPage() {
  const deployments = useQuery(worldDeploymentsQuery(500));
  const rows = deployments.data ?? [];
  const tilesWithWorlds = new Set(rows.map((d) => d.bitmapHeight)).size;
  const aiBuilt = rows.filter((d) => d.isAiBuilt).length;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">MARKET · EXPERIENCES</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">LIVE EXPERIENCES</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Extenders are software; experiences are extenders running on land. Everything listed here is deployed
        on a real BITMAP right now — open the tile and walk in.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="ACTIVE DEPLOYMENTS" />
        <Link to="/extend" className="btn-term">[ DEPLOY YOUR OWN ]</Link>
      </div>

      <section className="mt-8 grid grid-cols-3 border border-border">
        <Stat k="ACTIVE DEPLOYMENTS" v={deployments.isLoading ? "…" : String(rows.length)} />
        <Stat k="TILES WITH WORLDS" v={deployments.isLoading ? "…" : String(tilesWithWorlds)} />
        <Stat k="AI BUILT" v={deployments.isLoading ? "…" : String(aiBuilt)} last />
      </section>

      {!deployments.isLoading && rows.length === 0 ? (
        <div className="mt-8 border border-border p-8 text-center">
          <p className="label">NO EXPERIENCES DEPLOYED YET.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The bedrock is ready. Deploy an extender onto land you hold and it appears here instantly.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/create" className="btn-term">[ CREATE WITH AI ]</Link>
            <Link to="/extenders" className="btn-term-ghost">[ BROWSE EXTENDERS ]</Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <Link
              key={d.id}
              to="/bitmap/$block"
              params={{ block: String(d.bitmapHeight) }}
              className="bg-background p-5 hover:bg-secondary"
            >
              <div className="flex items-center justify-between">
                <span className="label text-[0.55rem]">{categoryGlyph(d.category)} {d.category.toUpperCase()}</span>
                {d.isAiBuilt && <span className="label border border-bitcoin px-1 text-[0.5rem] text-bitcoin">AI BUILT</span>}
              </div>
              <div className="display mt-3 text-lg">{d.name}</div>
              <div className="label mt-3 text-[0.55rem]">
                ON BITMAP #{d.bitmapHeight} · v{d.semver} · BY {shortenAddress(d.deployedByAddress)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`border-border p-4 ${last ? "" : "border-r"}`}>
      <div className="label">{k}</div>
      <div className="display mt-2 text-xl">{v}</div>
    </div>
  );
}
