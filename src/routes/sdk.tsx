import { createFileRoute, Link } from "@tanstack/react-router";
import { DataBadge } from "@/components/extenders/DataBadge";
import { LAND_PERMISSIONS, SDK_VERSION } from "@/lib/extenders";

export const Route = createFileRoute("/sdk")({
  head: () => {
    const title = "BitmapWin SDK — Build for Player-Owned Bitcoin Land";
    const description =
      "The machine-readable contract humans and AI agents use to build extenders for BitmapWin: land, build, player, world, economy, social and AI primitives.";
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
  component: SdkPage,
});

const PRIMITIVES = [
  {
    id: "LAND",
    status: "live" as const,
    body: "Read a BITMAP's identity, holder, club, parcels and neighbours. Ownership is first-is-first on chain; the SDK never invents it.",
    calls: ["land.get(height)", "land.owner(height)", "land.neighbours(height, radius)", "land.rights(height, address)"],
  },
  {
    id: "BUILD",
    status: "live" as const,
    body: "Attach models, pages and deployed extenders to land you control or were granted.",
    calls: ["build.models(height)", "build.deploy(extender, version, height)", "build.undeploy(deploymentId)"],
  },
  {
    id: "PLAYER",
    status: "live" as const,
    body: "Position, velocity, direction, movement and animation state, health and combat state for the local player and interpolated peers.",
    calls: ["player.self()", "player.peers()", "player.onMove(cb)", "player.onHit(cb)"],
  },
  {
    id: "WORLD",
    status: "live" as const,
    body: "The shared 1,000 × 1,000 world: chunks, districts, cursors, chat channels and the chain tip.",
    calls: ["world.tip()", "world.chunk(x, z)", "world.chat.send(text)", "world.presence()"],
  },
  {
    id: "ECONOMY",
    status: "live" as const,
    body: "Listings, offers, confirmed sales, leases and BIT balances. Settlement stays on Bitcoin.",
    calls: ["economy.listings(height)", "economy.trades(height)", "economy.leases(height)", "economy.bit.balance(address)"],
  },
  {
    id: "SOCIAL",
    status: "live" as const,
    body: "Profiles, builder identity, follows, watchlists and parties.",
    calls: ["social.profile(address)", "social.follow(address)", "social.party()"],
  },
  {
    id: "AI",
    status: "soon" as const,
    body: "The agent surface: describe an experience, receive a manifest, review it, then publish it as a normal extender version. Nothing is generated behind your back.",
    calls: ["ai.plan(prompt)", "ai.review(planId)", "ai.publish(planId)"],
  },
];

function SdkPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · CONTRACT</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">BITMAPWIN SDK</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BitmapWin is not a game. It is the layer games, tools, cities and autonomous systems are built on. The SDK is the
        contract both humans and AI agents write against — deliberately readable by a machine, so an agent can build a
        working experience without guessing.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="label border border-bitcoin px-1.5 py-0.5 text-bitcoin" data-no-translate>SDK v{SDK_VERSION}</span>
        <DataBadge kind="live" note="PRIMITIVES BACKED BY REAL SYSTEMS" />
      </div>

      <div className="mt-10 space-y-4">
        {PRIMITIVES.map((p) => (
          <section key={p.id} className="border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="display text-xl">{p.id}</h2>
              <DataBadge kind={p.status} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            <ul className="mt-4 space-y-1 font-mono text-[11px] text-foreground">
              {p.calls.map((call) => (
                <li key={call} data-no-translate>&gt; {call}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-10 border border-border bg-surface p-5">
        <h2 className="display text-xl">LAND PERMISSIONS</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Every extender declares what it needs on a tile. An owner grants rights explicitly; a deployment is refused
          when the live chain says the caller has none.
        </p>
        <ul className="mt-4 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          {LAND_PERMISSIONS.map((perm) => (
            <li key={perm} className="border border-border px-3 py-2" data-no-translate>{perm.toUpperCase()}</li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link to="/studio" className="btn-term">[ START BUILDING ]</Link>
        <Link to="/extenders" className="btn-term-ghost">[ SEE WHAT EXISTS ]</Link>
      </div>
    </div>
  );
}
