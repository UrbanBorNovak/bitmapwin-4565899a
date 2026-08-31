import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ParcelCard } from "@/components/ParcelCard";
import { OfferBook } from "@/components/OfferBook";
import { TradeWatcher } from "@/components/TradeWatcher";
import { SettlementWatcher } from "@/components/SettlementWatcher";
import { registryParcelsQuery, type RegistryParcel } from "@/lib/registry";
import { getBlockInscriptions, getRecentInscriptions } from "@/lib/ordinals-scan.functions";
import { saveChainInscriptions } from "@/lib/inscription-store";
import { traceBitmapTradesFn } from "@/lib/trades.functions";
import { saveTrades } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { settleOffersFn } from "@/lib/settle.functions";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — On-Chain Bitmap Trades" },
      {
        name: "description",
        content:
          "Bitmap parcels priced by real Bitcoin transactions: every sale, buyer and holder traced from the chain.",
      },
      { property: "og:title", content: "Marketplace — On-Chain Bitmap Trades" },
      {
        property: "og:description",
        content:
          "Bitmap parcels priced by real Bitcoin transactions: every sale, buyer and holder traced from the chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">MARKET FEED UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <EmptyRegistry />,
});

type Tab = "traded" | "listed" | "all";

/** Traces claims on chain in batches of 40 and stores every transfer found. */
async function traceAndStore(claims: RegistryParcel[]): Promise<{ traced: number; trades: number }> {
  let trades = 0;
  const batches: RegistryParcel[][] = [];
  for (let i = 0; i < claims.length; i += 40) batches.push(claims.slice(i, i + 40));
  for (const batch of batches) {
    const traces = await traceBitmapTradesFn({
      data: {
        claims: batch.map((p) => ({
          bitmapHeight: p.bitmapHeight,
          txid: p.txid,
          inscriptionId: p.inscriptionId,
        })),
        maxHops: 6,
      },
    });
    trades += await saveTrades(traces);
  }
  return { traced: claims.length, trades };
}

function Marketplace() {
  const registry = useQuery(registryParcelsQuery(300));
  const parcels = registry.data ?? [];
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [syncHeight, setSyncHeight] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["registry"] });
    queryClient.invalidateQueries({ queryKey: ["trades"] });
  };

  const sync = useMutation({
    mutationFn: async () => {
      const height = Number(syncHeight);
      const blocks =
        syncHeight.trim() !== "" && Number.isFinite(height)
          ? [await getBlockInscriptions({ data: { height, txPages: 12 } })]
          : await getRecentInscriptions({ data: { blocks: 8, txPages: 6 } });
      const found = blocks.flatMap((b) => b.inscriptions);
      const saved = await saveChainInscriptions(found);
      const claims = found.filter((i) => i.isBitmapClaim);
      const traced = await traceAndStore(
        claims
          .filter((c) => c.bitmapHeight !== null)
          .map(
            (c) =>
              ({
                bitmapHeight: c.bitmapHeight as number,
                txid: c.txid,
                inscriptionId: c.id,
              }) as RegistryParcel,
          ),
      );
      return { saved, claims: claims.length, blocks: blocks.length, trades: traced.trades };
    },
    onSuccess: (r) => {
      invalidate();
      toast(`INDEXED ${r.saved} INSCRIPTION(S)`, {
        description: `${r.claims} CLAIM(S) · ${r.trades} ON-CHAIN TRANSFER(S) ACROSS ${r.blocks} BLOCKS`,
      });
    },
    onError: (e) => toast("CHAIN SYNC FAILED", { description: (e as Error).message }),
  });

  const refreshTrades = useMutation({
    mutationFn: () => traceAndStore(parcels.slice(0, 120)),
    onSuccess: (r) => {
      invalidate();
      toast(`TRACED ${r.traced} PARCEL(S)`, {
        description: `${r.trades} CONFIRMED TRANSFER(S) STORED`,
      });
    },
    onError: (e) => toast("TRADE TRACE FAILED", { description: (e as Error).message }),
  });

  const settle = useMutation({
    mutationFn: () => settleOffersFn({ data: { limit: 40 } }),
    onSuccess: (r) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
      toast(`CHECKED ${r.checked} LISTING(S)`, {
        description: `${r.settled} SETTLED ON CHAIN · ${r.trades} TRANSFER(S) RECORDED`,
      });
    },
    onError: (e) => toast("SETTLEMENT FAILED", { description: (e as Error).message }),
  });

  const listed = useMemo(() => parcels.filter((p) => p.listedSats !== null), [parcels]);
  const traded = useMemo(() => parcels.filter((p) => p.transfers > 0), [parcels]);
  const sold = useMemo(() => parcels.filter((p) => p.lastSaleSats), [parcels]);
  const visible = useMemo(() => {
    const base = tab === "traded" ? traded : tab === "listed" ? listed : parcels;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        String(p.bitmapHeight).includes(q) ||
        p.inscriptionId.toLowerCase().includes(q) ||
        p.txid.toLowerCase().includes(q) ||
        (p.ownerAddress ?? "").toLowerCase().includes(q),
    );
  }, [tab, traded, listed, parcels, search]);

  const saleSats = sold.map((p) => p.lastSaleSats ?? 0).filter((v) => v > 0);
  const floor = saleSats.length ? Math.min(...saleSats) : null;
  const volume = saleSats.reduce((a, b) => a + b, 0);
  const holders = new Set(parcels.map((p) => p.ownerAddress).filter(Boolean)).size;

  const busy = sync.isPending || refreshTrades.isPending || settle.isPending;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">MARKETPLACE</h1>
      <p className="label mt-3">PRICES AND STATUS TRACED FROM REAL BITCOIN TRANSACTIONS</p>

      <div className="mt-8 grid grid-cols-2 divide-border border border-border sm:grid-cols-5 sm:divide-x">
        <Stat k="REGISTERED PARCELS" v={String(parcels.length)} />
        <Stat k="TRADED ON CHAIN" v={String(traded.length)} />
        <Stat
          k="LISTED"
          v={
            listed.length === 0
              ? "0"
              : `${listed.length} · ${formatSats(Math.min(...listed.map((p) => p.listedSats ?? 0)))}`
          }
        />
        <Stat k="LOWEST SALE" v={floor ? formatSats(floor) : "—"} />
        <Stat k="SALE VOLUME" v={volume ? formatSats(volume) : "—"} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          className={tab === "all" ? "btn-term" : "btn-term-ghost"}
          onClick={() => setTab("all")}
        >
          [ ALL PARCELS ]
        </button>
        <button
          className={tab === "traded" ? "btn-term" : "btn-term-ghost"}
          onClick={() => setTab("traded")}
        >
          [ TRADED ]
        </button>
        <button
          className={tab === "listed" ? "btn-term" : "btn-term-ghost"}
          onClick={() => setTab("listed")}
        >
          [ LISTED ]
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH HEIGHT / OWNER / TXID"
          className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <input
          value={syncHeight}
          onChange={(e) => setSyncHeight(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="BLOCK TO INDEX"
          className="w-[150px] border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <button className="btn-term-ghost" disabled={busy} onClick={() => sync.mutate()}>
          {sync.isPending ? "[ SYNCING… ]" : "[ SYNC CHAIN ]"}
        </button>
        <button
          className="btn-term-ghost"
          disabled={busy || parcels.length === 0}
          onClick={() => refreshTrades.mutate()}
        >
          {refreshTrades.isPending ? "[ TRACING TRADES… ]" : "[ TRACE TRADES ]"}
        </button>
        <button className="btn-term-ghost" disabled={busy} onClick={() => settle.mutate()}>
          {settle.isPending ? "[ SETTLING… ]" : "[ SETTLE SALES ]"}
        </button>
        <span className="label">HOLDERS {holders}</span>
      </div>

      {registry.isPending ? (
        <p className="mt-10 border border-border p-10 font-mono text-sm text-muted-foreground">
          &gt; READING THE REGISTRY FROM CHAIN<span className="blink">_</span>
        </p>
      ) : visible.length === 0 ? (
        <EmptyRegistry />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ParcelCard key={p.inscriptionId} parcel={p} />
          ))}
        </div>
      )}

      <TradeWatcher limit={60} />

      <SettlementWatcher limit={40} />

      <OfferBook />
    </div>
  );
}

function EmptyRegistry() {
  return (
    <div className="mt-10 border border-border p-10">
      <h2 className="display text-2xl">NO PARCELS IN THE REGISTRY YET</h2>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; RUN [ SYNC CHAIN ] TO INDEX REAL BITMAP CLAIMS AND THEIR TRADES
        <span className="blink">_</span>
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/explore" className="btn-term">
          [ SCAN THE CHAIN ]
        </Link>
        <Link to="/extractor" className="btn-term-ghost">
          [ INDEX A TRANSACTION ]
        </Link>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-6">
      <div className="label">{k}</div>
      <div className="display mt-2 text-2xl">{v}</div>
    </div>
  );
}
