import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BID_STATUS_LABEL,
  bidActionMessage,
  isLiveBid,
  myBidsQuery,
  openBidsQuery,
  type Bid,
} from "@/lib/bids";
import { cancelBidFn, declineBidFn } from "@/lib/bids.functions";
import { useAcceptBid } from "@/lib/use-accept-bid";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";

/**
 * Two bid inboxes for the connected wallet: bids it has placed, and live bids
 * standing on parcels it holds.
 */
export function WalletBids({ address, heldHeights }: { address: string; heldHeights: number[] }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();

  const addresses = useMemo(() => {
    const set = new Set<string>([address]);
    if (wallet) {
      set.add(wallet.ordinalsAddress);
      set.add(wallet.paymentAddress);
    }
    return [...set].filter(Boolean);
  }, [address, wallet]);

  const mine = useQuery(myBidsQuery(addresses));
  const open = useQuery(openBidsQuery(500));

  const heldSet = useMemo(() => new Set(heldHeights), [heldHeights]);
  const received = useMemo(
    () => (open.data ?? []).filter((bid) => heldSet.has(bid.bitmapHeight)),
    [open.data, heldSet],
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["bids"] });

  const cancel = useMutation({
    mutationFn: async (bid: Bid) => {
      if (!wallet) throw new Error("CONNECT THE BIDDING WALLET");
      const signer = [wallet.paymentAddress, wallet.ordinalsAddress].find(
        (a) => a.toLowerCase() === bid.bidderAddress.toLowerCase(),
      );
      if (!signer) throw new Error("CONNECT THE BIDDING WALLET");
      await signMessageWithWallet(
        wallet.provider,
        signer,
        bidActionMessage("cancel", bid.id, signer),
      ).catch(() => {
        throw new Error("WITHDRAW SIGNATURE REJECTED");
      });
      return cancelBidFn({ data: { bidId: bid.id, address: signer } });
    },
    onSuccess: () => {
      invalidate();
      toast("BID WITHDRAWN");
    },
    onError: (e) => toast("WITHDRAW FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const decline = useMutation({
    mutationFn: async (bid: Bid) => {
      if (!wallet) throw new Error("CONNECT THE WALLET HOLDING THIS BITMAP");
      await signMessageWithWallet(
        wallet.provider,
        wallet.ordinalsAddress,
        bidActionMessage("decline", bid.id, wallet.ordinalsAddress),
      ).catch(() => {
        throw new Error("DECLINE SIGNATURE REJECTED");
      });
      return declineBidFn({ data: { bidId: bid.id, holderAddress: address } });
    },
    onSuccess: () => {
      invalidate();
      toast("BID DECLINED");
    },
    onError: (e) => toast("DECLINE FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const { accept } = useAcceptBid({ holderAddress: address });

  return (
    <>
      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">BIDS RECEIVED</h2>
          <p className="label mt-2">LIVE BIDS ON BITMAPS THIS ADDRESS HOLDS</p>
        </header>
        <BidList
          bids={received}
          loading={open.isLoading}
          empty="NO OPEN BIDS ON YOUR BITMAPS YET"
          action={(bid) => (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-term !px-3 !py-1.5"
                disabled={accept.isPending}
                onClick={() => accept.mutate(bid)}
              >
                {accept.isPending ? "[ SIGNING SALE… ]" : "[ ACCEPT ]"}
              </button>
              <button
                className="btn-term-ghost !px-3 !py-1.5"
                disabled={decline.isPending}
                onClick={() => decline.mutate(bid)}
              >
                {decline.isPending ? "[ DECLINING… ]" : "[ DECLINE ]"}
              </button>
            </div>
          )}
        />
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">MY BIDS</h2>
          <p className="label mt-2">BIDS SIGNED FROM THIS WALLET</p>
        </header>
        <BidList
          bids={mine.data ?? []}
          loading={mine.isLoading}
          empty="NO BIDS PLACED FROM THIS WALLET YET"
          action={(bid) =>
            isLiveBid(bid) ? (
              <button
                className="btn-term-ghost !px-3 !py-1.5"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(bid)}
              >
                {cancel.isPending ? "[ WITHDRAWING… ]" : "[ WITHDRAW ]"}
              </button>
            ) : bid.status === "accepted" && bid.acceptedOfferId ? (
              <div className="flex flex-col items-end gap-1">
                <BuyButton offerId={bid.acceptedOfferId} priceSats={bid.priceSats} />
                <span className="label">HOLDER ACCEPTED — SIGN TO SETTLE</span>
              </div>
            ) : null
          }

        />
      </section>
    </>
  );
}

function BidList({
  bids,
  loading,
  empty,
  action,
}: {
  bids: Bid[];
  loading: boolean;
  empty: string;
  action: (bid: Bid) => React.ReactNode;
}) {
  if (loading) {
    return (
      <p className="p-5 font-mono text-[11px] text-muted-foreground">
        &gt; READING THE BID BOOK<span className="blink">_</span>
      </p>
    );
  }
  if (bids.length === 0) {
    return (
      <p className="p-5 font-mono text-[11px] text-muted-foreground">
        &gt; {empty}
        <span className="blink">_</span>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {bids.map((bid) => (
        <li key={bid.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <Link
              to="/bitmap/$block"
              params={{ block: String(bid.bitmapHeight) }}
              className="display text-sm underline-offset-4 hover:underline"
            >
              {bid.bitmapHeight}.BITMAP
            </Link>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {formatSats(bid.priceSats)} · {shortenAddress(bid.bidderAddress)} ·{" "}
              {timeAgo(bid.createdAt)} · {BID_STATUS_LABEL[bid.status]}
            </p>
            {bid.note && (
              <p className="mt-1 font-mono text-[11px] text-foreground">&gt; {bid.note}</p>
            )}
          </div>
          {action(bid)}
        </li>
      ))}
    </ul>
  );
}
