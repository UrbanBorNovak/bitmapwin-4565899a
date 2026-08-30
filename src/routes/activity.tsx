import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { activityQuery } from "@/lib/bitmap-queries";
import { timeAgo } from "@/lib/bitmap";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Bitmap Registry Feed" },
      {
        name: "description",
        content: "Live terminal feed of Bitmap listings, sales and newly discovered parcels.",
      },
      { property: "og:title", content: "Activity — Bitmap Registry Feed" },
      {
        property: "og:description",
        content: "Live terminal feed of Bitmap listings, sales and newly discovered parcels.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQuery(60)),
  component: Activity,
});

const HEADLINE: Record<string, string> = {
  listed: "LISTED",
  sold: "SOLD",
  discovered: "NEW BITMAP DISCOVERED",
};

function Activity() {
  const { data: events } = useSuspenseQuery(activityQuery(60));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">ACTIVITY</h1>
      <p className="label mt-3">REGISTRY EVENT STREAM</p>

      <div className="relative mt-8 border border-border bg-card">
        <div className="pointer-events-none absolute inset-0 scanlines" />
        <div className="relative flex items-center justify-between border-b border-border px-4 py-2">
          <span className="label">BITMAP://ACTIVITY</span>
          <span className="label">MAINNET</span>
        </div>
        <div className="relative divide-y divide-border font-mono text-xs">
          {events.map((e) => {
            const price = (e.metadata?.["price_btc"] as string | number | null) ?? null;
            const block = e.block_height ?? (e.metadata?.["block"] as number | undefined);
            return (
              <div key={e.id} className="px-4 py-3">
                <div className="text-foreground">
                  &gt;{" "}
                  {block ? (
                    <Link
                      to="/bitmap/$block"
                      params={{ block: String(block) }}
                      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                    >
                      BITMAP #{block}
                    </Link>
                  ) : (
                    "BITMAP"
                  )}{" "}
                  {HEADLINE[e.type] ?? e.type.toUpperCase()}
                </div>
                <div className="mt-1 pl-4 text-muted-foreground">
                  {price !== null && <div>PRICE: {Number(price).toFixed(3)} BTC</div>}
                  {e.wallet_address && <div>WALLET: {e.wallet_address}</div>}
                  <div>TIME: {timeAgo(e.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 text-foreground">
            &gt; AWAITING NEXT BLOCK<span className="blink">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}
