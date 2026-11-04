import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { openOffersQuery } from "@/lib/offers";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";
import { cart, useCart } from "@/lib/sweep-cart";
import { BULK_MAX, batches, planSweep } from "@/lib/bulk-plan";
import { TradeSlip, useFees } from "@/components/market/TradeSlip";
import { BulkSellDrawer } from "@/components/market/BulkSellDrawer";
import { SweepRunnerPanel } from "@/components/market/SweepRunnerPanel";

export const Route = createFileRoute("/bulk")({
  head: () => ({
    meta: [
      { title: "Bulk Terminal — Sweep or List up to 1,000 BITMAPs" },
      { name: "description", content: "Plan a sweep of up to 1,000 open BITMAP asks by budget, height and price, then buy batch by batch with your own wallet. Bulk list from the same page." },
      { property: "og:title", content: "Bulk Terminal — Sweep or List up to 1,000 BITMAPs" },
      { property: "og:description", content: "Cheapest-first sweep planning for up to 1,000 BITMAPs, signed batch by batch in your own wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulkPage,
});

const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);

function BulkPage() {
  const wallet = useWalletSession();
  const asks = useQuery(openOffersQuery());
  const fees = useFees();
  const slip = useCart();
  const [count, setCount] = useState("100");
  const [budget, setBudget] = useState("");
  const [minH, setMinH] = useState("");
  const [maxH, setMaxH] = useState("");
  const [maxP, setMaxP] = useState("");

  const plan = useMemo(() => planSweep(
    (asks.data ?? []).map((a) => ({ id: a.id, bitmapHeight: a.bitmapHeight, inscriptionId: a.inscriptionId, priceSats: a.priceSats, sellerAddress: a.sellerAddress })),
    { count: num(count) ?? 0, budgetSats: num(budget), minHeight: num(minH), maxHeight: num(maxH), maxPriceSats: num(maxP), ownAddress: wallet?.ordinalsAddress },
  ), [asks.data, count, budget, minH, maxH, maxP, wallet?.ordinalsAddress]);
  const groups = batches(plan.picks);
  const mkt = Math.round((plan.totalSats * MARKETPLACE_FEE_PERCENT) / 100);
  const inSlip = new Set(slip.map((s) => s.offerId));

  const field = (label: string, v: string, set: (s: string) => void, ph: string) => (
    <label className="label flex flex-col gap-1">{label}
      <input value={v} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={ph} aria-label={label}
        className="w-36 border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground focus:border-foreground focus:outline-none" />
    </label>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8" data-no-translate>
      <header className="space-y-2">
        <h1 className="display text-3xl">BULK TERMINAL</h1>
        <p className="font-mono text-[11px] text-muted-foreground">
          PLAN A SWEEP OF UP TO {BULK_MAX.toLocaleString("en-US")} OPEN ASKS · CHEAPEST FIRST · YOUR OWN ASKS EXCLUDED
        </p>
        <div className="flex flex-wrap gap-2"><BulkSellDrawer /><Link to="/marketplace" className="btn-term-ghost min-h-11">MARKETPLACE</Link></div>
      </header>

      <section className="border border-border bg-card/60 p-4 backdrop-blur">
        <h2 className="label mb-3">SWEEP PLAN</h2>
        <div className="flex flex-wrap gap-3">
          {field(`HOW MANY (MAX ${BULK_MAX})`, count, setCount, "100")}
          {field("BUDGET SATS", budget, setBudget, "ANY")}
          {field("MAX PRICE EACH", maxP, setMaxP, "ANY")}
          {field("MIN HEIGHT", minH, setMinH, "0")}
          {field("MAX HEIGHT", maxH, setMaxH, "ANY")}
        </div>
        <dl className="mt-4 grid gap-1 font-mono text-[11px] sm:grid-cols-4">
          <div><dt className="label">OPEN ASKS READ</dt><dd>{asks.isLoading ? "…" : (asks.data?.length ?? 0).toLocaleString("en-US")}</dd></div>
          <div><dt className="label">PICKED</dt><dd className="text-bitcoin">{plan.picks.length} IN {groups.length} BATCHES</dd></div>
          <div><dt className="label">ASKS TOTAL · FEE {MARKETPLACE_FEE_PERCENT}%</dt><dd>{formatSats(plan.totalSats)} · ≈{mkt.toLocaleString("en-US")} SATS</dd></div>
          <div><dt className="label">NETWORK NOW</dt><dd className="text-signal">{fees.data ? `${fees.data.halfHourFee} SAT/VB` : "…"}</dd></div>
        </dl>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          HOW IT RUNS: LOAD ONE BATCH (UP TO 20) INTO THE TRADE SLIP, THEN BUY EACH ONE THERE. EVERY BITMAP IS STILL ITS OWN PURCHASE, HELD FOR YOU FOR 90 SECONDS AND SIGNED IN YOUR WALLET WITH ITS EXACT MINER FEE SHOWN FIRST. ASKS THAT SELL MEANWHILE FAIL SAFELY. ONE-TRANSACTION MULTI-BUYS ARE NOT ENABLED YET — THEY WAIT ON INDEPENDENT REVIEW.
        </p>
      </section>

      <SweepRunnerPanel picks={plan.picks} budgetSats={num(budget)} feeRate={fees.data?.halfHourFee ?? null} />

      <section className="space-y-2">
        {groups.length === 0 && <p className="font-mono text-[11px] text-muted-foreground">{asks.isLoading ? "READING OPEN ASKS…" : "NO OPEN ASKS MATCH THIS PLAN."}</p>}
        {groups.map((g, i) => {
          const loaded = g.every((x) => inSlip.has(x.offerId));
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 border border-border px-3 py-2 font-mono text-[11px]">
              <span className="w-24 font-bold">BATCH {i + 1}/{groups.length}</span>
              <span className="text-muted-foreground">{g.length} · {formatSats(g.reduce((s, x) => s + x.priceSats, 0))}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.map((x) => x.height).join(", ")}</span>
              <button className={loaded ? "btn-term-ghost !px-2 !py-1" : "btn-term !px-2 !py-1"} disabled={loaded}
                onClick={() => { cart.clear(); cart.add(g); }}>{loaded ? "IN SLIP" : "LOAD INTO SLIP"}</button>
            </div>
          );
        })}
      </section>
      <TradeSlip />
    </main>
  );
}
