import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { bitmapEventsQuery } from "@/lib/coins";
import { CoinEventCard } from "@/components/coins/CoinEventCard";
import { CoinEventForm } from "@/components/coins/CoinEventForm";
import { useWalletSession, walletControls } from "@/lib/wallet-session";

/**
 * Raffles, giveaways and events hosted on one bitmap. Entries are paid in BIT.
 */
export function BitmapEvents({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const wallet = useWalletSession();
  const events = useQuery(bitmapEventsQuery(height));
  const canHost = walletControls(wallet, ownerAddress);

  return (
    <section className="border border-border p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-widest">RAFFLES & EVENTS</h2>
        <Link to="/coins" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          BIT ECONOMY →
        </Link>
      </div>

      {(events.data ?? []).length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; NOTHING RUNNING ON {height}.BITMAP YET<span className="blink">_</span>
        </p>
      ) : (
        <div className="space-y-3">
          {(events.data ?? []).map((event) => (
            <CoinEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {canHost ? (
        <div className="border-t border-border pt-3">
          <p className="label mb-3">HOST SOMETHING ON {height}.BITMAP</p>
          <CoinEventForm defaultHeight={height} />
        </div>
      ) : null}
    </section>
  );
}
