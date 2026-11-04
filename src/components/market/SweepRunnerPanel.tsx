import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildPurchaseFn, releasePurchaseReservationFn, submitPurchaseFn } from "@/lib/purchase.functions";
import { keyCandidates, signPurchasePsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { resolveWallet } from "@/components/BuyButton";
import { trackPurchase } from "@/components/TransferTracker";
import { createSweepRunner, type RunnerSnapshot } from "@/lib/sweep-runner";
import { formatSats } from "@/lib/trades";
import type { CartItem } from "@/lib/sweep-cart";

/** One purchase: server hold + quote, wallet signature, submit. Throws on any failure so the runner skips it. */
async function buyOne(item: CartItem): Promise<{ txid: string | null; spentSats: number }> {
  const wallet = await resolveWallet();
  const tapKey = xOnlyPubKeyHex(wallet.publicKey);
  const quote = await buildPurchaseFn({
    data: {
      offerId: item.offerId,
      buyerPaymentAddress: wallet.paymentAddress,
      buyerOrdinalsAddress: wallet.ordinalsAddress,
      expectedPriceSats: item.priceSats,
      ...(tapKey ? { tapInternalKeyHex: tapKey } : {}),
      ...(keyCandidates(wallet).length > 0 ? { paymentPublicKeyHex: keyCandidates(wallet) } : {}),
    },
  });
  try {
    const signed = await signPurchasePsbt(wallet.provider, quote.psbtBase64, wallet.paymentAddress, quote.signIndices);
    const res = await submitPurchaseFn({ data: { offerId: item.offerId, psbt: signed, buyerAddress: wallet.ordinalsAddress } });
    if (res.txid) trackPurchase({ txid: res.txid, buyerAddress: wallet.ordinalsAddress, inscriptionId: item.inscriptionId, height: item.height });
    return { txid: res.txid ?? null, spentSats: quote.priceSats + quote.marketFeeSats + quote.feeSats };
  } catch (e) {
    void releasePurchaseReservationFn({ data: { offerId: item.offerId, buyerAddress: wallet.ordinalsAddress } }).catch(() => {});
    throw e;
  }
}

export function SweepRunnerPanel({ picks, budgetSats, feeRate }: { picks: CartItem[]; budgetSats: number | null; feeRate: number | null }) {
  const qc = useQueryClient();
  const [snap, setSnap] = useState<RunnerSnapshot | null>(null);
  const runner = useRef<ReturnType<typeof createSweepRunner> | null>(null);
  const feeRef = useRef(feeRate);
  feeRef.current = feeRate;
  const state = snap?.state ?? "idle";
  const active = state === "running" || state === "paused";

  const start = () => {
    if (!window.confirm(`Start a sweep of ${picks.length} BITMAPs? Your wallet asks you to sign each one. Keep this tab open until it finishes.`)) return;
    runner.current = createSweepRunner(picks, { buyOne, feeRate: () => feeRef.current }, { budgetSats }, (s) => {
      setSnap(s);
      if (s.state !== "running") void qc.invalidateQueries({ queryKey: ["offers"] });
    });
    void runner.current.start();
  };

  const bought = snap?.outcomes.filter((o) => o.kind === "bought") ?? [];
  const skipped = snap?.outcomes.filter((o) => o.kind === "skipped") ?? [];
  const exportCsv = () => {
    const rows = ["height,status,txid_or_reason", ...(snap?.outcomes ?? []).map((o) => `${o.item.height},${o.kind},${o.kind === "bought" ? o.txid ?? "" : `"${o.reason.replace(/"/g, "'")}"`}`)];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = "bitmap-sweep.csv";
    a.click();
  };

  return (
    <section className="border border-bitcoin/50 bg-card/60 p-4 backdrop-blur" aria-label="Sweep runner">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="label mr-auto">SWEEP RUNNER</h2>
        {!active && <button className="btn-term !px-3 !py-1" disabled={picks.length === 0} onClick={start}>RUN SWEEP · {picks.length}</button>}
        {state === "running" && <button className="btn-term-ghost !px-3 !py-1" onClick={() => runner.current?.pause()}>PAUSE</button>}
        {state === "paused" && <button className="btn-term !px-3 !py-1" onClick={() => void runner.current?.start()}>RESUME</button>}
        {active && <button className="btn-term-ghost !px-3 !py-1 text-destructive" onClick={() => runner.current?.stop()}>STOP</button>}
        {snap && snap.outcomes.length > 0 && <button className="btn-term-ghost !px-3 !py-1" onClick={exportCsv}>EXPORT CSV</button>}
      </div>
      {snap && (
        <>
          <dl className="mt-3 grid gap-1 font-mono text-[11px] sm:grid-cols-4">
            <div><dt className="label">PROGRESS</dt><dd>{snap.index}/{snap.total} · {state.toUpperCase()}</dd></div>
            <div><dt className="label">BOUGHT</dt><dd className="text-bitcoin">{bought.length}</dd></div>
            <div><dt className="label">SKIPPED</dt><dd>{skipped.length}</dd></div>
            <div><dt className="label">SPENT{budgetSats !== null ? ` / ${formatSats(budgetSats)}` : ""}</dt><dd>{formatSats(snap.spentSats)}</dd></div>
          </dl>
          <div className="mt-2 h-1 bg-border"><div className="h-1 bg-bitcoin" style={{ width: `${snap.total ? (snap.index / snap.total) * 100 : 0}%` }} /></div>
          {snap.note && <p className="mt-2 font-mono text-[11px] text-signal">{snap.note}</p>}
          <ol className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-[10px]">
            {snap.outcomes.slice().reverse().map((o) => (
              <li key={o.item.offerId} className="flex gap-2">
                <span className="w-24">{o.item.height}.BITMAP</span>
                {o.kind === "bought" ? <span className="truncate text-bitcoin">BOUGHT · {o.txid ?? "PENDING"}</span> : <span className="truncate text-muted-foreground">SKIPPED · {o.reason.toUpperCase()}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        THE RUNNER BUYS CHEAPEST FIRST, ONE BITMAP AT A TIME. EACH IS RE-CHECKED AND HELD BY THE SERVER BEFORE YOU SIGN; SOLD OR MOVED ASKS ARE SKIPPED. IT STOPS BEFORE PASSING YOUR BUDGET AND PAUSES IF NETWORK FEES RISE MORE THAN 20%. KEEP THIS TAB OPEN WHILE IT RUNS.
      </p>
    </section>
  );
}
