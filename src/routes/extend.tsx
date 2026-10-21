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
      <h1 className="display mt-6 text-3xl md:text-5xl">BUILD ON YOUR LAND</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {hasLand ? (
          <>
            Put something on <span className="text-foreground" data-no-translate>{height}.BITMAP</span> — a house, a shop,
            a quest, a whole town. Pick one of the three ways below.
          </>
        ) : (
          <>
            Put something on your BITMAP — a house, a shop, a quest, a whole town. Pick one of the three ways below.
          </>
        )}
      </p>

      <div data-tour="extend-paths" className="mt-8 grid gap-3 md:grid-cols-3">
        <Choice
          glyph="01"
          title="JUST DESCRIBE IT"
          body="Say what you want in plain words. It gets built, previewed and placed on your land — the fastest way, about a minute."
          to="/create"
          {...(hasLand ? { search: { height: height as number } } : {})}
          action="[ START HERE ]"
          badge={<DataBadge kind="live" note="RECOMMENDED" />}
        />
        <Choice
          glyph="02"
          title="PICK SOMETHING READY"
          body="Browse what other people already made, watch it run, then put it on your land in one click."
          to="/extenders"
          action="[ BROWSE ]"
          badge={<DataBadge kind="live" note="PUBLISHED REGISTRY" />}
        />
        <Choice
          glyph="03"
          title="BRING YOUR OWN"
          body="For builders: import a package you or someone else wrote, check it, test it and deploy it."
          to="/studio"
          action="[ OPEN STUDIO ]"
          badge={<DataBadge kind="live" note="ADVANCED" />}
        />
      </div>

      <div className="mt-10 border border-border bg-surface p-5 md:p-6">
        <div className="label text-bitcoin">WHAT HAPPENS AFTER YOU PICK</div>
        <ol className="mt-4 grid gap-4 font-mono text-xs text-muted-foreground sm:grid-cols-3">
          {[
            ["01", "YOU SEE IT FIRST", "It runs in front of you before it touches your land."],
            ["02", "IT GOES LIVE", "One button places it on the BITMAP you hold."],
            ["03", "PEOPLE VISIT", "Players walk into it straight from the Oasis."],
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
            <Link to="/oasis" className="btn-term-ghost">[ PICK A TILE IN THE OASIS ]</Link>
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
