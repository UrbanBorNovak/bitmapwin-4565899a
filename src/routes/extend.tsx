import { createFileRoute, Link } from "@tanstack/react-router";
import { DataBadge } from "@/components/extenders/DataBadge";
import { MvpFlowRail } from "@/components/MvpFlowRail";

/**
 * EXTEND YOUR LAND — the fork in the road of the bedrock loop.
 * A holder arrives here from a tile and chooses where their land gets its
 * software from: someone else's package, an AI brief, or the open market.
 */
export const Route = createFileRoute("/extend")({
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const raw = search["height"];
    const height = Number(raw);
    return Number.isFinite(height) && height >= 0 ? { height } : {};
  },
  head: () => {
    const title = "Extend Your Land — Put Software on a BITMAP";
    const description =
      "Your BITMAP is a canvas. Import an extender built by another creator, describe what you want with AI, or find something that already exists in the market.";
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
  component: ExtendPage,
});

function ExtendPage() {
  const { height } = Route.useSearch();
  const hasLand = Number.isFinite(height);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-16">
      <MvpFlowRail active="extend" {...(hasLand ? { height: height as number } : {})} />
      <div className="label mt-6 text-bitcoin">STEP 02 OF 03 · EXTEND</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXTEND YOUR LAND</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {hasLand ? (
          <>
            <span className="text-foreground" data-no-translate>{height}.BITMAP</span> is a canvas. Anything that can run
            on the bedrock can live here — a single building, a shop, a quest, or an entire world.
          </>
        ) : (
          <>
            Your BITMAP is a canvas. Anything that can run on the bedrock can live on it — a single building, a shop, a
            quest, or an entire world.
          </>
        )}
      </p>

      <div data-tour="extend-paths" className="mt-8 grid gap-3 md:grid-cols-3">
        <Choice
          glyph="01"
          title="IMPORT EXTENDER"
          body="Add something built by another creator. Point at a package, check its manifest, then test it."
          to="/studio"
          action="[ OPEN IMPORT ]"
          badge={<DataBadge kind="live" note="STUDIO" />}
        />
        <Choice
          glyph="02"
          title="CREATE WITH AI"
          body="Describe what you want to build in plain English. The builder plans it, writes the code, runs it, then deploys it."
          to="/create"
          {...(hasLand ? { search: { height: height as number } } : {})}
          action="[ DESCRIBE IT ]"
          badge={<DataBadge kind="live" note="GEMINI BUILDER" />}
        />
        <Choice
          glyph="03"
          title="EXPLORE MARKET"
          body="Find something that already exists. Preview it running, then deploy it onto your land."
          to="/extenders"
          action="[ BROWSE MARKET ]"
          badge={<DataBadge kind="live" note="PUBLISHED REGISTRY" />}
        />
      </div>

      <div className="mt-10 border border-border bg-surface p-5 md:p-6">
        <div className="label text-bitcoin">HOW IT ENDS UP ON THE LAND</div>
        <ol className="mt-4 grid gap-4 font-mono text-xs text-muted-foreground sm:grid-cols-4">
          {[
            ["01", "TEST IN SANDBOX", "Run it away from your land first."],
            ["02", "DEPLOY", "Pick the tile, area, permissions and visibility."],
            ["03", "EXPERIENCE", "Players enter it from the map."],
            ["04", "PUBLISH", "List it so others can deploy it too."],
          ].map(([n, t, b]) => (
            <li key={n}>
              <div className="text-bitcoin" data-no-translate>{n}</div>
              <div className="mt-2 text-foreground">{t}</div>
              <p className="mt-1 leading-relaxed">{b}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/sdk-playground" className="btn-term-ghost">[ OPEN SANDBOX ]</Link>
          {hasLand ? (
            <Link to="/bitmap/$block" params={{ block: String(height) }} className="btn-term-ghost">
              [ BACK TO THE TILE ]
            </Link>
          ) : (
            <Link to="/map" className="btn-term-ghost">[ PICK A TILE ON THE MAP ]</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Choice({
  glyph,
  title,
  body,
  to,
  search,
  action,
  badge,
}: {
  glyph: string;
  title: string;
  body: string;
  to: "/studio" | "/extenders" | "/create";
  search?: { height: number };
  action: string;
  badge: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      {...(search ? { search } : {})}
      className="group flex min-h-[220px] flex-col justify-between border border-border bg-surface p-5 transition-colors hover:border-bitcoin"
    >
      <div>
        <div className="display text-xl text-bitcoin" data-no-translate>{glyph}</div>
        <div className="display mt-3 text-xl group-hover:text-bitcoin">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="mt-5 space-y-3">
        {badge}
        <div className="label text-bitcoin">{action}</div>
      </div>
    </Link>
  );
}
