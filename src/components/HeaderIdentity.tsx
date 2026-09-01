import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWalletSession } from "@/lib/wallet-session";
import { profileQuery } from "@/lib/profiles";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { shortenAddress } from "@/lib/registry";
import { accountLabel, useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery } from "@/lib/wallet-links";

/**
 * Header identity chip: the signed-in account with its linked wallet's
 * inscription avatar and display name, linking to /wallet. Signed-out visitors
 * get a sign-in call to action.
 */
export function HeaderIdentity() {
  const wallet = useWalletSession();
  const { session, user, loading } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = wallet?.ordinalsAddress ?? links.data?.[0]?.address ?? "";
  const profile = useQuery(profileQuery(address));

  if (!session) {
    return (
      <Link to="/auth" className="btn-term">
        {loading ? "…" : "SIGN IN"}
      </Link>
    );
  }

  const name =
    profile.data?.displayName?.trim() ||
    (address ? shortenAddress(address) : accountLabel(user));
  const avatar = profile.data?.avatarInscriptionId;

  return (
    <Link
      to="/dashboard"
      aria-label={`Open dashboard for ${name}`}
      title="DASHBOARD"
      className="flex items-center gap-2 border border-border py-1 pl-1 pr-2 transition-colors hover:border-primary"
    >
      <InscriptionAvatar
        inscriptionId={avatar}
        label={name}
        className="size-7 shrink-0 border border-border [image-rendering:pixelated]"
        fallbackClassName="text-[11px]"
      />
      <span className="max-w-[10rem] truncate font-mono text-[11px] uppercase text-foreground">
        {name}
      </span>
    </Link>
  );
}
