import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { collectionListingsQuery } from "@/lib/collection-sales";
import { getCollectionSalesFn } from "@/lib/collection-sales.functions";
import { CollectionSalesChart } from "@/components/market/CollectionSalesChart";
import { formatSats } from "@/lib/trades";
import { BuyButton } from "@/components/BuyButton";
import { ShopListButton } from "@/components/builds/ShopListButton";

export type MarketItem = { id: string; label: string; sub?: string };

/** Shared BITMAP-collection market: live listings, buy via signed PSBT, list from your wallet. */
export function InscriptionCollectionMarket({
  pool, title, blurb, items, loading, pageSize = 24, preview, initialQuery = "",
}: {
  pool: string; title: string; blurb: string; items: MarketItem[]; loading?: boolean;
  pageSize?: number; preview: (item: MarketItem) => ReactNode; initialQuery?: string;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const listings = useQuery({ ...collectionListingsQuery(pool, ids), enabled: ids.length > 0 });
  const sales = useQuery({ queryKey: ["collection-sales", pool, ids.length], queryFn: () => getCollectionSalesFn({ data: { ids } }), enabled: ids.length > 0, staleTime: 60_000 });
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "listed">("all");
  const [q, setQ] = useState(initialQuery);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const offerById = useMemo(() => new Map((listings.data ?? []).map((o) => [o.inscriptionId ?? "", o])), [listings.data]);
  const open = listings.data ?? [];
  const floor = open.length ? Math.min(...open.map((o) => o.priceSats)) : null;
  const needle = q.trim().toLowerCase();
  const list = items.filter((i) => (filter === "all" || offerById.has(i.id)) &&
    (!needle || i.id.toLowerCase().includes(needle) || i.label.toLowerCase().includes(needle) || (i.sub ?? "").toLowerCase().includes(needle)));
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const view = list.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <h1 className="display text-3xl md:text-4xl">{title}</h1>
      <p className="label mt-2 text-muted-foreground">{blurb}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {[["ITEMS", loading ? "…" : items.length.toLocaleString("en-US")], ["ASKING FLOOR", floor ? formatSats(floor) : "NO LISTINGS"], ["LISTED", String(open.length)]].map(([k, v]) => (
          <div key={k} className="border border-border bg-card/60 p-3 backdrop-blur">
            <div className="label text-muted-foreground">{k}</div>
            <div className="mt-1 font-mono text-lg text-foreground" data-no-translate>{v}</div>
          </div>
        ))}
      </div>
      <CollectionSalesChart sales={sales.data?.sales ?? []} pending={ids.length > 0 && sales.isPending} unavailable={sales.isError || !!sales.data?.unavailable} />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" className={filter === "all" ? "btn-term" : "btn-term-ghost"} onClick={() => { setFilter("all"); setPage(0); }}>ALL</button>
        <button type="button" className={filter === "listed" ? "btn-term" : "btn-term-ghost"} onClick={() => { setFilter("listed"); setPage(0); }}>FOR SALE</button>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="SEARCH NAME OR ID" className="border border-border bg-background px-2 py-1 font-mono text-xs" />
        <span className="label ml-auto">PAGE {page + 1}/{pages}</span>
        <button type="button" className="btn-term-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>PREV</button>
        <button type="button" className="btn-term-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>NEXT</button>
      </div>
      {loading && <p className="label mt-4 text-signal">READING CHILDREN FROM CHAIN…</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {view.map((item) => {
          const offer = offerById.get(item.id);
          const price = Number(prices[item.id] ?? "");
          return (
            <div key={item.id} className="border border-border bg-card/60 p-2 backdrop-blur">
              {preview(item)}
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="label truncate text-foreground">{item.label}</span>
                <a href={`https://ordinals.com/inscription/${item.id}`} target="_blank" rel="noreferrer" className="label text-muted-foreground hover:text-foreground">ORD ↗</a>
              </div>
              {item.sub && <div className="label mt-1 truncate text-muted-foreground">{item.sub}</div>}
              <div className="mt-2 space-y-1">
                {offer ? (
                  <BuyButton offerId={offer.id} priceSats={offer.priceSats} className="btn-term w-full !px-2 !py-1" />
                ) : (
                  <>
                    <input inputMode="numeric" placeholder="PRICE SATS" value={prices[item.id] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value.replace(/\D/g, "") })}
                      className="w-full border border-border bg-background px-2 py-1 font-mono text-xs" />
                    <ShopListButton inscriptionId={item.id} priceSats={price} alreadyListed={false} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
