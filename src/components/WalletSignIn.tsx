import { useState } from "react";
import { toast } from "sonner";
import { isWalletInstalled, WALLET_LABEL, WALLET_SITE } from "@/lib/browser-wallet";
import { signInWithBitcoinWallet } from "@/lib/wallet-auth";

/**
 * Sign in with a Bitcoin wallet: the address signs a challenge and gets a real
 * persistent account — no email required.
 */
export function WalletSignIn({ onSignedIn }: { onSignedIn?: (address: string) => void }) {
  const [busy, setBusy] = useState<null | "unisat" | "xverse">(null);

  const run = async (provider: "unisat" | "xverse") => {
    if (!isWalletInstalled(provider)) {
      window.open(WALLET_SITE[provider], "_blank", "noopener");
      return;
    }
    setBusy(provider);
    try {
      const wallet = await signInWithBitcoinWallet(provider);
      toast("SIGNED IN WITH WALLET", { description: wallet.ordinalsAddress });
      onSignedIn?.(wallet.ordinalsAddress);
    } catch (e) {
      toast("WALLET SIGN-IN FAILED", { description: (e as Error).message.toUpperCase() });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(["unisat", "xverse"] as const).map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy !== null}
          onClick={() => void run(p)}
          className="btn-term w-full disabled:opacity-30"
        >
          {busy === p ? "[ WAITING FOR SIGNATURE… ]" : `[ SIGN IN WITH ${WALLET_LABEL[p]} ]`}
        </button>
      ))}
    </div>
  );
}
