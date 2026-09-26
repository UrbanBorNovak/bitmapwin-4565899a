import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { JIGGLYPUFF_IDS, JIGGLYPUFF_POOL } from "@/lib/game/jigglypuff";
import { inscriptionContentUrl } from "@/lib/game/pfpExtenders";
import {
  collectionListingsQuery,
  collectionSalesQuery,
} from "@/lib/collection-sales";
import { formatSats } from "@/lib/trades";
import { BuyButton } from "@/components/BuyButton";
import { ShopListButton } from "@/components/builds/ShopListButton";

const PAGE = 24;
const TITLE = "JIGGLYPUFF — On-chain Collection on BITMAPWIN";
const DESC =
  "218 JIGGLYPUFF inscriptions: confirmed BITMAPWIN sales, current listings and signed PSBT trading.";

export const Route = createFileRoute("/collections/jigglypuff")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JigglypuffCollection,
});

function short(a: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function JigglypuffCollection() {
  const sales = useQuery(collectionSalesQuery(JIGGLYPUFF_POOL));
  const listings = useQuery(collectionListingsQuery(JIGGLYPUFF_POOL, JIGGLYPUFF_IDS));
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "listed">("all");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const paid = (sales.data ?? []).filter((s) => s.priceSats > 0);
    const lastSale = new Map<string, number>();
    for (const s of paid) if (!lastSale.has(s.inscriptionId)) lastSale.set(s.inscriptionId, s.priceSats);
    const open = listings.data ?? [];
    const floor = open.length ? Math.min(...open.map((o) => o.priceSats)) : null;
    const volume = paid.reduce((n, s) => n + s.priceSats, 0);
    return { paid, lastSale, floor, volume, listed: open.length };
  }, [sales.data, listings.data]);

  const offerById = useMemo(
    () => new Map((listings.data ?? []).map((o) => [o.inscriptionId ?? "", o])),
    [listings.data],
  );
  const items = filter === "listed" ? JIGGLYPUFF_IDS.filter((id) => offerById.has(id)) : JIGGLYPUFF_IDS;
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const view = items.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <h1 className="display text-3xl md:text-4xl">JIGGLYPUFF</h1>
      <p className="label mt-2 text-muted-foreground">
        {JIGGLYPUFF_IDS.length} INSCRIPTIONS · HOLDERS EARN MEMBER STATUS · TRADED BY SIGNED PSBT
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["COLLECTION VALUE", "UNAVAILABLE"],
          ["ASKING FLOOR", stats.floor ? formatSats(stats.floor) : "NO LISTINGS"],
           ["CONFIRMED VOLUME", sales.isPending || sales.isError ? "—" : formatSats(stats.volume)],
           ["SALES", sales.isPending || sales.isError ? "—" : String(stats.paid.length)],
          ["LISTED", `${stats.listed} / ${JIGGLYPUFF_IDS.length}`],
        ].map(([k, v]) => (
          <div key={k} className="border border-border bg-card/60 p-3 backdrop-blur">
            <div className="label text-muted-foreground">{k}</div>
            <div className="mt-1 font-mono text-lg text-foreground" data-no-translate>
              {v}
            </div>
          </div>
        ))}
      </div>
      <p className="label mt-2 text-muted-foreground">
         SALES COUNT ONLY CONFIRMED BITMAPWIN PURCHASES WITH MATCHING CHAIN PAYOUTS · ASKING FLOOR IS NOT A SALE · NO VERIFIED COLLECTION VALUATION
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={filter === "all" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setFilter("all");
            setPage(0);
          }}
        >
          ALL
        </button>
        <button
          type="button"
          className={filter === "listed" ? "btn-term" : "btn-term-ghost"}
          onClick={() => {
            setFilter("listed");
            setPage(0);
          }}
        >
          FOR SALE
        </button>
        <span className="label ml-auto">
          PAGE {page + 1}/{pages}
        </span>
        <button type="button" className="btn-term-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
          PREV
        </button>
        <button
          type="button"
          className="btn-term-ghost"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          NEXT
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {view.map((id) => {
          const n = JIGGLYPUFF_IDS.indexOf(id) + 1;
          const offer = offerById.get(id);
          const last = stats.lastSale.get(id);
          const price = Number(prices[id] ?? "");
          return (
            <div key={id} className="border border-border bg-card/60 p-2 backdrop-blur">
              <img
                src={inscriptionContentUrl(id)}
                alt={`JIGGLYPUFF #${n}`}
                loading="lazy"
                className="aspect-square w-full bg-muted object-contain [image-rendering:pixelated]"
              />
              <div className="mt-2 flex items-baseline justify-between">
                <span className="label text-foreground">#{n}</span>
                <a
                  href={`https://ordinals.com/inscription/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="label text-muted-foreground hover:text-foreground"
                >
                  ORD ↗
                </a>
              </div>
              <div className="label mt-1 text-muted-foreground" data-no-translate>
                LAST {last ? formatSats(last) : "—"}
              </div>
              <div className="mt-2 space-y-1">
                {offer ? (
                  <BuyButton offerId={offer.id} priceSats={offer.priceSats} className="btn-term w-full !px-2 !py-1" />
                ) : (
                  <>
                    <input
                      inputMode="numeric"
                      placeholder="PRICE SATS"
                      value={prices[id] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [id]: e.target.value.replace(/\D/g, "") })}
                      className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
                    />
                    <ShopListButton inscriptionId={id} priceSats={price} alreadyListed={false} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

       <h2 className="display mt-12 text-xl">CONFIRMED BITMAPWIN SALES</h2>
       {sales.isPending && <p className="label mt-3 text-muted-foreground">VERIFYING PURCHASES ON CHAIN…</p>}
       {sales.isError && <p className="label mt-3 text-destructive">SALE VERIFICATION UNAVAILABLE — TRY AGAIN LATER</p>}
      <div className="mt-3 overflow-x-auto border border-border">
        <table className="w-full font-mono text-xs" data-no-translate>
          <thead className="label text-muted-foreground">
            <tr>
              <th className="p-2 text-left">ITEM</th>
              <th className="p-2 text-left">PRICE</th>
              <th className="p-2 text-left">SELLER</th>
              <th className="p-2 text-left">BUYER</th>
              <th className="p-2 text-left">BLOCK</th>
              <th className="p-2 text-left">TX</th>
            </tr>
          </thead>
          <tbody>
             {stats.paid.length === 0 && !sales.isPending && !sales.isError && (
              <tr>
                <td colSpan={6} className="p-4 text-muted-foreground">
                   NO VERIFIED BITMAPWIN SALES YET
                </td>
              </tr>
            )}
            {stats.paid.slice(0, 100).map((s) => (
              <tr key={s.txid} className="border-t border-border">
                <td className="p-2">#{JIGGLYPUFF_IDS.indexOf(s.inscriptionId) + 1}</td>
                <td className="p-2 text-primary">{formatSats(s.priceSats)}</td>
                <td className="p-2">{short(s.sellerAddress)}</td>
                <td className="p-2">{short(s.buyerAddress)}</td>
                <td className="p-2">{s.blockHeight ?? "—"}</td>
                <td className="p-2">
                  <a href={`https://mempool.space/tx/${s.txid}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                    {s.txid.slice(0, 10)}…
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
