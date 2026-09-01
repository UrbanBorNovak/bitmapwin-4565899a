import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { closeLeaseOffer, satsToBtc, upsertLeaseOffer, type LeaseOffer } from "@/lib/leases";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Holder-side lease listing: set a daily rent and a term window. The renter
 * pays that rent on-chain, so this is the holder's earning surface.
 */
export function LeaseOfferForm({
  height,
  ownerAddress,
  offer,
}: {
  height: number;
  ownerAddress: string;
  offer?: LeaseOffer | null;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [rate, setRate] = useState(offer ? String(offer.rateSatsPerDay) : "");
  const [minDays, setMinDays] = useState(offer ? String(offer.minDays) : "1");
  const [maxDays, setMaxDays] = useState(offer ? String(offer.maxDays) : "30");
  const [note, setNote] = useState(offer?.note ?? "");

  const rateSats = useMemo(() => {
    const n = Math.round(Number(rate));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rate]);

  const controls =
    wallet !== null &&
    [wallet.ordinalsAddress, wallet.paymentAddress].some(
      (a) => a.toLowerCase() === ownerAddress.toLowerCase(),
    );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lease-offers"] });
    void queryClient.invalidateQueries({ queryKey: ["bitmap-lease", height] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!controls) throw new Error("CONNECT THE HOLDING WALLET FIRST");
      if (rateSats === null) throw new Error("SET A DAILY RENT ABOVE ZERO");
      const min = Math.max(1, Math.round(Number(minDays) || 1));
      const max = Math.max(min, Math.round(Number(maxDays) || min));
      if (rateSats * min < 546) throw new Error("MINIMUM RENT MUST REACH 546 SATS");
      await upsertLeaseOffer({
        bitmapHeight: height,
        ownerAddress,
        rateSatsPerDay: rateSats,
        minDays: min,
        maxDays: max,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      toast(`${height}.BITMAP OPEN FOR LEASE`, {
        description: `${rateSats} SATS / DAY · RENT PAID DIRECTLY TO YOU`,
      });
    },
    onError: (e) => toast("LEASE OFFER FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const close = useMutation({
    mutationFn: async () => {
      if (!offer) throw new Error("NO OPEN LEASE OFFER");
      await closeLeaseOffer(offer.id);
    },
    onSuccess: () => {
      invalidate();
      toast("LEASE OFFER CLOSED");
    },
    onError: (e) => toast("COULD NOT CLOSE", { description: (e as Error).message.toUpperCase() }),
  });

  if (!controls) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; ONLY THE HOLDER OF {height}.BITMAP CAN OFFER IT FOR LEASE<span className="blink">_</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="label" htmlFor={`rent-${height}`}>
        DAILY RENT IN SATS FOR {height}.BITMAP
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`rent-${height}`}
          className="input w-40 font-mono"
          inputMode="numeric"
          placeholder="5000"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <input
          className="input w-24 font-mono"
          inputMode="numeric"
          aria-label="MINIMUM DAYS"
          placeholder="MIN"
          value={minDays}
          onChange={(e) => setMinDays(e.target.value)}
        />
        <input
          className="input w-24 font-mono"
          inputMode="numeric"
          aria-label="MAXIMUM DAYS"
          placeholder="MAX"
          value={maxDays}
          onChange={(e) => setMaxDays(e.target.value)}
        />
      </div>
      <input
        className="input w-full font-mono"
        aria-label="LEASE NOTE"
        placeholder="WHAT THE LEASE INCLUDES (OPTIONAL)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "[ SAVING… ]" : offer ? "[ UPDATE LEASE OFFER ]" : "[ OFFER FOR LEASE ]"}
        </button>
        {offer ? (
          <button
            type="button"
            className="btn"
            disabled={close.isPending}
            onClick={() => close.mutate()}
          >
            [ CLOSE OFFER ]
          </button>
        ) : null}
        {rateSats !== null ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {satsToBtc(rateSats * 30)} BTC / 30 DAYS
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; THE RENTER GETS BUILD AND SHOP RIGHTS WHILE THE LEASE RUNS — OWNERSHIP NEVER MOVES
        <span className="blink">_</span>
      </p>
    </div>
  );
}
