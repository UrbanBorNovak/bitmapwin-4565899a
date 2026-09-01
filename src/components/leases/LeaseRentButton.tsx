import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rentLeaseFn } from "@/lib/leases.functions";
import { useWalletSession } from "@/lib/wallet-session";
import { formatBit, type LeaseOffer } from "@/lib/leases";

/**
 * Renter side: pick a term and pay the rent in BIT. The transfer settles
 * off-chain instantly and the lease grants build + shop rights on that bitmap.
 */
export function LeaseRentButton({ offer }: { offer: LeaseOffer }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(String(offer.minDays));

  const termDays = useMemo(() => {
    const n = Math.round(Number(days));
    if (!Number.isFinite(n)) return null;
    return n >= offer.minDays && n <= offer.maxDays ? n : null;
  }, [days, offer.minDays, offer.maxDays]);

  const rentCoins = termDays === null ? null : termDays * offer.rateCoinsPerDay;

  const rent = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE FIRST");
      if (termDays === null) {
        throw new Error(`TERM MUST BE ${offer.minDays}–${offer.maxDays} DAYS`);
      }
      return rentLeaseFn({
        data: {
          offerId: offer.id,
          days: termDays,
          lesseeAddress: wallet.ordinalsAddress,
        },
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["leases"] });
      void queryClient.invalidateQueries({ queryKey: ["lease-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["bitmap-lease", offer.bitmapHeight] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-ledger"] });
      toast(`LEASED ${offer.bitmapHeight}.BITMAP`, {
        description: `${formatBit(result.rentCoins)} RENT PAID · ${result.days} DAY(S) OF BUILD RIGHTS`,
      });
    },
    onError: (e) => toast("LEASE FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-24 border border-border bg-transparent px-3 py-2 font-mono text-xs"
          inputMode="numeric"
          aria-label="LEASE DAYS"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          DAYS ({offer.minDays}–{offer.maxDays})
        </span>
        <button
          type="button"
          className="btn-term !px-3 !py-1.5"
          disabled={rent.isPending || !wallet}
          onClick={() => rent.mutate()}
        >
          {rent.isPending
            ? "[ PAYING… ]"
            : rentCoins === null
              ? "[ RENT ]"
              : `[ RENT ${formatBit(rentCoins)} ]`}
        </button>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; {formatBit(offer.rateCoinsPerDay)} / DAY PAID FROM YOUR BIT BALANCE TO THE HOLDER
        {wallet ? "" : " — CONNECT A WALLET TO RENT"}
        <span className="blink">_</span>
      </p>
    </div>
  );
}
