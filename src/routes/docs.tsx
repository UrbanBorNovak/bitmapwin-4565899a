import { createFileRoute, Link } from "@tanstack/react-router";
import { OtherthingsHierarchy } from "@/components/OtherthingsHierarchy";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";
import {
  BedrockStackInfographic,
  DeployFlowInfographic,
  FirstIsFirstInfographic,
  LoopInfographic,
  ParcelsInfographic,
  RightsInfographic,
} from "@/components/docs/Infographics";
import { ChainStackInfographic } from "@/components/docs/ChainStackInfographic";
import { ForgeBuildInfographic, GuardianLifecycleInfographic } from "@/components/docs/ProtocolInfographics";
import { BWVX_SPEC } from "@/lib/protocol-sdk";


export const Route = createFileRoute("/docs")({
  head: () => {
    const title = "Docs — Build on the Bitcoin Land Bedrock — BitmapWin";
    const description =
      "Guides for BitmapWin: own land, extend it with software, deploy an experience, publish to the registry, and read the SDK contract.";
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
  component: DocsPage,
});

const LOOP = [
  {
    step: "OWN",
    body: "Acquire a BITMAP — the first inscription of a Bitcoin block height. Ownership lives on chain; the site only reads it.",
    to: "/marketplace" as const,
    cta: "MARKETPLACE",
  },
  {
    step: "EXTEND",
    body: "Pick a path: import an extender package, generate one with AI, or install one from the market onto land you hold.",
    to: "/extend" as const,
    cta: "EXTEND",
  },
  {
    step: "DEPLOY",
    body: "Publish a version and deploy it to a height. Rights are rechecked against the chain at deploy time — no faked success.",
    to: "/studio" as const,
    cta: "STUDIO",
  },
  {
    step: "EXPERIENCE",
    body: "Walk into the deployment in the shared 3D world with other players. State persists per deployment and per player.",
    to: "/map" as const,
    cta: "MAP",
  },
  {
    step: "PUBLISH",
    body: "List the extender in the registry so others can install it on their own land, and appear on the builders board.",
    to: "/extenders" as const,
    cta: "REGISTRY",
  },
];

const REFERENCES = [
  { to: "/play-guide" as const, title: "PLAYER GUIDE", body: "Controls on desktop and phone, what lives in the Oasis, graphics quality presets, BIT, parties, clans and streaming." },
  { to: "/sdk" as const, title: "SDK REFERENCE", body: "Land, build, player, world, economy, social and AI primitives with call signatures and runtime limits." },
  { to: "/api" as const, title: "PUBLIC API", body: "HTTP endpoints for block metadata, offers and the trade crawler — usable from anything." },
  { to: "/dev-tools" as const, title: "DEVELOPER TOOLS", body: "SDK playground, MCP endpoint and the AI package builder." },
  { to: "/land-101" as const, title: "BITCOIN LAND 101", body: "Animated explainer: inscriptions, first-is-first validation and parcels." },
  { to: "/ownership" as const, title: "OWNERSHIP RULES", body: "How deeds, parcels, grants and leases relate to each other." },
  { to: "/leases" as const, title: "LEASES", body: "Rent build rights on land you do not own, priced per day in BIT." },
];

function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-3"><OtherthingsBadge child="Protocol" /></div>
      <div className="label text-bitcoin">DEVELOP · DOCS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">DOCS</h1>
      <div className="mt-6"><OtherthingsHierarchy /></div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BitmapWin gives you land, persistence, ownership, a runtime, extensibility, discovery and a market.
        You bring the world. Start with the loop.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/play-guide" className="btn-term">[ PLAYER GUIDE ]</Link>
        <Link to="/sdk" className="btn-term-ghost">[ SDK ]</Link>
        <Link to="/api" className="btn-term-ghost">[ API ]</Link>
      </div>

      <div className="mt-8">
        <ChainStackInfographic />
      </div>
      <div className="mt-6">
        <BedrockStackInfographic />
      </div>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">THE LOOP</h2>
        <div className="mt-4">
          <LoopInfographic />
        </div>
        <div className="mt-4 border-x border-b border-t border-border">
          {LOOP.map((s, i) => (
            <div key={s.step} className="flex flex-col gap-3 border-b border-border p-5 last:border-b-0 md:flex-row md:items-center">
              <div className="w-32 shrink-0">
                <span className="label text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
                <div className="display text-lg">{s.step}</div>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <Link to={s.to} className="btn-term-ghost shrink-0">[ {s.cta} ]</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">HOW OWNERSHIP WORKS</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <FirstIsFirstInfographic />
          <ParcelsInfographic />
          <RightsInfographic />
          <DeployFlowInfographic />
        </div>
      </section>



      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">GUARDIANS — SUMMON, INSCRIBE, BREED</h2>
        <div className="mt-4"><GuardianLifecycleInfographic /></div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">LAND FORGE — BUILD ON YOUR BITMAP</h2>
        <div className="mt-4"><ForgeBuildInfographic /></div>
        <pre data-no-translate className="mt-4 overflow-x-auto border border-border bg-surface p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{BWVX_SPEC}</pre>
      </section>

      <section id="tiny-tools" className="mt-10 scroll-mt-20">
        <h2 className="display border-b border-border pb-2 text-xl">TINY TOOLS — ONE-FILE APPS YOU CAN INSCRIBE</h2>
        <div className="mt-4 grid gap-px border border-border bg-border md:grid-cols-2">
          <div className="space-y-2 bg-background p-5 text-sm leading-relaxed text-muted-foreground">
            <div className="display text-base text-foreground">TINY STORE KIT</div>
            <p>Make a one-file shop for BITMAPs: name, tagline, colour, seller address, block range, max price, sort. Share the link to keep your settings.</p>
            <p><span className="text-foreground">FAST</span> (~1.8 KB packed) shows live BitmapWin listings; BUY opens that BITMAP on the main marketplace. An empty range shows 0 for sale — only listed BITMAPs appear.</p>
            <p><span className="text-foreground">SOVEREIGN</span> (~5 KB packed) reads signed Nostr listings and checks each one on Bitcoin, with in-page checkout. Download and host it — do not inscribe it: ordinals.com runs inscriptions in a sandbox that blocks the outside connections this shop needs, so an inscribed copy would never show listings. Limits: buying works with UniSat only; open it in its own tab; buyers need 3 separate plain coins; only blocks up to 969,999; raising a price or cancelling means moving the BITMAP. Still reads ordinals.com and mempool.space.</p>
            <Link to="/store-kit" className="btn-term-ghost inline-block">[ OPEN STORE KIT ]</Link>
          </div>
          <div className="space-y-2 bg-background p-5 text-sm leading-relaxed text-muted-foreground">
            <div className="display text-base text-foreground">TINY STUDIO</div>
            <p>A 3D voxel viewer and builder in ~5.5 KB packed. ORBIT or WALK, then LOOK, PLACE or ERASE (keys 1–3, V for view). Phones: drag in the left circle to walk.</p>
            <p>LOAD (one box, block number or inscription id) shows starter ground, then the BITMAP's newest Land Forge or Tiny Studio build by block number or inscription id. EXPORT .BWVX saves blocks (4 bytes each, Land Forge format); SAVE .HTML keeps your build inside the file.</p>
            <p>Limits: the starter ground is a formula, not the BITMAP's real layout or parcel limits; only standard 64-size builds load (not XL or recursive); block lookup covers up to 969,999 — use an inscription id for newer. Anyone can remix on screen; only the holder can make it permanent on Bitcoin.</p>
            <Link to="/tiny-studio" className="btn-term-ghost inline-block">[ OPEN TINY STUDIO ]</Link>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Put the FAST shop or Tiny Studio on Bitcoin with <span data-no-translate className="font-mono">ord wallet inscribe --fee-rate &lt;sats/vB&gt; --file index.html --compress</span>. You sign and send it yourself — BitmapWin never does. The SOVEREIGN shop is hosted instead of inscribed, because ordinals.com blocks the outside connections it needs.</p>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">REFERENCES</h2>
        <div className="grid gap-px border border-t-0 border-border bg-border md:grid-cols-2">
          {REFERENCES.map((r) => (
            <Link key={r.to} to={r.to} className="bg-background p-5 hover:bg-secondary">
              <div className="display text-base">{r.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
