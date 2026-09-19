import { createFileRoute, Link } from "@tanstack/react-router";
import { DataBadge } from "@/components/extenders/DataBadge";

export const Route = createFileRoute("/api")({
  head: () => {
    const title = "Public API — BitmapWin";
    const description =
      "Public HTTP endpoints for Bitcoin bitmap data: block metadata, marketplace offers and the on-chain trade crawler.";
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
  component: ApiPage,
});

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/public/blocks/{height}",
    body: "Bitmap identity for a block height: name, holder, club, parcel count and inscription reference.",
  },
  {
    method: "GET",
    path: "/api/public/blocks/{height}/meta",
    body: "Extended block statistics: transaction count, byte size and derived shape pattern.",
  },
  {
    method: "GET",
    path: "/api/public/offers",
    body: "Open marketplace offers across all bitmaps, newest first.",
  },
  {
    method: "GET",
    path: "/api/public/offer",
    body: "A single offer with its signed PSBT metadata, by offer identifier.",
  },
  {
    method: "GET",
    path: "/api/public/coin-rewards",
    body: "BIT reward schedule and current attention-based daily distribution state.",
  },
  {
    method: "POST",
    path: "/api/public/crawl-trades",
    body: "Trigger a registry-wide crawl that traces bitmap transfers and confirmed sales from the chain.",
  },
  {
    method: "GET",
    path: "/api/public/resolve-registry",
    body: "Resolve a bitmap height to its canonical first inscription and current holder address.",
  },
  {
    method: "GET",
    path: "/api/public/gallery/{inscriptionId}",
    body: "Membership of an inscribed ordinals gallery, decoded from its reveal transaction. Immutable, so it is cached hard.",
  },
];

function ApiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">DEVELOP · API</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">PUBLIC API</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Open read endpoints over the same chain-traced data the site uses. No key required. Responses are JSON.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="SERVING NOW" />
        <Link to="/sdk" className="btn-term-ghost">[ IN-WORLD SDK ]</Link>
        <Link to="/dev-tools" className="btn-term-ghost">[ DEVELOPER TOOLS ]</Link>
      </div>

      <div className="mt-8 border border-border">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="border-b border-border p-5 last:border-b-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label border border-bitcoin px-1.5 py-0.5 text-bitcoin">{e.method}</span>
              <code className="font-mono text-sm">{e.path}</code>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 border border-border p-6">
        <h2 className="display text-xl">EXAMPLE</h2>
        <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`curl https://bitmapwin.app/api/public/blocks/382441`}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Endpoints are rate-limited and read-only apart from the crawler trigger. If a fact cannot be traced on
          chain, the API omits it rather than estimating it.
        </p>
      </section>
    </div>
  );
}
