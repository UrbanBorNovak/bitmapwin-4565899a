import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { recentTradesQuery, tradedBitmapCountQuery, tradeTime } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { districtsQuery } from "@/lib/districts";
import { worldDeploymentsQuery } from "@/lib/extenders";
import { shortenAddress } from "@/lib/registry";
import { LoopNavigator } from "@/components/LoopNavigator";
import { WorldPulse } from "@/components/WorldPulse";

export const Route = createFileRoute("/explore")({
  head: () => {
    const title = "Explore the Bitmap World — BitmapWin";
    const description =
      "Explore Bitcoin land: recent on-chain sales, named districts and live experiences deployed across the 1,000 × 1,000 bitmap world.";
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
  component: ExplorePage,
});

function ExplorePage() {
  const trades = useQuery(recentTradesQuery(24));
  const tradedCount = useQuery(tradedBitmapCountQuery());
  const districts = useQuery(districtsQuery(12));
  const deployments = useQuery(worldDeploymentsQuery(12));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">WORLD · DISCOVERY</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXPLORE THE WORLD</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        One million BITMAPs, permanently indexed to Bitcoin blocks. This is the live pulse: what is selling,
        where people are gathering, and what builders have deployed.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="CHAIN SALES" />
        <Link to="/oasis" className="btn-term">[ ENTER THE OASIS ]</Link>
      </div>
      <div className="mt-6"><LoopNavigator active="explore" /></div>

      <WorldPulse />

      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="display text-xl">LAST CHAIN SALES</h2>
          <span className="label">{tradedCount.data ?? "…"} BITMAPS EVER TRADED</span>
        </div>
        {trades.data && trades.data.length > 0 ? (
          <div className="grid grid-cols-1 border-x border-b border-border sm:grid-cols-2 lg:grid-cols-3">
            {trades.data.map((t) => (
              <Link
                key={t.txid}
                to="/bitmap/$block"
                params={{ block: String(t.bitmap_height) }}
                className="block border-r border-b border-border p-4 font-mono text-xs hover:bg-secondary lg:[&:nth-child(3n)]:border-r-0"
              >
                <div className="flex justify-between">
                  <span className="text-bitcoin">#{t.bitmap_height}</span>
                  <span>{formatSats(t.price_sats)}</span>
                </div>
                <div className="label mt-2 text-[0.55rem]">
                  {tradeTime(t)} · {shortenAddress(t.buyer_address)}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="border-x border-b border-border p-6 label">NO CONFIRMED SALES TRACED YET.</p>
        )}
        <div className="mt-3">
          <Link to="/history" className="btn-term-ghost">[ FULL SALES HISTORY ]</Link>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="display text-xl">DISTRICTS</h2>
            <Link to="/cities" className="label hover:text-foreground">ALL CITIES →</Link>
          </div>
          <div className="border-x border-b border-border">
            {(districts.data ?? []).length === 0 && (
              <p className="p-6 label">NO DISTRICTS NAMED YET — CLAIM LAND AND NAME ONE.</p>
            )}
            {(districts.data ?? []).map((d) => (
              <Link
                key={d.id}
                to="/district/$slug"
                params={{ slug: d.slug }}
                className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-secondary"
              >
                <span className="font-mono text-sm">{d.name}</span>
                <span className="label text-[0.55rem]">{d.heights.length} BITMAPS</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="display text-xl">LIVE EXPERIENCES</h2>
            <Link to="/experiences" className="label hover:text-foreground">ALL →</Link>
          </div>
          <div className="border-x border-b border-border">
            {(deployments.data ?? []).length === 0 && (
              <p className="p-6 label">NOTHING DEPLOYED YET — BE THE FIRST TO EXTEND LAND.</p>
            )}
            {(deployments.data ?? []).slice(0, 8).map((d) => (
              <Link
                key={d.id}
                to="/bitmap/$block"
                params={{ block: String(d.bitmapHeight) }}
                className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-secondary"
              >
                <span className="font-mono text-sm">
                  {d.name}
                  {d.isAiBuilt && <span className="label ml-2 text-[0.5rem] text-bitcoin">AI</span>}
                </span>
                <span className="label text-[0.55rem]">ON #{d.bitmapHeight}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
