import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Home, IdCard, LayoutDashboard, LogOut, Map as MapIcon, Unplug, Wallet } from "lucide-react";
import { toast } from "sonner";
import { clearWalletSession, useWalletSession } from "@/lib/wallet-session";
import { profileQuery } from "@/lib/profiles";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { shortenAddress } from "@/lib/registry";
import { accountLabel, signOut, useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery, verifiedWalletAddress } from "@/lib/wallet-links";
import { WALLET_LABEL, WALLET_PROVIDER_STORAGE_KEY } from "@/lib/browser-wallet";

/**
 * Header identity chip with an in-place dropdown (not portaled: the page-size
 * CSS zoom on <html> pushes portaled popovers off-screen).
 */
export function HeaderIdentity() {
  const wallet = useWalletSession();
  const navigate = useNavigate();
  const { session, user, loading } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = verifiedWalletAddress(links.data, wallet?.ordinalsAddress);
  const profile = useQuery(profileQuery(address));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

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

  const go = (to: string) => { setOpen(false); void navigate({ to }); };
  const item = "flex w-full items-center gap-2 px-3 py-2 text-left uppercase hover:bg-surface hover:text-bitcoin";

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
        <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-72 border border-border bg-background font-mono text-[11px] shadow-lg">
          <div className="border-b border-border bg-surface px-3 py-3">
            {wallet ? (
              <>
                <div className="label text-bitcoin">{WALLET_LABEL[wallet.provider]} CONNECTED</div>
                <div className="mt-1 break-all text-[10px] text-muted-foreground" data-no-translate>{wallet.ordinalsAddress}</div>
              </>
            ) : (
              <div className="label text-muted-foreground">NO WALLET CONNECTED</div>
            )}
          </div>
          <div className="label px-3 pt-2 text-[9px] text-muted-foreground">MY STUFF</div>
          <button role="menuitem" className={item} onClick={() => go("/wallet")}><Wallet className="size-3.5" /> MY BITMAPS · LIST WITH TRAITS</button>
          <button role="menuitem" className={item} onClick={() => go("/my-land")}><MapIcon className="size-3.5" /> MY LAND</button>
          <button role="menuitem" className={item} onClick={() => go("/my-world")}><Home className="size-3.5" /> MY WORLD</button>
          <button role="menuitem" className={item} onClick={() => go("/passport")}><IdCard className="size-3.5" /> MY PASSPORT</button>
          <button role="menuitem" className={item} onClick={() => go("/dashboard")}><LayoutDashboard className="size-3.5" /> DASHBOARD</button>
          <div className="my-1 h-px bg-border" />
          <div className="label px-3 pt-1 text-[9px] text-muted-foreground">WALLET & ACCOUNT</div>
          {wallet && (
            <button role="menuitem" className={item} onClick={() => { void navigator.clipboard.writeText(wallet.ordinalsAddress); toast("ADDRESS COPIED"); setOpen(false); }}>
              <Copy className="size-3.5" /> COPY ADDRESS
            </button>
          )}
          {wallet ? (
            <>
              <button role="menuitem" className={item} onClick={() => { disconnect(); go("/wallet"); }}><Wallet className="size-3.5" /> SWITCH WALLET</button>
              <button role="menuitem" className={`${item} text-bitcoin`} onClick={() => { disconnect(); setOpen(false); }}><Unplug className="size-3.5" /> DISCONNECT WALLET</button>
            </>
          ) : (
            <button role="menuitem" className={item} onClick={() => go("/wallet")}><Wallet className="size-3.5" /> CONNECT WALLET</button>
          )}
          {session ? (
            <button role="menuitem" className={`${item} mb-1`} onClick={() => { setOpen(false); void signOut().then(() => toast("SIGNED OUT")); }}><LogOut className="size-3.5" /> SIGN OUT ACCOUNT</button>
          ) : (
            <button role="menuitem" className={`${item} mb-1`} onClick={() => go("/auth")}><LogOut className="size-3.5" /> SIGN IN ACCOUNT</button>
          )}
        </div>
      )}
    </div>
  );
}
