import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWalletSession } from "@/lib/wallet-session";
import { inscriptionImageUrl, profileQuery } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";

/**
 * Header identity chip: the connected wallet's inscription avatar and display
 * name (falling back to a shortened address), linking to /wallet.
 */
export function HeaderIdentity() {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? "";
  const profile = useQuery(profileQuery(address));

  if (!wallet) {
    return (
      <Link to="/wallet" className="btn-term">
        CONNECT
      </Link>
    );
  }

  const name = profile.data?.displayName?.trim() || shortenAddress(address);
  const avatar = profile.data?.avatarInscriptionId;

  return (
    <Link
      to="/wallet"
      aria-label={`Open wallet for ${name}`}
      className="flex items-center gap-2 border border-border py-1 pl-1 pr-2 transition-colors hover:border-foreground"
    >
      {avatar ? (
        <img
          src={inscriptionImageUrl(avatar)}
          alt=""
          className="size-7 shrink-0 border border-border object-cover [image-rendering:pixelated]"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center border border-border font-mono text-[11px] text-muted-foreground">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[10rem] truncate font-mono text-[11px] uppercase text-foreground">
        {name}
      </span>
    </Link>
  );
}
