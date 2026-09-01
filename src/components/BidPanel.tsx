import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BID_STATUS_LABEL,
  bidActionMessage,
  bidMessage,
  bidsForHeightQuery,
  isLiveBid,
  type Bid,
} from "@/lib/bids";
import { cancelBidFn, declineBidFn, placeBidFn } from "@/lib/bids.functions";
import { useAcceptBid } from "@/lib/use-accept-bid";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";

const EXPIRY_OPTIONS = [
  { label: "24H", hours: 24 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "NO EXPIRY", hours: 0 },
];

/**
 * Bid book for one parcel: anyone with a connected wallet can bid on any
 * bitmap, the bidder can withdraw, and the on-chain holder can accept.
 */
export function BidPanel({
  height,
  ownerAddress,
  askSats,
}: {
  height: number;
  ownerAddress?: string | null;
  askSats?: number | null;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const { data: bids = [], isLoading } = useQuery(bidsForHeightQuery(height));

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[1]!.hours);

  const live = useMemo(
    () => bids.filter(isLiveBid).sort((a, b) => b.priceSats - a.priceSats),
    [bids],
  );
  const history = useMemo(() => bids.filter((b) => !isLiveBid(b)), [bids]);
  const top = live[0] ?? null;
  const isHolder = walletControls(wallet, ownerAddress ?? null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["bids"] });
    void queryClient.invalidateQueries({ queryKey: ["registry"] });
  };

  const place = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT A WALLET TO BID");
      const priceSats = Number(amount.replace(/[^0-9]/g, ""));
      if (!Number.isInteger(priceSats) || priceSats < 546) {
        throw new Error("BID AT LEAST 546 SATS");
      }
      const bidder = wallet.paymentAddress || wallet.ordinalsAddress;
      let signature: string | undefined;
      try {
        toast("SIGN THE BID IN YOUR WALLET", { description: "PROVES THE BID IS YOURS" });
        signature = await signMessageWithWallet(
          wallet.provider,
          bidder,
          bidMessage(height, priceSats, bidder),
        );
      } catch {
        throw new Error("BID SIGNATURE REJECTED IN THE WALLET");
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
      invalidate();
      setAmount("");
      setNote("");
      toast(`BID PLACED — ${height}.BITMAP`, {
        description: result.replaced
          ? "REPLACED YOUR PREVIOUS BID ON THIS BITMAP"
          : "VISIBLE TO THE HOLDER AND THE WHOLE MARKET",
      });
    },
    onError: (e) => toast("BID FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <section className="mt-8 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <p className="label">BID BOOK — {height}.BITMAP</p>
        <p className="label">
          {top ? `TOP BID ${formatSats(top.priceSats)}` : "NO BIDS YET"}
          {askSats ? ` · ASK ${formatSats(askSats)}` : ""}
        </p>
      </header>

      <div className="border-b border-border p-4">
        {wallet ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="YOUR BID IN SATS (e.g. 25000)"
                className="flex-1 border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
              />
              <button
                className="btn-term"
                disabled={place.isPending || amount.trim() === ""}
                onClick={() => place.mutate()}
              >
                {place.isPending ? "[ SIGNING… ]" : "[ PLACE BID ]"}
              </button>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="OPTIONAL NOTE TO THE HOLDER"
              className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="label">EXPIRES</span>
              {EXPIRY_OPTIONS.map((o) => (
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
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              &gt; BIDDING AS {shortenAddress(wallet.paymentAddress || wallet.ordinalsAddress)} —
              THE BID IS SIGNED OFF CHAIN AND SETTLES WITH A REAL SALE PSBT WHEN ACCEPTED
            </p>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            &gt; CONNECT UNISAT OR XVERSE ON /WALLET TO BID ON THIS BITMAP
            <span className="blink">_</span>
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="p-4 font-mono text-[11px] text-muted-foreground">
          &gt; READING THE BID BOOK<span className="blink">_</span>
        </p>
      ) : live.length === 0 ? (
        <p className="p-4 font-mono text-[11px] text-muted-foreground">
          &gt; NO OPEN BIDS ON THIS BITMAP YET<span className="blink">_</span>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {live.map((bid, index) => (
            <BidRow
              key={bid.id}
              bid={bid}
              rank={index + 1}
              canCancel={walletControls(wallet, bid.bidderAddress)}
              canAccept={isHolder}
              holderAddress={ownerAddress ?? null}
              onDone={invalidate}
            />
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div className="border-t border-border p-4">
          <p className="label">CLOSED BIDS</p>
          <ul className="mt-2 space-y-1">
            {history.slice(0, 8).map((bid) => (
              <li
                key={bid.id}
                className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px] text-muted-foreground"
              >
                <span>
                  {formatSats(bid.priceSats)} · {shortenAddress(bid.bidderAddress)}
                </span>
                <span>{BID_STATUS_LABEL[bid.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BidRow({
  bid,
  rank,
  canCancel,
  canAccept,
  holderAddress,
  onDone,
}: {
  bid: Bid;
  rank: number;
  canCancel: boolean;
  canAccept: boolean;
  holderAddress: string | null;
  onDone: () => void;
}) {
  const wallet = useWalletSession();

  const cancel = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT THE BIDDING WALLET");
      const address = [wallet.paymentAddress, wallet.ordinalsAddress].find(
        (a) => a.toLowerCase() === bid.bidderAddress.toLowerCase(),
      );
      if (!address) throw new Error("CONNECT THE BIDDING WALLET");
      await signMessageWithWallet(
        wallet.provider,
        address,
        bidActionMessage("cancel", bid.id, address),
      ).catch(() => {
        throw new Error("WITHDRAW SIGNATURE REJECTED");
      });
      return cancelBidFn({ data: { bidId: bid.id, address } });
    },
    onSuccess: () => {
      onDone();
      toast("BID WITHDRAWN", { description: `${bid.bitmapHeight}.BITMAP` });
    },
    onError: (e) => toast("WITHDRAW FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const decline = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT THE WALLET HOLDING THIS BITMAP");
      const holder = holderAddress ?? wallet.ordinalsAddress;
      await signMessageWithWallet(
        wallet.provider,
        wallet.ordinalsAddress,
        bidActionMessage("decline", bid.id, wallet.ordinalsAddress),
      ).catch(() => {
        throw new Error("DECLINE SIGNATURE REJECTED");
      });
      return declineBidFn({ data: { bidId: bid.id, holderAddress: holder } });
    },
    onSuccess: () => {
      onDone();
      toast("BID DECLINED", { description: `${bid.bitmapHeight}.BITMAP` });
    },
    onError: (e) => toast("DECLINE FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const { accept } = useAcceptBid({ holderAddress });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="display text-sm">
          #{String(rank).padStart(2, "0")} {formatSats(bid.priceSats)}
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {shortenAddress(bid.bidderAddress)} · {timeAgo(bid.createdAt)}
          {bid.expiresAt
            ? ` · EXPIRES ${new Date(bid.expiresAt).toISOString().slice(0, 10)}`
            : " · NO EXPIRY"}
        </p>
        {bid.note && <p className="mt-1 font-mono text-[11px] text-foreground">&gt; {bid.note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <button
            className="btn-term !px-3 !py-1.5"
            disabled={accept.isPending}
            onClick={() => accept.mutate(bid)}
          >
            {accept.isPending ? "[ SIGNING SALE… ]" : "[ ACCEPT BID ]"}
          </button>
        )}
        {canAccept && (
          <button
            className="btn-term-ghost !px-3 !py-1.5"
            disabled={decline.isPending}
            onClick={() => decline.mutate()}
          >
            {decline.isPending ? "[ DECLINING… ]" : "[ DECLINE ]"}
          </button>
        )}
        {canCancel && (
          <button
            className="btn-term-ghost !px-3 !py-1.5"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? "[ WITHDRAWING… ]" : "[ WITHDRAW ]"}
          </button>
        )}
      </div>
    </li>
  );
}
