import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { paidSalesQuery, tradedBitmapCountQuery, tradeTime } from "@/lib/trade-store";
import { SalesBollingerChart } from "@/components/SalesBollingerChart";
import { formatSats, SATS_PER_BTC } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/history")({
  head: () => {
    const title = "Sales History — Confirmed On-Chain Bitmap Trades — BitmapWin";
    const description =
      "Every confirmed on-chain bitmap sale traced by BitmapWin: price in sats, buyer, seller, and the Bitcoin transaction that settled it.";
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
  component: HistoryPage,
});

function HistoryPage() {
  const trades = useQuery(paidSalesQuery());
  const tradedCount = useQuery(tradedBitmapCountQuery());

  const all = trades.data ?? [];
  const rows = [...all].sort((a, b) => new Date(b.block_time ?? b.created_at).getTime() - new Date(a.block_time ?? a.created_at).getTime());
  const totalSats = rows.reduce((s, t) => s + (t.price_sats || 0), 0);
  const maxSale = rows.reduce((m, t) => Math.max(m, t.price_sats || 0), 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">LAND · HISTORY</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">CHAIN SALES HISTORY</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Every row below is a real Bitcoin transaction where a bitmap inscription moved and the seller was paid.
        No reported prices, no wash-trade guesses — traced settlement only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="TRACED ON-CHAIN" />
        <Link to="/marketplace" className="btn-term">[ BACK TO MARKET ]</Link>
      </div>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="TRACED SALES" v={trades.isLoading ? "…" : String(rows.length)} />
        <Stat k="BITMAPS EVER TRADED" v={tradedCount.data != null ? String(tradedCount.data) : "…"} />
        <Stat k="TOTAL VOLUME" v={`${(totalSats / SATS_PER_BTC).toFixed(4)} BTC`} />
        <Stat k="TOP SALE" v={formatSats(maxSale)} />
      </section>

      <SalesBollingerChart rows={all} loading={trades.isLoading} />


      <div className="mt-8 overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] font-mono text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label px-4 py-3 font-normal">BITMAP</th>
              <th className="label px-4 py-3 font-normal">PRICE</th>
              <th className="label px-4 py-3 font-normal">BUYER</th>
              <th className="label px-4 py-3 font-normal">SELLER</th>
              <th className="label px-4 py-3 font-normal">TIME</th>
              <th className="label px-4 py-3 font-normal">TX</th>
            </tr>
          </thead>
          <tbody>
            {trades.isLoading && (
              <tr><td colSpan={6} className="label px-4 py-6">TRACING SALES…</td></tr>
            )}
            {!trades.isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="label px-4 py-6">NO CONFIRMED SALES TRACED YET. THE CRAWLER KEEPS WATCHING THE CHAIN.</td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.txid} className="border-b border-border last:border-b-0 hover:bg-secondary">
                <td className="px-4 py-3">
                  <Link to="/bitmap/$block" params={{ block: String(t.bitmap_height) }} className="text-bitcoin hover:underline">
                    #{t.bitmap_height}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatSats(t.price_sats)}</td>
                <td className="px-4 py-3">{shortenAddress(t.buyer_address)}</td>
                <td className="px-4 py-3">{shortenAddress(t.seller_address)}</td>
                <td className="label px-4 py-3 text-[0.6rem]">{tradeTime(t)}</td>
                <td className="px-4 py-3">
                  <a
                    href={`https://mempool.space/tx/${t.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground"
                  >
                    {t.txid.slice(0, 10)}…
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-r border-border p-4 last:border-r-0 md:border-b-0">
      <div className="label">{k}</div>
      <div className="display mt-2 text-xl">{v}</div>
    </div>
  );
}
