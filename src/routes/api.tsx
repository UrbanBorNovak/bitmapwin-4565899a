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
  { method: "GET", path: "/api/public/market/orderbook?depth=20", body: "TRADING · Best ask/bid, spread, mid, last price, 24h volume and the ask/bid ladders." },
  { method: "GET", path: "/api/public/market/listings?sort=price_asc&min_sats=&max_sats=&height=&seller=&limit=&offset=", body: "TRADING · Open listings with seller-signed PSBTs and checkout-hold status." },
  { method: "GET", path: "/api/public/market/trades?height=&limit=", body: "TRADING · On-chain sales tape (confirmed and mempool)." },
  { method: "GET", path: "/api/public/market/bids?height=&limit=", body: "TRADING · Open bids, highest first." },
  { method: "POST", path: "/api/public/market/listings", body: "TRADING · List: body is a seller-signed base64 PSBT (raw or JSON psbt field). Validated against the live UTXO set." },
  { method: "POST", path: "/api/public/market/listings/cancel", body: "TRADING · offerId + signature: BIP-322 signature of the unlist message by the seller address." },
  { method: "POST", path: "/api/public/market/buy/prepare", body: "TRADING · offerId, buyerPaymentAddress, buyerOrdinalsAddress, optional keys: places a 90s hold and returns the buyer PSBT to sign locally." },
  { method: "POST", path: "/api/public/market/buy/broadcast", body: "TRADING · offerId, psbt, buyerAddress: finalizes your signed PSBT and broadcasts it, returning the txid." },
  { method: "POST", path: "/api/public/market/buy/release", body: "TRADING · offerId, buyerAddress: drops your checkout hold early." },
  { method: "POST", path: "/api/public/market/bids", body: "TRADING · bitmapHeight, bidderAddress, priceSats, expiresInHours?, signature: BIP-322 signature of the bid message." },
  { method: "POST", path: "/api/public/market/bids/cancel", body: "TRADING · bidId, address, signature: BIP-322 signature of the cancel message." },
];

const BOT_EXAMPLE = `# 1. Watch the book
curl https://bitmapwin.app/api/public/market/orderbook

# 2. Prepare a buy (90s hold), sign the returned PSBT with YOUR key locally
curl -X POST https://bitmapwin.app/api/public/market/buy/prepare \\
  -H 'content-type: application/json' \\
  -d '{"offerId":"<id>","buyerPaymentAddress":"bc1q...","buyerOrdinalsAddress":"bc1p..."}'

# 3. Broadcast your signed PSBT
curl -X POST https://bitmapwin.app/api/public/market/buy/broadcast \\
  -H 'content-type: application/json' \\
  -d '{"offerId":"<id>","psbt":"<signed base64>","buyerAddress":"bc1p..."}'

# Signed messages (BIP-322):
# bid:    "BITMAP MARKETPLACE BID\\nparcel: <h>.bitmap\\namount: <sats> sats\\nbidder: <addr>"
# cancel: "BITMAP MARKETPLACE CANCEL BID\\nbid: <bidId>\\naddress: <addr>"`;

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

      <section className="mt-8 border border-border p-6">
        <h2 className="display text-xl">TRADING BOTS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bots trade with their own keys: the API builds PSBTs and checks Bitcoin signatures, but never holds or uses your keys.
        </p>
        <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">{BOT_EXAMPLE}</pre>
      </section>
    </div>
  );
}
