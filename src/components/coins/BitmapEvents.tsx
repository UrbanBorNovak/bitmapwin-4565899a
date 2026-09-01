import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { COIN, bitmapEventsQuery, coinBalanceQuery, formatBit } from "@/lib/coins";
import { bitmapLeaseQuery, daysLeft } from "@/lib/leases";
import { CoinEventCard } from "@/components/coins/CoinEventCard";
import { CoinEventForm } from "@/components/coins/CoinEventForm";
import { useWalletSession, walletControls } from "@/lib/wallet-session";

/**
 * Raffle builder + live raffles for one bitmap. Holders (and the active lessee)
 * can open a raffle whose prize is paid in BIT, locked up front.
 */
export function BitmapEvents({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const wallet = useWalletSession();
  const events = useQuery(bitmapEventsQuery(height));
  const lease = useQuery(bitmapLeaseQuery(height));
  const [open, setOpen] = useState(false);

  const activeLease = lease.data?.active ?? null;
  const leaseLive = activeLease !== null && daysLeft(activeLease.endsAt) > 0;
  const isHolder = walletControls(wallet, ownerAddress);
  const isLessee = leaseLive ? walletControls(wallet, activeLease.lesseeAddress) : false;
  const canHost = isHolder || isLessee;

  const balances = useQuery(
    coinBalanceQuery(wallet ? [wallet.ordinalsAddress, wallet.paymentAddress] : []),
  );
  const balance = (balances.data ?? []).reduce((sum, b) => sum + b.balance, 0);

  const live = (events.data ?? []).filter((e) => e.status === "open");
  const settled = (events.data ?? []).filter((e) => e.status !== "open");

  return (
    <section className="border border-border p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-widest">RAFFLES & EVENTS</h2>
        <Link to="/coins" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          {COIN} ECONOMY →
        </Link>
      </div>

      {live.length === 0 && settled.length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; NOTHING RUNNING ON {height}.BITMAP YET<span className="blink">_</span>
        </p>
      ) : (
        <div className="space-y-3">
          {[...live, ...settled].map((event) => (
            <CoinEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {canHost ? (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">RAFFLE BUILDER</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {isHolder ? "YOU HOLD" : "YOU LEASE"} {height}.BITMAP · BALANCE{" "}
                {formatBit(balance)}
              </p>
            </div>
            <button type="button" className="btn-term !px-3 !py-1.5" onClick={() => setOpen(!open)}>
              {open ? "[ CLOSE BUILDER ]" : "[ BUILD A RAFFLE ]"}
            </button>
          </div>

          {open ? <CoinEventForm defaultHeight={height} lockHeight defaultKind="raffle" /> : null}
        </div>
      ) : (
        <p className="border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          &gt; ONLY THE HOLDER OR ACTIVE RENTER OF {height}.BITMAP CAN RUN RAFFLES HERE
          <span className="blink">_</span>
        </p>
      )}
    </section>
  );
}
