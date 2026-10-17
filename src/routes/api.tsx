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
  { method: "POST", path: "/api/public/market/listings/cancel", body: "TRADING · offerId, issuedAt, signature: BIP-322 signature of the unlist message by the seller address." },
  { method: "POST", path: "/api/public/market/buy/prepare", body: "TRADING · offerId, buyerPaymentAddress, buyerOrdinalsAddress, optional keys: places a 90s hold and returns the buyer PSBT to sign locally." },
  { method: "POST", path: "/api/public/market/buy/broadcast", body: "TRADING · offerId, psbt, buyerAddress: finalizes your signed PSBT and broadcasts it, returning the txid." },
  { method: "POST", path: "/api/public/market/bids", body: "TRADING · bitmapHeight, bidderAddress, priceSats, expiresInHours?, issuedAt, signature: BIP-322 signature of the bid message." },
  { method: "POST", path: "/api/public/market/bids/cancel", body: "TRADING · bidId, address, issuedAt, signature: BIP-322 signature of the cancel message." },
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

# Signed messages (BIP-322). issuedAt = ISO UTC time, valid 10 min, each signature works once:
# bid:    "BITMAPWIN API BID\nparcel: <h>.bitmap\namount: <sats> sats\nbidder: <addr>\nissued: <issuedAt>"
# cancel: "BITMAPWIN API CANCEL BID\nbid: <bidId>\naddress: <addr>\nissued: <issuedAt>"
# unlist: "BITMAPWIN API UNLIST\nlisting: <offerId>\naddress: <seller>\nissued: <issuedAt>"
#
# Limits: 120 reads/min per IP · 20 writes/min per IP · 10 writes/min per wallet
# · 6 checkout holds/min · max 2 live holds per buyer. HTTP 429 = slow down.
# Broadcast is refused if the seller payout or inscription delivery output is altered.`;

const CLIENT_EXAMPLE = `import { BitmapWinClient } from "./bitmapwin-client";

const bw = new BitmapWinClient();          // baseUrl defaults to https://bitmapwin.app

const book = await bw.market.orderbook(10);
const { listings } = await bw.market.listings({ max_sats: 100_000, sort: "price_asc", limit: 1 });

// Bid: build the exact message, sign it with YOUR wallet (BIP-322), then submit
const issuedAt = bw.issuedAt();
const msg = bw.messages.bid(840000, 50_000, "bc1p...", issuedAt);
const signature = await wallet.signMessage(msg, "bip322-simple");
await bw.market.placeBid({ bitmapHeight: 840000, bidderAddress: "bc1p...", priceSats: 50_000, issuedAt, signature });

// Errors carry the HTTP status (e.g. 429 = slow down)
// catch (e) { if (e instanceof BitmapWinApiError && e.status === 429) ... }`;

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

      <section className="mt-8 border border-border p-6">
        <h2 className="display text-xl">TYPESCRIPT CLIENT</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A typed, dependency-free client for browsers, Node, Bun and Deno. It builds the exact messages to sign; your wallet signs them.
        </p>
        <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">{CLIENT_EXAMPLE}</pre>
      </section>

      <section className="mt-8 border border-border p-6">
        <h2 className="display text-xl">BOT STARTER KIT</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A ready-to-run repository: TypeScript and Python floor monitors, the typed client above, the exact BIP-322
          messages the server verifies, and bid / cancel / unlist helpers. MIT licensed — start your own bot from it in
          one click. Nothing signs or broadcasts on its own.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="https://github.com/UrbanBorNovak/bitmapwin-bot-starter"
            target="_blank"
            rel="noreferrer"
            className="btn-term-ghost"
          >
            [ VIEW ON GITHUB ]
          </a>
          <a
            href="https://github.com/UrbanBorNovak/bitmapwin-bot-starter/generate"
            target="_blank"
            rel="noreferrer"
            className="btn-term-ghost"
          >
            [ USE AS TEMPLATE ]
          </a>
        </div>
      </section>
    </div>
  );
}
