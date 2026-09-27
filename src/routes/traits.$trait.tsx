import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyButton } from "@/components/BuyButton";
import { ShopListButton } from "@/components/builds/ShopListButton";
import { BlockMosaic } from "@/components/BlockMosaic";
import { ArchaeologyPanel } from "@/components/ArchaeologyPanel";
import { officialTrait, type TraitId } from "@/lib/traits";
import { traitBitmapsQuery } from "@/lib/trait-collections";
import { inscriptionOffersQuery } from "@/lib/offers";
import { fetchTradesForHeights } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/traits/$trait")({
  beforeLoad: ({ params }) => { if (!officialTrait(params.trait)) throw notFound(); },
  head: ({ params }) => {
    const label = officialTrait(params.trait)?.label ?? "Official Trait";
    const description = `Official ${label} BITMAP definition, indexed inscriptions, listings and verified sales on BITMAPWIN.`;
    return { meta: [
      { title: `${label} BITMAPs — BITMAPWIN` },
      { name: "description", content: description },
      { property: "og:title", content: `${label} BITMAPs — BITMAPWIN` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ] };
  },
  component: TraitDetail,
});

function TraitDetail() {
  const { trait: id } = Route.useParams();
  const trait = officialTrait(id);
  if (!trait) return null;
  const [page, setPage] = useState(0);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const rows = useQuery({ ...traitBitmapsQuery(id as TraitId, page, PAGE_SIZE), enabled: trait.supported });
  const ids = useMemo(() => (rows.data?.items ?? []).map((row) => row.inscriptionId), [rows.data]);
  const heights = useMemo(() => (rows.data?.items ?? []).map((row) => row.bitmapHeight), [rows.data]);
  const offers = useQuery({ ...inscriptionOffersQuery(ids), enabled: ids.length > 0 });
  const trades = useQuery({
    queryKey: ["trait-trades", id, page, heights.join(",")],
    queryFn: () => fetchTradesForHeights(heights),
    enabled: heights.length > 0,
    staleTime: 30_000,
  });
  const factsTrait = trait.marketplaceUse.startsWith("Indexed from real block records");
  const progress = useQuery({
    queryKey: ["block-facts-progress"],
    queryFn: async () => {
      const { data } = await supabase.from("block_facts_crawl_state").select("next_height").eq("id", "main").maybeSingle();
      return data ? Number(data.next_height) : 0;
    },
    enabled: factsTrait,
    refetchInterval: 30_000,
  });
  const offerById = new Map((offers.data ?? []).map((offer) => [offer.inscriptionId, offer]));
  const saleByHeight = new Map((trades.data ?? []).filter((trade) => trade.price_sats > 0).map((trade) => [trade.bitmap_height, trade]));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/traits" className="label hover:text-bitcoin">← ALL OFFICIAL TRAITS</Link>
      <header className="mt-6 border-l-2 border-bitcoin pl-5">
        <p className="font-mono text-[10px] text-muted-foreground">{trait.sourceKey}</p>
        <h1 className="display mt-2 text-3xl md:text-5xl">{trait.label}</h1>
        <p className="mt-3 max-w-3xl font-mono text-xs text-muted-foreground">{trait.description}</p>
      </header>
      <section className="mt-6 border border-border p-4">
        <p className="label text-bitcoin">HOW BITMAPWIN USES IT</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{trait.marketplaceUse}</p>
      </section>

      <ArchaeologyPanel trait={trait} />

      {!trait.supported ? (
        <div className="mt-8 border border-dashed border-border p-8">
          <h2 className="display text-xl">INDEX DATA REQUIRED</h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">&gt; THIS TRAIT CANNOT BE PROVEN FROM BLOCK HEIGHT ALONE. NO INSCRIPTIONS, COUNTS OR HOLDER CLAIMS ARE SHOWN UNTIL ITS REQUIRED ON-CHAIN DATA IS INDEXED.</p>
        </div>
      ) : rows.isPending ? (
        <p className="mt-8 border border-border p-8 font-mono text-xs text-muted-foreground">&gt; READING INDEXED BITMAP INSCRIPTIONS<span className="blink">_</span></p>
      ) : rows.isError ? (
        <p className="mt-8 border border-destructive p-8 font-mono text-xs text-destructive">&gt; TRAIT INDEX UNAVAILABLE</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border border-border p-4">
            <span className="label">GENUINE INDEXED INSCRIPTIONS{factsTrait && progress.data !== undefined ? <span className="ml-3 text-signal">BLOCK RECORDS INDEXED THROUGH {Math.max(0, progress.data - 1).toLocaleString("en-US")}</span> : null}</span>
            <div className="flex items-center gap-2">
              <button className="btn-term-ghost" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>PREV</button>
              <span className="label">PAGE {page + 1}</span>
              <button className="btn-term-ghost" disabled={!rows.data?.hasMore} onClick={() => setPage((value) => value + 1)}>NEXT</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {(rows.data?.items ?? []).map((row) => {
              const offer = offerById.get(row.inscriptionId);
              const sale = saleByHeight.get(row.bitmapHeight);
              const price = Number(prices[row.inscriptionId] ?? "");
              return (
                <article key={row.inscriptionId} className="border border-border bg-card p-3">
                  <BlockMosaic height={row.bitmapHeight} />
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <Link to="/bitmap/$block" params={{ block: String(row.bitmapHeight) }} className="label text-foreground hover:text-bitcoin">{row.bitmapHeight}.BITMAP</Link>
                    <a href={`https://ordinals.com/inscription/${row.inscriptionId}`} target="_blank" rel="noreferrer" className="label hover:text-bitcoin">ORD ↗</a>
                  </div>
                  <p className="label mt-2 text-muted-foreground">LAST {sale ? formatSats(sale.price_sats) : "NO VERIFIED SALE"}</p>
                  <div className="mt-3 space-y-2">
                    {offer ? <BuyButton offerId={offer.id} priceSats={offer.priceSats} className="btn-term w-full !px-2 !py-1" /> : <>
                      <input inputMode="numeric" placeholder="PRICE SATS" value={prices[row.inscriptionId] ?? ""} onChange={(event) => setPrices({ ...prices, [row.inscriptionId]: event.target.value.replace(/\D/g, "") })} className="w-full border border-border bg-background px-2 py-1 font-mono text-xs" />
                      <ShopListButton inscriptionId={row.inscriptionId} priceSats={price} alreadyListed={false} />
                    </>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}