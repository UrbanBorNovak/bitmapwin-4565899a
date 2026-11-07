import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { walletQuery } from "@/lib/wallet";
import { submitOfferFn } from "@/lib/offers.functions";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";

/**
 * Seller side of a shop item: signs a real SIGHASH_SINGLE|ANYONECANPAY sale PSBT
 * for the inscription at the shop's asking price and publishes it to the offer
 * book, so the storefront can show a working BUY button to anyone.
 */
export function ShopListButton({
  inscriptionId,
  priceSats,
  alreadyListed,
}: {
  inscriptionId: string;
  priceSats: number;
  alreadyListed: boolean;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });

  const holding = (snapshot.data?.utxos ?? []).find((u) =>
    u.inscriptions.some((i) => i.id === inscriptionId),
  );

  const list = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT THE WALLET HOLDING THIS ASSET");
      if (!holding) throw new Error("THIS INSCRIPTION IS NOT IN THE CONNECTED WALLET");
      if (!Number.isInteger(priceSats) || priceSats < 546) {
        throw new Error("SET A PRICE OF AT LEAST 546 SATS BEFORE LISTING");
      }
      const [txid, voutRaw] = holding.outpoint.split(":");
      const vout = Number(voutRaw);
      if (!txid || !Number.isInteger(vout)) throw new Error("BAD OUTPOINT");
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const psbt = buildListingPsbt({
        txid,
        vout,
        utxoValueSats: holding.valueSats,
        sellerAddress: wallet.ordinalsAddress,
        payoutAddress: wallet.paymentAddress || wallet.ordinalsAddress,
        priceSats,
        ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });
      toast("SIGN THE SALE IN YOUR WALLET", {
        description: `LISTING FOR ${formatSats(priceSats)}`,
      });
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
      return submitOfferFn({ data: { psbt: signed } });
    },
    onSuccess: (offer) => {
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast("ASSET LISTED — BUY BUTTON IS LIVE", {
        description: `ASK ${formatSats(offer.priceSats)}`,
      });
    },
    onError: (e) => toast("LISTING FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  if (alreadyListed) {
    return <span className="label text-primary">PSBT LISTED — BUY BUTTON LIVE</span>;
  }
  if (!wallet) {
    return <span className="label text-muted-foreground">CONNECT WALLET TO LIST PSBT</span>;
  }

  return (
    <button
      type="button"
      className="btn-term-ghost"
      disabled={list.isPending || priceSats < 546 || !holding}
      onClick={() => list.mutate()}
      title={holding ? undefined : "INSCRIPTION NOT FOUND IN THE CONNECTED WALLET"}
    >
      {list.isPending ? "[ SIGNING… ]" : "[ LIST PSBT FOR SALE ]"}
    </button>
  );
}
