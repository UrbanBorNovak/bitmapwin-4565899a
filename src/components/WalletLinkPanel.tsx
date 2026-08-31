import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { signMessageWithWallet, type ConnectedWallet } from "@/lib/browser-wallet";
import { confirmWalletLinkFn, startWalletLinkFn, unlinkWalletFn } from "@/lib/wallet-link.functions";
import { isLinked, myWalletLinksQuery } from "@/lib/wallet-links";
import { accountLabel, signOut, useAuthSession } from "@/lib/auth";
import { shortenAddress } from "@/lib/registry";

/**
 * Account panel: shows the signed-in account and the addresses it has proven
 * control of. Linking asks the wallet to sign a one-time challenge, which the
 * server verifies (BIP-322 / BIP-137) before writing the link.
 */
export function WalletLinkPanel({
  wallet,
  address,
}: {
  wallet: ConnectedWallet | null;
  address: string;
}) {
  const { session, user, loading } = useAuthSession();
  const signedIn = Boolean(session);
  const links = useQuery(myWalletLinksQuery(signedIn));
  const queryClient = useQueryClient();

  const linkTarget = wallet?.ordinalsAddress ?? "";
  const linked = isLinked(links.data, linkTarget || address);

  const linkWallet = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT A WALLET FIRST");
      const challenge = await startWalletLinkFn({ data: { address: wallet.ordinalsAddress } });
      const signature = await signMessageWithWallet(
        wallet.provider,
        wallet.ordinalsAddress,
        challenge.message,
      );
      return confirmWalletLinkFn({
        data: {
          nonce: challenge.nonce,
          signature,
          publicKey: wallet.publicKey,
          purpose: "ordinals",
        },
      });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-links"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-profile"] });
      toast("WALLET LINKED", {
        description: res.claimedProfile
          ? "EXISTING PROFILE CLAIMED BY YOUR ACCOUNT"
          : shortenAddress(res.address),
      });
    },
    onError: (e) => toast("LINK FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const unlink = useMutation({
    mutationFn: (addr: string) => unlinkWalletFn({ data: { address: addr } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-links"] });
      toast("WALLET UNLINKED");
    },
    onError: (e) => toast("UNLINK FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <section className="mt-8 border border-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="label">ACCOUNT</p>
        {signedIn ? (
          <button className="btn-term-ghost" type="button" onClick={() => void signOut()}>
            [ SIGN OUT ]
          </button>
        ) : (
          <Link to="/auth" className="btn-term">
            [ SIGN IN ]
          </Link>
        )}
      </header>

      {loading ? (
        <p className="p-4 font-mono text-xs text-muted-foreground">&gt; CHECKING SESSION…</p>
      ) : !signedIn ? (
        <p className="p-4 font-mono text-xs text-muted-foreground">
          &gt; SIGN IN TO TIE THIS ADDRESS TO A PERSISTENT PROFILE — WITHOUT AN ACCOUNT YOUR
          PROFILE AND PARCEL PAGES CANNOT BE SAVED<span className="blink">_</span>
        </p>
      ) : (
        <div className="divide-y divide-border">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
            <div>
              <p className="label">SIGNED IN AS</p>
              <p className="mt-1 font-mono text-xs text-foreground">
                {user?.email ?? accountLabel(user)}
              </p>
            </div>
            {linkTarget !== "" && !linked && (
              <button
                type="button"
                className="btn-term disabled:opacity-30"
                disabled={linkWallet.isPending}
                onClick={() => linkWallet.mutate()}
              >
                {linkWallet.isPending ? "[ WAITING FOR SIGNATURE… ]" : "[ LINK THIS WALLET ]"}
              </button>
            )}
          </div>

          <div className="px-4 py-3">
            <p className="label">VERIFIED ADDRESSES</p>
            {links.isLoading ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">&gt; LOADING…</p>
            ) : (links.data?.length ?? 0) === 0 ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                &gt; NONE YET — CONNECT A WALLET ABOVE AND SIGN THE CHALLENGE
                <span className="blink">_</span>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border border border-border">
                {links.data!.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-mono text-xs break-all text-foreground" title={l.address}>
                      {shortenAddress(l.address)}
                    </span>
                    <button
                      type="button"
                      className="btn-term-ghost"
                      disabled={unlink.isPending}
                      onClick={() => unlink.mutate(l.address)}
                    >
                      [ UNLINK ]
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
