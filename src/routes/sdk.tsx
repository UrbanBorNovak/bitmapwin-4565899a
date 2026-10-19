import { createFileRoute, Link } from "@tanstack/react-router";
import { OtherthingsHierarchy } from "@/components/OtherthingsHierarchy";
import { DataBadge } from "@/components/extenders/DataBadge";
import { LAND_PERMISSIONS, SDK_VERSION } from "@/lib/extenders";
import { RUNTIME_LIMITS, SDK_MODULES, SDK_TYPES, STARTER_TEMPLATES } from "@/lib/extender-sdk";
import { ForgeBuildInfographic, GuardianLifecycleInfographic } from "@/components/docs/ProtocolInfographics";
import { AGENT_TOOLS, BWVX_SPEC } from "@/lib/protocol-sdk";
import { BWVX_LOADER_JS } from "@/lib/bwvx-export";

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

      <div className="mt-8"><OtherthingsHierarchy compact /></div>
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

      <section className="mt-12 border border-border bg-surface p-5" id="bwvx-loader">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-2xl">BWVXLOADER.JS — ONE DRAW CALL</h2>
          <button type="button" className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-card" onClick={() => void navigator.clipboard.writeText(BWVX_LOADER_JS)}>COPY LOADER</button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Render any Land Forge payload (BWVX1 or BWVX2) in your own Three.js viewer as a single InstancedMesh. Need Blender or Unreal? Use DOWNLOAD .GLB in Land Forge.</p>
        <pre className="mt-3 max-h-96 overflow-auto rounded border border-border bg-background p-3 font-mono text-xs"><code>{BWVX_LOADER_JS}</code></pre>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-2xl">RUNTIME API — CODE THAT ACTUALLY RUNS</h2>
          <DataBadge kind="live" note="EXECUTES IN A SANDBOX ON DEPLOYED LAND" />
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A published version can carry JavaScript. It runs in a sealed sandbox — no page, no network, no wallet — and can
          only describe objects, movement and quests, which every visitor standing on that BITMAP then sees.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/sdk-playground" className="btn-term">[ WRITE AND RUN CODE NOW ]</Link>
        </div>
        <div className="mt-5 space-y-4">
          {SDK_MODULES.map((module) => (
            <section key={module.id} className="border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="display text-lg" data-no-translate>{module.id}</h3>
                <DataBadge kind={module.status} />
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{module.body}</p>
              <ul className="mt-4 space-y-2">
                {module.calls.map((call) => (
                  <li key={call.signature} className="font-mono text-[11px]">
                    <span className="text-foreground" data-no-translate>&gt; {call.signature}</span>
                    <span className="ml-2 text-muted-foreground">{call.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-4 border border-border bg-surface p-4">
          <div className="label text-bitcoin">TYPES INJECTED INTO EVERY SANDBOX</div>
          <pre
            data-no-translate
            className="mt-3 overflow-x-auto font-mono text-[10px] leading-relaxed text-muted-foreground"
          >
            {SDK_TYPES}
          </pre>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {STARTER_TEMPLATES.map((template) => (
            <div key={template.id} className="border border-border bg-surface p-4">
              <div className="label text-bitcoin" data-no-translate>{template.name}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{template.summary}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid gap-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-3">
          <li className="border border-border px-3 py-2" data-no-translate>MAX {RUNTIME_LIMITS.maxProps} OBJECTS</li>
          <li className="border border-border px-3 py-2" data-no-translate>MAX {RUNTIME_LIMITS.maxQuests} QUESTS</li>
          <li className="border border-border px-3 py-2" data-no-translate>MAX {RUNTIME_LIMITS.maxCodeBytes} CODE BYTES</li>
        </ul>
      </section>

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

      <section className="mt-12">
        <h2 className="display text-2xl">AGENT TOOLS — GUARDIANS & LAND FORGE</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Machine-readable recipes an AI agent can follow. Agents prepare and preview; a human wallet always signs and pays.
        </p>
        <div className="mt-5 space-y-4">
          <GuardianLifecycleInfographic />
          <ForgeBuildInfographic />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {AGENT_TOOLS.map((t) => (
            <section key={t.name} className="border border-border bg-surface p-4">
              <div className="label text-bitcoin" data-no-translate>{t.name}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
              <pre data-no-translate className="mt-3 overflow-x-auto font-mono text-[10px] text-foreground">{JSON.stringify({ input: t.input, output: t.output }, null, 2)}</pre>
            </section>
          ))}
        </div>
        <pre data-no-translate className="mt-4 overflow-x-auto border border-border bg-surface p-4 font-mono text-[10px] leading-relaxed text-muted-foreground">{BWVX_SPEC}</pre>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link to="/studio" className="btn-term">[ START BUILDING ]</Link>
        <Link to="/extenders" className="btn-term-ghost">[ SEE WHAT EXISTS ]</Link>
      </div>
    </div>
  );
}
