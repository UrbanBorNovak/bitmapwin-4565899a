import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useBidInbox } from "@/lib/use-bid-inbox";

/**
 * Header notification for parcel holders: how many live offers stand on the
 * connected wallet's bitmaps, with a toast the first time each one is seen.
 */
export function BidInboxBell() {
  const { received } = useBidInbox({ notify: true });
  const count = received.length;

  return (
    <Link
      to="/wallet"
      aria-label={count > 0 ? `${count} offers on your bitmaps` : "Offers on your bitmaps"}
      className="relative border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
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
