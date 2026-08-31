import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — On-Chain Bitmap Transfers" },
      {
        name: "description",
        content:
          "Terminal feed of confirmed Bitcoin transactions moving bitmaps, with prices, buyers and sellers.",
      },
      { property: "og:title", content: "Activity — On-Chain Bitmap Transfers" },
      {
        property: "og:description",
        content:
          "Terminal feed of confirmed Bitcoin transactions moving bitmaps, with prices, buyers and sellers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recentTradesQuery(60)),
  component: Activity,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">FEED UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
    </div>
  ),
  notFoundComponent: () => null,
});

function Activity() {
  const { data: trades } = useSuspenseQuery(recentTradesQuery(60));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">ACTIVITY</h1>
      <p className="label mt-3">CONFIRMED ON-CHAIN TRANSFERS AND SALES</p>

      <div className="relative mt-8 rounded-lg border border-border bg-card">
        <div className="pointer-events-none absolute inset-0 scanlines" />
        <div className="relative flex items-center justify-between border-b border-border px-4 py-2">
          <span className="label">BITMAP://ACTIVITY</span>
          <span className="label">MAINNET</span>
        </div>
        <div className="relative divide-y divide-border font-mono text-xs">
          {trades.length === 0 && (
            <div className="px-4 py-6 text-muted-foreground">
              &gt; NO TRANSFERS INDEXED YET — RUN [ TRACE TRADES ] IN THE MARKETPLACE
            </div>
          )}
          {trades.map((t) => (
            <div key={t.txid} className="px-4 py-3">
              <div className="text-foreground">
                &gt;{" "}
                <Link
                  to="/bitmap/$block"
                  params={{ block: String(t.bitmap_height) }}
                  className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  BITMAP #{t.bitmap_height}
                </Link>{" "}
                {t.price_sats > 0 ? "SOLD" : "TRANSFERRED"}
              </div>
              <div className="mt-1 space-y-0.5 pl-4 text-muted-foreground">
                <div>PRICE: {formatSats(t.price_sats)}</div>
                <div>
                  FROM: {shortenAddress(t.seller_address)} → TO: {shortenAddress(t.buyer_address)}
                </div>
                <div>
                  BLOCK: {t.block_height ?? "—"} · TIME: {timeAgo(t.block_time ?? t.created_at)}
                </div>
                <div>
                  <a
                    className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                    href={`https://mempool.space/tx/${t.txid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    TX: {t.txid.slice(0, 16)}…
                  </a>
                </div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 text-foreground">
            &gt; AWAITING NEXT BLOCK<span className="blink">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}
