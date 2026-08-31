import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bidMessage } from "@/lib/bids";
import { placeBidFn } from "@/lib/bids.functions";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";

const EXPIRY = [
  { label: "24H", hours: 24 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "NO EXPIRY", hours: 0 },
];

/**
 * One-click offer on any parcel: name a price, sign it with the connected
 * wallet, and the holder is notified with an accept action.
 */
export function MakeOfferButton({
  height,
  askSats = null,
  topBidSats = null,
  className = "btn-term-ghost !px-2 !py-2",
  label = "MAKE OFFER",
}: {
  height: number;
  askSats?: number | null;
  topBidSats?: number | null;
  className?: string;
  label?: string;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"sats" | "btc">("sats");
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState(EXPIRY[1]!.hours);

  const priceSats = useMemo(() => {
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) return null;
    const sats = unit === "btc" ? Math.round(n * 100_000_000) : Math.round(n);
    return sats >= 546 ? sats : null;
  }, [amount, unit]);

  const place = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE ON /WALLET FIRST");
      if (priceSats === null) throw new Error("OFFER AT LEAST 546 SATS");
      const bidder = wallet.paymentAddress || wallet.ordinalsAddress;
      let signature: string | undefined;
      try {
        toast("SIGN THE OFFER IN YOUR WALLET", { description: "PROVES THE OFFER IS YOURS" });
        signature = await signMessageWithWallet(
          wallet.provider,
          bidder,
          bidMessage(height, priceSats, bidder),
        );
      } catch {
        throw new Error("OFFER SIGNATURE REJECTED IN THE WALLET");
      }
      return placeBidFn({
        data: {
          bitmapHeight: height,
          bidderAddress: bidder,
          priceSats,
          ...(expiry > 0 ? { expiresInHours: expiry } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(signature ? { signature } : {}),
        },
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["bids"] });
      setAmount("");
      setNote("");
      setOpen(false);
      toast(`OFFER SENT — ${height}.BITMAP`, {
        description: result.replaced
          ? "REPLACED YOUR PREVIOUS OFFER ON THIS PARCEL"
          : "THE HOLDER IS NOTIFIED AND CAN ACCEPT IT",
      });
    },
    onError: (e) => toast("OFFER FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-lg">MAKE AN OFFER — {height}.BITMAP</DialogTitle>
            <DialogDescription className="label">
              {askSats ? `ASK ${formatSats(askSats)}` : "NO OPEN ASK"}
              {topBidSats ? ` · TOP OFFER ${formatSats(topBidSats)}` : " · NO OFFERS YET"}
            </DialogDescription>
          </DialogHeader>

          {wallet ? (
            <div>
              <label className="label" htmlFor={`offer-${height}`}>
                HOW MUCH DO YOU PAY?
              </label>
              <div className="mt-2 flex border border-border focus-within:border-foreground">
                <input
                  id={`offer-${height}`}
                  autoFocus
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(unit === "btc" ? /[^0-9.]/g : /[^0-9]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder={unit === "btc" ? "e.g. 0.0025" : "e.g. 250000"}
                  className="flex-1 bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  className="border-l border-border px-3 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setUnit((u) => (u === "btc" ? "sats" : "btc"));
                    setAmount("");
                  }}
                >
                  {unit === "btc" ? "BTC" : "SATS"}
                </button>
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                placeholder="OPTIONAL NOTE TO THE HOLDER"
                className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="label">EXPIRES</span>
                {EXPIRY.map((o) => (
                  <button
                    key={o.label}
                    className={
                      expiry === o.hours ? "btn-term !px-2 !py-1" : "btn-term-ghost !px-2 !py-1"
                    }
                    onClick={() => setExpiry(o.hours)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                &gt; OFFERING AS {shortenAddress(wallet.paymentAddress || wallet.ordinalsAddress)}
                {priceSats !== null ? ` · ${formatSats(priceSats)}` : ""} — SIGNED OFF CHAIN, SETTLES
                WITH A REAL SALE PSBT WHEN THE HOLDER ACCEPTS
              </p>

              <button
                className="btn-term mt-4 w-full"
                disabled={place.isPending || priceSats === null}
                onClick={() => place.mutate()}
              >
                {place.isPending ? "[ SIGNING… ]" : "[ SEND OFFER TO HOLDER ]"}
              </button>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              &gt; CONNECT UNISAT OR XVERSE ON /WALLET TO OFFER ON THIS PARCEL
              <span className="blink">_</span>
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
