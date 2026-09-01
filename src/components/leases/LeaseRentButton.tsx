import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { quoteLeaseFn, submitLeaseFn } from "@/lib/leases.functions";
import { signPurchasePsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { satsToBtc, type LeaseOffer } from "@/lib/leases";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";

/**
 * Renter side: pick a term, sign the rent payment, the transaction is broadcast
 * and the lease turns active with build + shop rights on that bitmap.
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

  const rentSats = termDays === null ? null : termDays * offer.rateSatsPerDay;

  const rent = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE FIRST");
      if (termDays === null) {
        throw new Error(`TERM MUST BE ${offer.minDays}–${offer.maxDays} DAYS`);
      }
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const quote = await quoteLeaseFn({
        data: {
          offerId: offer.id,
          days: termDays,
          payAddress: wallet.paymentAddress,
          ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        },
      });
      toast("APPROVE THE RENT PAYMENT IN YOUR WALLET", {
        description: `${satsToBtc(quote.totalSats)} BTC TOTAL INCLUDING FEES`,
      });
      const signed = await signPurchasePsbt(
        wallet.provider,
        quote.psbtBase64,
        wallet.paymentAddress,
        quote.signIndices,
      );
      return submitLeaseFn({
        data: {
          offerId: offer.id,
          days: termDays,
          lesseeAddress: wallet.ordinalsAddress,
          psbt: signed,
        },
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["leases"] });
      void queryClient.invalidateQueries({ queryKey: ["lease-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["bitmap-lease", offer.bitmapHeight] });
      toast(`LEASED ${offer.bitmapHeight}.BITMAP`, {
        description: `${satsToBtc(result.rentSats)} BTC RENT PAID · TX ${result.txid.slice(0, 12)}…`,
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
            ? "[ SIGNING… ]"
            : rentSats === null
              ? "[ RENT ]"
              : `[ RENT ${satsToBtc(rentSats)} BTC ]`}
        </button>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; {offer.rateSatsPerDay} SATS / DAY PAID TO THE HOLDER + {MARKETPLACE_FEE_PERCENT}%
        MARKETPLACE FEE{wallet ? "" : " — CONNECT A WALLET TO RENT"}
        <span className="blink">_</span>
      </p>
    </div>
  );
}
