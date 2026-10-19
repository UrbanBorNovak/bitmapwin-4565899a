import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BuyButton } from "@/components/BuyButton";
import { formatSats } from "@/lib/trades";
import { shortenAddress, type RegistryParcel } from "@/lib/registry";
import { sweepCheapest } from "@/lib/market-sweep";
import { cart } from "@/lib/sweep-cart";
import { CartToggle } from "@/components/market/TradeSlip";
import { FloorDelta } from "@/components/ParcelCard";
import type { BitmonCheck } from "@/lib/bitmon-verify";

/** Floor sweeper: lines up the N cheapest open asks; each buy is still its own wallet-signed PSBT. */
export function FloorSweeper({ listed }: { listed: RegistryParcel[] }) {
  const [n, setN] = useState(3);
  const { picks, totalSats } = useMemo(() => sweepCheapest(listed, n), [listed, n]);
  if (listed.length === 0) return null;
  return (
    <section className="mb-4 border border-bitcoin/50 bg-card p-4" aria-label="Floor sweeper">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="label text-bitcoin">FLOOR SWEEP</h2>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">CHEAPEST OPEN ASKS · EACH BUY IS SIGNED IN YOUR WALLET</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sweep size">
          {[1, 3, 5, 10].map((k) => (
            <button key={k} type="button" onClick={() => setN(k)} aria-pressed={n === k}
              className={`h-8 min-w-8 border px-2 font-mono text-[11px] ${n === k ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`}>{k}</button>
          ))}
          <input type="range" min={1} max={15} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of BITMAPs to sweep" className="w-28 accent-[hsl(var(--bitcoin))]" />
          <span className="font-mono text-[11px] text-bitcoin" data-no-translate>{n}</span>
        </div>
        <div className="text-right font-mono" data-no-translate>
          <div className="text-base font-bold text-bitcoin">{totalSats ? `${(totalSats / 1e8).toFixed(8)} BTC` : "—"}</div>
          {totalSats > 0 && <div className="text-[10px] text-muted-foreground">{totalSats.toLocaleString("en-US")} SATS · BEFORE FEES</div>}
          <div className="text-[10px] text-muted-foreground">{picks.length} BITMAPS{picks.length ? ` · AVG ${formatSats(Math.round(totalSats / picks.length))}` : ""}</div>
          {fees.data && picks.length > 0 && <div className="text-[10px] text-signal">NETWORK {fees.data.halfHourFee} SAT/VB · {picks.length} SEPARATE TXS · EXACT FEE QUOTED PER BUY</div>}
          {picks.length > 0 && (
            <button type="button" className="btn-term mt-1 !px-2 !py-1 text-[10px]"
              onClick={() => cart.add(picks.filter((p) => p.listedOfferId && p.listedSats).map((p) => ({ offerId: p.listedOfferId!, height: p.bitmapHeight, priceSats: p.listedSats!, inscriptionId: p.inscriptionId })))}>
              SWEEP TO SLIP
            </button>
          )}
        </div>
      </div>
      {picks.length > 0 && (
        <ol className="mt-3 grid gap-1">
          {picks.map((p, i) => (
            <li key={p.inscriptionId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 border-t border-border pt-1 font-mono text-[11px]" data-no-translate>
              <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <Link to="/bitmap/$block" params={{ block: String(p.bitmapHeight) }} className="hover:text-signal">{p.bitmapHeight}.BITMAP</Link>
              <span className="text-bitcoin">{formatSats(p.listedSats)}</span>
              <BuyButton offerId={p.listedOfferId!} priceSats={p.listedSats!} inscriptionId={p.inscriptionId} height={p.bitmapHeight} className="btn-term whitespace-nowrap !px-2 !py-1" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Dense pro table view of the current page. */
export function ProTable({ parcels, inhabited, built, bitmons, floorSats }: { parcels: RegistryParcel[]; inhabited?: Set<number>; built?: Set<number>; bitmons?: Map<number, BitmonCheck>; floorSats?: number | null }) {
  return (
    <div className="mt-3 overflow-x-auto border border-border bg-card">
      <table className="w-full min-w-[760px] font-mono text-[11px]" data-no-translate>
        <thead className="bg-card text-left">
          <tr className="[&>th]:label [&>th]:px-3 [&>th]:py-2">
            <th>BITMAP</th><th>OWNER</th><th>FLAGS</th><th className="text-right">ASK</th><th className="text-right">LAST SALE</th><th className="text-right">MOVES</th><th></th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.inscriptionId} className="border-t border-border hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2">
              <td><Link to="/bitmap/$block" params={{ block: String(p.bitmapHeight) }} className="font-bold hover:text-signal">{p.bitmapHeight}.BITMAP</Link></td>
              <td className="text-muted-foreground">{shortenAddress(p.ownerAddress)}</td>
              <td className="space-x-1">
                {inhabited?.has(p.bitmapHeight) && (() => { const c = bitmons?.get(p.bitmapHeight); return <span className="border border-signal/50 px-1 text-signal" title={c && c.status !== "unverified" ? String(c.species) : undefined}>GUARDIAN{c ? c.status === "unverified" ? " · UNVERIFIED" : ` · ${c.rarity}` : ""}</span>; })()}
                {built?.has(p.bitmapHeight) && <span className="border border-signal/50 px-1 text-signal">BUILT</span>}
              </td>
              <td className="text-right text-bitcoin">{p.listedSats ? <span className="inline-flex items-center gap-1">{formatSats(p.listedSats)}{floorSats ? <span className="text-[9px]"><FloorDelta ask={p.listedSats} floor={floorSats} /></span> : null}</span> : "—"}</td>
              <td className="text-right">{p.lastSaleSats ? formatSats(p.lastSaleSats) : "—"}</td>
              <td className="text-right">{p.transfers}</td>
              <td className="w-px">
                {p.listedOfferId && p.listedSats ? (
                  <div className="flex items-center gap-1">
                    <CartToggle item={{ offerId: p.listedOfferId, height: p.bitmapHeight, priceSats: p.listedSats, inscriptionId: p.inscriptionId }} />
                    <BuyButton offerId={p.listedOfferId} priceSats={p.listedSats} inscriptionId={p.inscriptionId} height={p.bitmapHeight} className="btn-term w-full whitespace-nowrap !px-2 !py-1" />
                  </div>
                ) : (
                  <Link to="/bitmap/$block" params={{ block: String(p.bitmapHeight) }} className="btn-term-ghost block w-full !px-2 !py-1 text-center">VIEW</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
