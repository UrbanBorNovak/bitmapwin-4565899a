import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mascotReact } from "@/lib/mascot";
import { useEffect, useRef, useState } from "react";
import { buildPurchaseFn, releasePurchaseReservationFn, submitPurchaseFn } from "@/lib/purchase.functions";
import {
  WALLET_LABEL,
  WALLET_PROVIDER_STORAGE_KEY,
  connectWallet,
  isWalletInstalled,
  signPurchasePsbt,
  keyCandidates,
  xOnlyPubKeyHex,
  type ConnectedWallet,
  type WalletProviderId,
} from "@/lib/browser-wallet";
import { ensureWalletKeys, saveWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";
import { trackPurchase } from "@/components/TransferTracker";

const PROVIDERS: WalletProviderId[] = ["unisat", "xverse"];

/** Uses the last connected provider, otherwise the first installed one. */
export async function resolveWallet(): Promise<ConnectedWallet> {
  const stored = window.localStorage.getItem(WALLET_PROVIDER_STORAGE_KEY) as WalletProviderId | null;
  const order = stored ? [stored, ...PROVIDERS.filter((p) => p !== stored)] : PROVIDERS;
  const provider = order.find((p) => isWalletInstalled(p));
  if (!provider) throw new Error("NO BITCOIN WALLET DETECTED — INSTALL UNISAT OR XVERSE");
  const wallet = await connectWallet(provider);
  window.localStorage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
  // Some wallet builds omit the payment public key on connect, which nested
  // segwit (3…) funding inputs need. Fill it in before building any PSBT.
  const complete = await ensureWalletKeys(wallet);
  saveWalletSession(complete);
  return complete;
}

/**
 * Buys a listed parcel: the server builds the buyer half of the sale PSBT from
 * the buyer's live UTXO set, the wallet signs its own funding inputs, and the
 * completed transaction is submitted and broadcast.
 */
export function BuyButton({
  offerId,
  priceSats,
  className = "btn-term !px-3 !py-1.5",
  inscriptionId,
  height,
}: {
  offerId: string;
  priceSats: number;
  inscriptionId?: string;
  height?: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const holdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lockUntil === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lockUntil]);
  const secondsLeft = lockUntil ? Math.max(0, Math.ceil((lockUntil - now) / 1000)) : 0;

  const buy = useMutation({
    mutationFn: async () => {
      const wallet = await resolveWallet();
      const tapKey = xOnlyPubKeyHex(wallet.publicKey);
      const quote = await buildPurchaseFn({
        data: {
          offerId,
          buyerPaymentAddress: wallet.paymentAddress,
          buyerOrdinalsAddress: wallet.ordinalsAddress,
          ...(tapKey ? { tapInternalKeyHex: tapKey } : {}),
          ...(keyCandidates(wallet).length > 0
            ? { paymentPublicKeyHex: keyCandidates(wallet) }
            : {}),
        },
      });
      holdRef.current = wallet.ordinalsAddress;
      if (quote.reservedUntil) {
        setNow(Date.now());
        setLockUntil(new Date(quote.reservedUntil).getTime());
      }
      toast(`SIGN PURCHASE IN ${WALLET_LABEL[wallet.provider]}`, {
        description: `${formatSats(quote.priceSats)} + ${quote.marketFeeSats} SATS MARKET FEE (${MARKETPLACE_FEE_PERCENT}%) + ${quote.feeSats} SATS MINER FEE @ ${quote.feeRate} SAT/VB`,
      });
      const signed = await signPurchasePsbt(
        wallet.provider,
        quote.psbtBase64,
        wallet.paymentAddress,
        quote.signIndices,
      );
      return submitPurchaseFn({
        data: { offerId, psbt: signed, buyerAddress: wallet.ordinalsAddress },
      });
    },
    onSettled: () => setLockUntil(null),
    onSuccess: (result) => {
      const buyer = holdRef.current;
      holdRef.current = null;
      if (result.txid && buyer) trackPurchase({ txid: result.txid, buyerAddress: buyer, ...(inscriptionId ? { inscriptionId } : {}), ...(height !== undefined ? { height } : {}) });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      void queryClient.invalidateQueries({ queryKey: ["bids"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast(result.broadcast ? "PURCHASE BROADCAST — SALE CLOSED" : "PURCHASE PENDING", {
        description: result.txid
          ? `${result.route === "private_direct" ? "PRIVATE RELAY" : "PUBLIC FALLBACK"} · TXID ${result.txid}`
          : result.message.toUpperCase(),
      });
      mascotReact(result.broadcast ? "SALE CLOSED ON CHAIN" : "WAITING ON THE MEMPOOL", "cheer");

    },

    onError: (e) => {
      const buyer = holdRef.current;
      holdRef.current = null;
      if (buyer) void releasePurchaseReservationFn({ data: { offerId, buyerAddress: buyer } }).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast("BUY FAILED", { description: (e as Error).message.toUpperCase() });
    },
  });

  return (
    <>
    <button className={className} disabled={buy.isPending} onClick={() => buy.mutate()}>
      {buy.isPending
        ? lockUntil
          ? `[ LOCKED ${secondsLeft}s · SIGN WALLET ]`
          : "[ RESERVING… ]"
        : `[ BUY ${formatSats(priceSats)} ]`}
    </button>
    </>
  );
}
