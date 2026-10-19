import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Copy, LogOut, Unplug, Wallet } from "lucide-react";
import { toast } from "sonner";
import { clearWalletSession, useWalletSession } from "@/lib/wallet-session";
import { profileQuery } from "@/lib/profiles";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { shortenAddress } from "@/lib/registry";
import { accountLabel, signOut, useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery, verifiedWalletAddress } from "@/lib/wallet-links";
import { WALLET_LABEL, WALLET_PROVIDER_STORAGE_KEY } from "@/lib/browser-wallet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Header identity chip with a dropdown: wallet status, My Bitmaps (/wallet),
 * quick links, and one-click wallet disconnect / account sign-out.
 */
export function HeaderIdentity() {
  const wallet = useWalletSession();
  const navigate = useNavigate();
  const { session, user, loading } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = verifiedWalletAddress(links.data, wallet?.ordinalsAddress);
  const profile = useQuery(profileQuery(address));

  if (!session && !wallet) {
    return (
      <Link to="/auth" className="btn-term min-h-11 whitespace-nowrap !px-2 !py-2 sm:!px-3 md:min-h-0 md:!px-5 md:!py-3">
        {loading ? "…" : "SIGN IN"}
      </Link>
    );
  }

  const name =
    profile.data?.displayName?.trim() ||
    (address ? shortenAddress(address) : wallet ? shortenAddress(wallet.ordinalsAddress) : accountLabel(user));
  const avatar = profile.data?.avatarInscriptionId;

  const disconnect = () => {
    window.localStorage.removeItem(WALLET_PROVIDER_STORAGE_KEY);
    clearWalletSession();
    toast("WALLET DISCONNECTED");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="flex min-h-11 items-center gap-2 border border-border py-1 pl-1 pr-2 transition-colors hover:border-primary md:min-h-0"
      >
        <InscriptionAvatar
          inscriptionId={avatar}
          label={name}
          className="size-7 shrink-0 border border-border [image-rendering:pixelated]"
          fallbackClassName="text-[11px]"
        />
        <span className="hidden max-w-[10rem] truncate font-mono text-[11px] uppercase text-foreground sm:block" data-no-translate>
          {name}
        </span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 font-mono text-[11px]">
        <DropdownMenuLabel className="font-mono text-[10px]">
          {wallet ? (
            <div className="space-y-1">
              <div className="label text-bitcoin">{WALLET_LABEL[wallet.provider]} CONNECTED</div>
              <div className="break-all text-muted-foreground" data-no-translate>{wallet.ordinalsAddress}</div>
            </div>
          ) : (
            <div className="label text-muted-foreground">NO WALLET CONNECTED</div>
          )}
        </DropdownMenuLabel>
        {wallet && (
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard.writeText(wallet.ordinalsAddress);
              toast("ADDRESS COPIED");
            }}
          >
            <Copy className="size-3.5" /> COPY ADDRESS
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/wallet" })}>
          <Wallet className="size-3.5" /> MY BITMAPS · LIST WITH TRAITS
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/my-land" })}>MY LAND</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/dashboard" })}>DASHBOARD</DropdownMenuItem>
        <DropdownMenuSeparator />
        {wallet ? (
          <>
            <DropdownMenuItem onSelect={() => { disconnect(); void navigate({ to: "/wallet" }); }}>
              <Wallet className="size-3.5" /> SWITCH WALLET
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={disconnect} className="text-bitcoin focus:text-bitcoin">
              <Unplug className="size-3.5" /> DISCONNECT WALLET
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => void navigate({ to: "/wallet" })}>
            <Wallet className="size-3.5" /> CONNECT WALLET
          </DropdownMenuItem>
        )}
        {session ? (
          <DropdownMenuItem onSelect={() => void signOut().then(() => toast("SIGNED OUT"))}>
            <LogOut className="size-3.5" /> SIGN OUT ACCOUNT
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => void navigate({ to: "/auth" })}>
            <LogOut className="size-3.5" /> SIGN IN ACCOUNT
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
