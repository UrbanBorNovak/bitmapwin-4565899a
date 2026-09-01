import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { bitmapLeaseQuery, daysLeft, formatBit } from "@/lib/leases";
import { LeaseOfferForm } from "@/components/leases/LeaseOfferForm";
import { LeaseRentButton } from "@/components/leases/LeaseRentButton";
import { shortenAddress } from "@/lib/registry";

/**
 * Lease block on the bitmap detail page: live lease state, the holder's lease
 * offer form, and the renter's one-click BIT rent action.
 */
export function LeasePanel({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const lease = useQuery(bitmapLeaseQuery(height));
  const active = lease.data?.active ?? null;
  const offer = lease.data?.offer ?? null;

  return (
    <section className="border border-border p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-widest">LEASE</h2>
        <Link to="/leases" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          ALL LEASES →
        </Link>
      </div>

      {active ? (
        <div className="space-y-1 font-mono text-[11px]">
          <p className="text-accent">LEASED · {daysLeft(active.endsAt)} DAY(S) LEFT</p>
          <p className="text-muted-foreground">
            RENTER {shortenAddress(active.lesseeAddress)} · {formatBit(active.totalCoins)} FOR{" "}
            {active.days} DAY(S)
          </p>
        </div>
      ) : offer ? (
        <div className="space-y-2">
          <p className="font-mono text-[11px] text-muted-foreground">
            AVAILABLE · {formatBit(offer.rateCoinsPerDay)} / DAY
            {offer.note ? ` · ${offer.note.toUpperCase()}` : ""}
          </p>
          <LeaseRentButton offer={offer} />
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; NOT OFFERED FOR LEASE YET<span className="blink">_</span>
        </p>
      )}

      {ownerAddress && !active ? (
        <div className="border-t border-border pt-3">
          <LeaseOfferForm height={height} ownerAddress={ownerAddress} offer={offer} />
        </div>
      ) : null}
    </section>
  );
}
