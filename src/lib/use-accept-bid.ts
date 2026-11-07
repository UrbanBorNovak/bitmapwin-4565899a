import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { acceptBidWithOfferFn } from "@/lib/bids.functions";
import { settleOfferFn } from "@/lib/settle.functions";
import { locateBitmapFn } from "@/lib/locate-bitmap.functions";

import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { walletQuery } from "@/lib/wallet";
import { formatSats } from "@/lib/trades";
import type { Bid } from "@/lib/bids";

/**
 * Accepting a bid means signing the real sale: the connected wallet's parcel
 * UTXO is packed into a SIGHASH_SINGLE|ANYONECANPAY PSBT priced at the bid,
 * signed in the wallet, and published to the offer book addressed to the bidder.
 * From then on the settlement watcher closes the sale automatically the moment
 * the buyer broadcasts.
 */
export function useAcceptBid(options: { holderAddress?: string | null } = {}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });

  const findParcel = useCallback(
    (height: number) => {
      for (const utxo of snapshot.data?.utxos ?? []) {
        for (const insc of utxo.inscriptions) {
          if (insc.bitmapHeight === height) {
            return { outpoint: utxo.outpoint, valueSats: utxo.valueSats };
          }
        }
      }
      return null;
    },
    [snapshot.data],
  );

  const accept = useMutation({
    mutationFn: async (bid: Bid) => {
      if (!wallet) throw new Error("CONNECT THE WALLET HOLDING THIS BITMAP");
      // The registry owner can be stale (the bitmap may have moved since the
      // last index pass), so never reject on it — the chain lookup decides.
      let parcel = findParcel(bid.bitmapHeight);
      if (!parcel) {
        const located = await locateBitmapFn({
          data: { height: bid.bitmapHeight, address: wallet.ordinalsAddress },
        }).catch((error: unknown) => {
          throw new Error(
            `COULD NOT LOCATE ${bid.bitmapHeight}.BITMAP ON CHAIN — ${
              error instanceof Error ? error.message.toUpperCase() : "TRY AGAIN SHORTLY"
            }`,
          );
        });
        const owner = located.ownerAddress?.toLowerCase() ?? "";
        const mine =
          located.heldByAddress ||
          owner === wallet.ordinalsAddress.toLowerCase() ||
          owner === wallet.paymentAddress.toLowerCase();
        if (!mine) {
          throw new Error(
            `${bid.bitmapHeight}.BITMAP IS HELD BY ${
              located.ownerAddress ? located.ownerAddress.slice(0, 10) + "…" : "ANOTHER ADDRESS"
            } — CONNECT THAT WALLET`,
          );
        }
        parcel = { outpoint: located.outpoint, valueSats: located.valueSats };
      }

      const [txid, voutRaw] = parcel.outpoint.split(":");
      const vout = Number(voutRaw);
      if (!txid || !Number.isInteger(vout)) throw new Error("BAD BITMAP OUTPOINT");


      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const psbt = buildListingPsbt({
        txid,
        vout,
        utxoValueSats: parcel.valueSats,
        sellerAddress: wallet.ordinalsAddress,
        payoutAddress: wallet.paymentAddress || wallet.ordinalsAddress,
        priceSats: bid.priceSats,
        ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });

      toast("SIGN THE SALE IN YOUR WALLET", {
        description: `SELLING ${bid.bitmapHeight}.BITMAP FOR ${formatSats(bid.priceSats)}`,
      });
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress).catch(
        () => {
          throw new Error("SALE SIGNATURE REJECTED IN THE WALLET");
        },
      );

      const result = await acceptBidWithOfferFn({
        data: { bidId: bid.id, holderAddress: wallet.ordinalsAddress, psbt: signed },
      });

      // Kick a settlement check straight away so an already-broadcast spend closes now.
      void settleOfferFn({ data: { offerId: result.offerId } }).catch(() => undefined);
      return result;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["bids"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      toast(`BID ACCEPTED — ${result.bitmapHeight}.BITMAP`, {
        description: `SIGNED SALE AT ${formatSats(result.priceSats)} DELIVERED TO THE BIDDER — THE SALE CLOSES AUTOMATICALLY WHEN THEY BROADCAST`,
        duration: 10_000,
      });
    },
    onError: (error) =>
      toast("ACCEPT FAILED", { description: (error as Error).message.toUpperCase() }),
  });

  return { accept, loadingParcels: snapshot.isLoading };
}
