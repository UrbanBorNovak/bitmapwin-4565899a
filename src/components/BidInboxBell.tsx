import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useBidInbox } from "@/lib/use-bid-inbox";
import { useAutoSettle } from "@/lib/use-auto-settle";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Header notification for parcel holders: how many live offers stand on the
 * connected wallet's bitmaps, with a toast the first time each one is seen.
 * While a wallet is connected it also runs the background settlement sweep so
 * accepted bids close by themselves once the buyer broadcasts.
 */
export function BidInboxBell() {
  const { received } = useBidInbox({ notify: true });
  const wallet = useWalletSession();
  useAutoSettle(Boolean(wallet));
  const count = received.length;

  return (
    <Link
      to="/wallet"
      aria-label={count > 0 ? `${count} offers on your bitmaps` : "Offers on your bitmaps"}
      className="relative grid size-11 shrink-0 place-items-center border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground md:size-9"
      activeProps={{ className: "text-foreground border-foreground" }}
    >
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 min-w-4 border border-foreground bg-foreground px-1 text-center font-mono text-[9px] leading-4 text-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
