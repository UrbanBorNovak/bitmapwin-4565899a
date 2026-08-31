import { supabase } from "@/integrations/supabase/client";
import {
  connectWallet,
  signMessageWithWallet,
  WALLET_PROVIDER_STORAGE_KEY,
  type ConnectedWallet,
  type WalletProviderId,
} from "@/lib/browser-wallet";
import { confirmWalletAuthFn, startWalletAuthFn } from "@/lib/wallet-auth.functions";

/**
 * Sign in with UniSat or Xverse: connect, sign a server-issued challenge, then
 * exchange the verified proof for a real account session.
 */
export async function signInWithBitcoinWallet(
  provider: WalletProviderId,
): Promise<ConnectedWallet> {
  const wallet = await connectWallet(provider);
  const challenge = await startWalletAuthFn({ data: { address: wallet.ordinalsAddress } });
  const signature = await signMessageWithWallet(
    wallet.provider,
    wallet.ordinalsAddress,
    challenge.message,
  );
  const res = await confirmWalletAuthFn({
    data: {
      nonce: challenge.nonce,
      signature,
      ...(wallet.publicKey ? { publicKey: wallet.publicKey } : {}),
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: res.tokenHash,
  });
  if (error) throw new Error(error.message.toUpperCase());

  window.localStorage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
  return wallet;
}
