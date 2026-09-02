import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { cancelOfferFn } from "@/lib/offers.functions";
import { unlistMessage } from "@/lib/offers";

/**
 * Pulls an open listing off the market. The seller signs the unlist message
 * with the wallet that signed the sale PSBT, which proves ownership server-side.
 */
export function UnlistButton({
  offerId,
  sellerAddress,
  className = "btn-term-ghost !px-3 !py-1.5",
  label = "[ UNLIST ]",
}: {
  offerId: string;
  sellerAddress: string | null;
  className?: string;
  label?: string;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();

  const signingAddress =
    wallet && sellerAddress
      ? [wallet.ordinalsAddress, wallet.paymentAddress].find(
          (a) => a?.toLowerCase() === sellerAddress.toLowerCase(),
        ) ?? null
      : null;

  const unlist = useMutation({
    mutationFn: async () => {
      if (!wallet || !signingAddress) {
        throw new Error("CONNECT THE WALLET THAT SIGNED THIS LISTING");
      }
      toast("APPROVE THE SIGNATURE IN YOUR WALLET", { description: "THIS MOVES NO FUNDS" });
      const signature = await signMessageWithWallet(
        wallet.provider,
        signingAddress,
        unlistMessage(offerId),
      );
      return cancelOfferFn({ data: { offerId, signature } });
    },
    onSuccess: () => {
      for (const key of ["offers", "wallet-offers", "registry", "activity"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast("UNLISTED", { description: "THE LISTING IS OFF THE MARKETPLACE" });
    },
    onError: (e) => toast("UNLIST FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  if (!wallet) {
    return <span className="label text-muted-foreground">CONNECT WALLET TO UNLIST</span>;
  }

  return (
    <button
      type="button"
      className={className}
      disabled={unlist.isPending || signingAddress === null}
      title={signingAddress === null ? "CONNECT THE SELLER WALLET FOR THIS LISTING" : undefined}
      onClick={() => unlist.mutate()}
    >
      {unlist.isPending ? "[ SIGNING… ]" : label}
    </button>
  );
}
